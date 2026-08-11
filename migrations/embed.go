package migrations

import "embed"

// Files contains the versioned database migrations shipped with the server.
//
//go:embed *.up.sql
var Files embed.FS
