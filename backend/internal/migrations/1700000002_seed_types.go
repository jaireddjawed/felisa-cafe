package migrations

import "github.com/pocketbase/pocketbase/core"

// legacySeedProduct is the products schema as it stood when the seed
// migrations (1700000002, 1700000006) were written. Migrations are frozen
// history: they must not depend on application models, whose shape moves on
// (price and bases later moved to Square-owned product_variations).
type legacySeedProduct struct {
	Slug, Name, Category, Tagline, Description, Size, PourTop, PourBottom, Badge string
	Price                                                                        float64
	Ingredients, Bases                                                           []string
}

func (p legacySeedProduct) apply(record *core.Record) {
	record.Set("slug", p.Slug)
	record.Set("name", p.Name)
	record.Set("category", p.Category)
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
