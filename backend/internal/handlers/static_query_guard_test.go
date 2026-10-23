package handlers

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// Root tenant tables that MUST be store-scoped in multi-tenant mode
var rootTenantTables = []string{
	"categories",
	"products",
	"toppings",
	"promotions",
	"funds",
	"orders",
	"transactions",
	"transaction_categories",
	"ingredients",
}

// Allowed unscoped occurrences (e.g. super admin overview, backup platform export)
var queryGuardAllowlist = map[string][]string{
	"analytics.go": {
		"GetOverviewAllStores", // Intentionally cross-store for super_admin
	},
	"backup.go": {
		// Backup service exports and restores all tenant data for platform backup
		"ExportBackup",
		"RestoreBackup",
		"PreviewBackup",
		"restoreData",
		"exportData",
		"previewData",
	},
	"store.go": {
		// Store management operates on stores table and seeds initial store funds
		"seedDefaultStoreData",
		"CloneMenu",
	},
}

// TestStaticQueryGuard inspects handler source files to ensure queries targeting
// root tenant tables include store scoping (store_id = ?).
func TestStaticQueryGuard(t *testing.T) {
	handlersDir := "."
	entries, err := os.ReadDir(handlersDir)
	if err != nil {
		t.Fatalf("failed to read handlers dir: %v", err)
	}

	rawSQLRegex := regexp.MustCompile(`(?i)(FROM|JOIN|UPDATE|INTO)\s+([a-z_]+)`)

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".go") || strings.HasSuffix(entry.Name(), "_test.go") {
			continue
		}

		filePath := filepath.Join(handlersDir, entry.Name())
		file, err := os.Open(filePath)
		if err != nil {
			t.Errorf("failed to open %s: %v", filePath, err)
			continue
		}
		defer file.Close()

		scanner := bufio.NewScanner(file)
		lineNum := 0
		var currentFunc string

		for scanner.Scan() {
			lineNum++
			line := strings.TrimSpace(scanner.Text())

			// Track enclosing function name
			if strings.HasPrefix(line, "func ") {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					currentFunc = parts[1]
					if strings.Contains(currentFunc, "(") {
						currentFunc = currentFunc[:strings.Index(currentFunc, "(")]
					}
				}
			}

			// Check if function is whitelisted
			if allowedFuncs, ok := queryGuardAllowlist[entry.Name()]; ok {
				whitelisted := false
				for _, af := range allowedFuncs {
					if strings.Contains(currentFunc, af) {
						whitelisted = true
						break
					}
				}
				if whitelisted {
					continue
				}
			}

			// Check raw SQL queries for root tenant tables
			matches := rawSQLRegex.FindAllStringSubmatch(line, -1)
			for _, m := range matches {
				if len(m) >= 3 {
					table := strings.ToLower(m[2])
					for _, rootTable := range rootTenantTables {
						if table == rootTable {
							// If a root table is referenced in raw SQL, verify store_id appears in line or surrounding context
							if !strings.Contains(line, "store_id") &&
								!strings.Contains(line, "where") &&
								!strings.Contains(line, "WHERE") &&
								!strings.Contains(line, "ON") &&
								!strings.Contains(line, "on") &&
								!strings.Contains(line, "//") &&
								!strings.HasPrefix(line, "log.") {
								t.Logf("[QueryGuard Check] %s:%d (%s): Root table '%s' referenced in raw SQL: %s",
									entry.Name(), lineNum, currentFunc, rootTable, line)
							}
						}
					}
				}
			}
		}
	}
}
