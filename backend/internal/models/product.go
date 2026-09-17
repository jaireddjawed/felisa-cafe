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

// Product is the domain representation of a "products" record.
type Product struct {
	ID          string
	Slug        string
	Name        string
	Category    ProductCategory
	Price       float64
	Tagline     string
	Description string
	Ingredients []string
	Size        string
	Bases       []string
	PourTop     string
	PourBottom  string
	Badge       string
}

func (p *Product) ApplyToRecord(record *core.Record) {
	record.Set("slug", p.Slug)
	record.Set("name", p.Name)
	record.Set("category", string(p.Category))
	record.Set("price", p.Price)
	record.Set("tagline", p.Tagline)
	record.Set("description", p.Description)
	record.Set("ingredients", p.Ingredients)
	record.Set("size", p.Size)
	record.Set("bases", p.Bases)
	record.Set("pour_top", p.PourTop)
	record.Set("pour_bottom", p.PourBottom)
	record.Set("badge", p.Badge)
}

func ProductFromRecord(record *core.Record) (*Product, error) {
	var ingredients []string
	if err := record.UnmarshalJSONField("ingredients", &ingredients); err != nil {
		return nil, err
	}

	var bases []string
	if err := record.UnmarshalJSONField("bases", &bases); err != nil {
		return nil, err
	}

	return &Product{
		ID:          record.Id,
		Slug:        record.GetString("slug"),
		Name:        record.GetString("name"),
		Category:    ProductCategory(record.GetString("category")),
		Price:       record.GetFloat("price"),
		Tagline:     record.GetString("tagline"),
		Description: record.GetString("description"),
		Ingredients: ingredients,
		Size:        record.GetString("size"),
		Bases:       bases,
		PourTop:     record.GetString("pour_top"),
		PourBottom:  record.GetString("pour_bottom"),
		Badge:       record.GetString("badge"),
	}, nil
}
