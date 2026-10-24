package database

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"log"
	"os"
	"regexp"
	"sort"
	"strconv"

	"gorm.io/gorm"
)

// LegacyBaselineVersion is the last migration whose effect is already produced by GORM AutoMigrate
// on every database that existed before the migration runner was introduced.
const LegacyBaselineVersion = 19

// migrationLockKey is the PostgreSQL advisory lock key serializing concurrent migrators.
const migrationLockKey int64 = 7340120

var migrationFileRe = regexp.MustCompile(`^(\d{6})_(.+)\.up\.sql$`)

// SQLMigration is one embedded NNNNNN_name.up.sql file.
type SQLMigration struct {
	Version int
	Name    string
	SQL     string
}

// LoadSQLMigrations reads and orders all *.up.sql files found at the root of fsys.
func LoadSQLMigrations(fsys fs.FS) ([]SQLMigration, error) {
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return nil, fmt.Errorf("read migrations: %w", err)
	}

	var migrations []SQLMigration
	seen := map[int]string{}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		m := migrationFileRe.FindStringSubmatch(entry.Name())
		if m == nil {
			continue
		}
		version, _ := strconv.Atoi(m[1])
		if prev, dup := seen[version]; dup {
			return nil, fmt.Errorf("duplicate migration version %06d: %s and %s", version, prev, entry.Name())
		}
		seen[version] = entry.Name()

		body, err := fs.ReadFile(fsys, entry.Name())
		if err != nil {
			return nil, fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}
		migrations = append(migrations, SQLMigration{Version: version, Name: m[2], SQL: string(body)})
	}

	sort.Slice(migrations, func(i, j int) bool { return migrations[i].Version < migrations[j].Version })
	return migrations, nil
}

// RunSQLMigrations applies pending embedded SQL migrations, each inside its own transaction,
// and records them in schema_migrations. It must run BEFORE GORM AutoMigrate.
//
// Baseline rules (first run only, when schema_migrations is empty):
//   - legacy database (orders table exists): versions <= LegacyBaselineVersion are recorded as
//     applied WITHOUT executing them (AutoMigrate built that schema); newer versions then run.
//   - fresh database (no orders table): every known version is recorded as applied WITHOUT
//     executing it, because AutoMigrate builds the final schema from the current models.
//
// The standard database/sql handle is used on purpose: GORM's prepared-statement mode cannot run
// multi-statement scripts.
func RunSQLMigrations(db *gorm.DB, fsys fs.FS) error {
	migrations, err := LoadSQLMigrations(fsys)
	if err != nil {
		return err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("get sql.DB: %w", err)
	}
	ctx := context.Background()

	if _, err := sqlDB.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    INTEGER      PRIMARY KEY,
			name       VARCHAR(200) NOT NULL,
			baseline   BOOLEAN      NOT NULL DEFAULT FALSE,
			applied_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	var appliedCount int
	if err := sqlDB.QueryRowContext(ctx, `SELECT COUNT(*) FROM schema_migrations`).Scan(&appliedCount); err != nil {
		return fmt.Errorf("count schema_migrations: %w", err)
	}

	if appliedCount == 0 {
		if err := baselineMigrations(ctx, sqlDB, migrations); err != nil {
			return err
		}
	}

	for _, m := range migrations {
		if err := applyMigration(ctx, sqlDB, m); err != nil {
			return err
		}
	}
	return nil
}

func baselineMigrations(ctx context.Context, sqlDB *sql.DB, migrations []SQLMigration) error {
	var legacy bool
	if err := sqlDB.QueryRowContext(ctx, `SELECT to_regclass('orders') IS NOT NULL`).Scan(&legacy); err != nil {
		return fmt.Errorf("detect legacy schema: %w", err)
	}

	for _, m := range migrations {
		if legacy && m.Version > LegacyBaselineVersion {
			continue
		}
		if _, err := sqlDB.ExecContext(ctx,
			`INSERT INTO schema_migrations (version, name, baseline) VALUES ($1, $2, TRUE) ON CONFLICT (version) DO NOTHING`,
			m.Version, m.Name); err != nil {
			return fmt.Errorf("baseline migration %06d: %w", m.Version, err)
		}
	}

	if legacy {
		log.Printf("[MIGRATE] Legacy schema detected: baselined migrations <= %06d (built by AutoMigrate).", LegacyBaselineVersion)
	} else {
		log.Println("[MIGRATE] Fresh database detected: baselined all migrations; AutoMigrate builds the schema.")
	}
	return nil
}

func applyMigration(ctx context.Context, sqlDB *sql.DB, m SQLMigration) error {
	tx, err := sqlDB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin migration %06d: %w", m.Version, err)
	}
	defer func() { _ = tx.Rollback() }()

	// Transaction-scoped advisory lock: safe with PgBouncer transaction pooling.
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock($1)`, migrationLockKey); err != nil {
		return fmt.Errorf("lock migration %06d: %w", m.Version, err)
	}

	var exists bool
	if err := tx.QueryRowContext(ctx,
		`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, m.Version).Scan(&exists); err != nil {
		return fmt.Errorf("check migration %06d: %w", m.Version, err)
	}
	if exists {
		return nil
	}

	// Migration 21 is the contract phase: gated until post-rollout soak completes.
	if m.Version == 21 && os.Getenv("ENABLE_MIGRATION_000021") != "true" {
		log.Printf("[MIGRATE] Skipping %06d_%s (contract phase gated until ENABLE_MIGRATION_000021=true)", m.Version, m.Name)
		return nil
	}

	log.Printf("[MIGRATE] Applying %06d_%s ...", m.Version, m.Name)
	if _, err := tx.ExecContext(ctx, m.SQL); err != nil {
		return fmt.Errorf("apply migration %06d_%s: %w", m.Version, m.Name, err)
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`, m.Version, m.Name); err != nil {
		return fmt.Errorf("record migration %06d: %w", m.Version, err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit migration %06d: %w", m.Version, err)
	}
	log.Printf("[MIGRATE] Applied %06d_%s", m.Version, m.Name)
	return nil
}
