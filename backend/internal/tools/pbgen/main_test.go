package main

import (
	"bytes"
	"os"
	"strings"
	"testing"
)

const schemaDir = "../../database/internal/schema/"

// Changing a migration without regenerating fails here (and in CI), so the
// typed layer can never silently drift from the schema it describes.
func TestGeneratedSchemaIsUpToDate(t *testing.T) {
	cfg, err := loadConfig(schemaDir + "pbgen.json")
	if err != nil {
		t.Fatal(err)
	}
	app, cleanup, err := migratedApp()
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()

	want, err := generate(app, cfg)
	if err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(schemaDir + "schema_gen.go")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want) {
		t.Fatal("schema_gen.go is out of date with internal/migrations: run `go generate ./...`")
	}
	if !bytes.HasPrefix(got, []byte("// Code generated")) || !strings.Contains(string(got), "DO NOT EDIT.") {
		t.Error("generated file must carry the standard generated-code header")
	}
}

func TestUnmappedJSONFieldFailsGeneration(t *testing.T) {
	cfg, err := loadConfig(schemaDir + "pbgen.json")
	if err != nil {
		t.Fatal(err)
	}
	delete(cfg.JSONTypes, "orders.line_items")

	app, cleanup, err := migratedApp()
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()

	if _, err := generate(app, cfg); err == nil || !strings.Contains(err.Error(), "orders.line_items") {
		t.Fatalf("expected an error naming the unmapped JSON field, got %v", err)
	}
}

func TestGoName(t *testing.T) {
	for in, want := range map[string]string{
		"square_item_id":     "SquareItemID",
		"emailVisibility":    "EmailVisibility",
		"checkout_url":       "CheckoutURL",
		"pending_payment":    "PendingPayment",
		"product_variations": "ProductVariations",
	} {
		if got := goName(in); got != want {
			t.Errorf("goName(%q) = %q, want %q", in, got, want)
		}
	}
}
