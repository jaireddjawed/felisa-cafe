// Package schema is the only place in the application where PocketBase
// collection names, field names and raw record accessors appear.
//
// schema_gen.go is generated from the live migration history by
// internal/tools/pbgen: it boots a throwaway PocketBase app in a temp dir,
// applies every migration in internal/migrations, and emits for each
// configured collection (see pbgen.json):
//
//   - a typed record proxy (e.g. ProductsRecord) with getters/setters,
//   - a typed ID (ProductsID) used by relation fields pointing at it,
//   - typed enums for select fields (ProductsCategory),
//   - typed column descriptors for queries (Products.Slug.Eq("x")),
//   - a CollectionSpec used by Verify to fail fast on schema drift.
//
// The other files in this package are hand-written support code.
//
// The package lives under internal/database/internal so the Go toolchain
// itself forbids anything outside internal/database from importing it:
// services, actions and routes cannot reach raw records even by accident.
//
// Regenerate after changing any migration:
//
//	go generate ./...
package schema

//go:generate go run felisa-cafe/backend/internal/tools/pbgen -config pbgen.json -out schema_gen.go
