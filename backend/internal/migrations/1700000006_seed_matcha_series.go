package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/migrations"
)

// seedMatchaSeries mirrors the "Matcha Series" flyer (12oz iced, first-harvest
// Uji matcha). The matcha versions of Felisa Latte and Mabuhay Mocha aren't
// duplicated here — those are already the "Matcha" entry in the existing
// signature products' Bases field, not distinct drinks.
var seedMatchaSeries = []legacySeedProduct{
	{
		Slug: "classic-matcha-latte", Name: "Classic Matcha Latte", Category: "matcha", Price: 8.5,
		Tagline:     "First-harvest Uji matcha, no detours.",
		Description: "3g of first-harvest Yutaka Midori matcha whisked with your choice of milk. Fragrant, creamy umami with notes of sweet roasted chestnut — nothing else in the way.",
		Ingredients: []string{"3g first-harvest matcha (Uji, Japan)", "choice of milk"},
		Size:        "12oz",
		PourTop:     "#5C7A3F", PourBottom: "#D9E4C3", Badge: "Matcha",
	},
	{
		Slug: "matcha-cano", Name: "Matcha-cano", Category: "matcha", Price: 8,
		Tagline:     "Matcha, straight, over water.",
		Description: "The matcha-cano treatment: 3g of first-harvest Uji matcha shaken with water instead of milk, so the umami and roasted-chestnut sweetness carry the whole cup.",
		Ingredients: []string{"3g first-harvest matcha (Uji, Japan)", "water"},
		Size:        "12oz",
		PourTop:     "#3F5C2E", PourBottom: "#8FAE6B", Badge: "Matcha",
	},
	{
		Slug: "vanilla-matcha-latte", Name: "Vanilla Matcha Latte", Category: "matcha", Price: 8.5,
		Tagline:     "Matcha with a warm vanilla edge.",
		Description: "First-harvest matcha and our housemade vanilla bean syrup, finished with your choice of milk. Rounds out the matcha's umami with something sweeter and softer.",
		Ingredients: []string{"3g first-harvest matcha (Uji, Japan)", "housemade vanilla bean syrup", "choice of milk"},
		Size:        "12oz",
		PourTop:     "#5C7A3F", PourBottom: "#F1E4C3", Badge: "Matcha",
	},
	{
		Slug: "turon-matcha-latte", Name: "Turon Matcha Latte", Category: "matcha", Price: 8.5,
		Tagline:     "The turon flavor, matcha base.",
		Description: "First-harvest matcha and our caramelized banana syrup, choice of milk. Same toasty, jammy turon flavor as the milk tea version, built on matcha instead of black tea.",
		Ingredients: []string{"3g first-harvest matcha (Uji, Japan)", "housemade caramelized banana syrup", "choice of milk"},
		Size:        "12oz",
		PourTop:     "#5C7A3F", PourBottom: "#DDBB8A", Badge: "Matcha",
	},
	{
		Slug: "lubi-matcha-latte", Name: "Lubi Matcha Latte", Category: "matcha", Price: 8.5,
		Tagline:     "Coconut and matcha, iced.",
		Description: "First-harvest matcha with our housemade coconut syrup and choice of milk — coconut milk recommended for the fullest coconut flavor.",
		Ingredients: []string{"3g first-harvest matcha (Uji, Japan)", "housemade coconut syrup", "choice of milk (coconut milk recommended)"},
		Size:        "12oz",
		PourTop:     "#5C7A3F", PourBottom: "#EFE3D2", Badge: "Matcha",
	},
}

func init() {
	migrations.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("products")
		if err != nil {
			return err
		}

		for _, p := range seedMatchaSeries {
			record := core.NewRecord(collection)
			p.apply(record)

			if err := app.Save(record); err != nil {
				return err
			}
		}

		return nil
	}, func(app core.App) error {
		for _, p := range seedMatchaSeries {
			record, err := app.FindFirstRecordByFilter("products", "slug = {:slug}", map[string]any{"slug": p.Slug})
			if err != nil {
				continue
			}
			if err := app.Delete(record); err != nil {
				return err
			}
		}
		return nil
	})
}
