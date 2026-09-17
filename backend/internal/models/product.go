package models

import "github.com/pocketbase/pocketbase/core"

// Product is the domain representation of a "products" record.
type Product struct {
	ID          string
	Slug        string
	Name        string
	Category    string
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
		Category:    record.GetString("category"),
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
