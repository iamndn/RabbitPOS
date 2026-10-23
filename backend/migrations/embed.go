// Package migrations embeds the versioned SQL migration files so the backend
// binary can apply them itself (the Docker runtime image ships only the binary).
package migrations

import "embed"

// FS contains every NNNNNN_name.up.sql / NNNNNN_name.down.sql file in this directory.
//
//go:embed *.sql
var FS embed.FS
