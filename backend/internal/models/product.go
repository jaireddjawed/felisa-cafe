package models

import "github.com/pocketbase/pocketbase/core"

// ProductCategory mirrors the "category" select field's options on the
// products collection (see internal/migrations/1700000000_products_collection.go).
type ProductCategory string

const (
	ProductCategorySignature ProductCategory = "signature"
	ProductCategoryPantry    ProductCategory = "pantry"
	ProductCategoryMerch     ProductCategory = "merch"
)

// Product is the domain representation of a "products" record. The
// `column` tags are read by applyToRecord/scanRecord (see record.go) to
// move data to and from the underlying PocketBase record.
type Product struct {
	ID          string          `column:"id,primary_key"`
	Slug        string          `column:"slug"`
	Name        string          `column:"name"`
	Category    ProductCategory `column:"category"`
	Price       float64         `column:"price"`
	Tagline     string          `column:"tagline"`
	Description string          `column:"description"`
	Ingredients []string        `column:"ingredients"`
	Size        string          `column:"size"`
	Bases       []string        `column:"bases"`
	PourTop     string          `column:"pour_top"`
	PourBottom  string          `column:"pour_bottom"`
	Badge       string          `column:"badge"`

	// CatalogID is the linked payment processor catalog item's ID (see
	// internal/providers/payments.PaymentProcessor). The processor is the
	// source of truth for catalog data; this is empty until a sync runs,
	// and PocketBase only ever caches what the processor returns.
	CatalogID string `column:"catalog_id"`
}

func (p *Product) ApplyToRecord(record *core.Record) {
	applyToRecord(record, p)
}

func ProductFromRecord(record *core.Record) (*Product, error) {
	p := &Product{}
	if err := scanRecord(record, p); err != nil {
		return nil, err
	}
	return p, nil
}
