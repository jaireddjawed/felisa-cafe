package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/migrations"
)

func init() {
	migrations.Register(func(app core.App) error {
		collection := core.NewBaseCollection("products")

		collection.Fields.Add(
			&core.TextField{Name: "slug", Required: true, Max: 100},
			&core.TextField{Name: "name", Required: true, Max: 200},
			&core.SelectField{
				Name:     "category",
				Required: true,
				Values:   []string{"signature", "pantry", "merch"},
			},
			&core.NumberField{Name: "price", Required: true, Min: floatPtr(0)},
			&core.TextField{Name: "tagline", Max: 300},
			&core.TextField{Name: "description", Max: 4000},
			&core.JSONField{Name: "ingredients"},
			&core.TextField{Name: "size", Max: 100},
			&core.JSONField{Name: "bases"},
			&core.TextField{Name: "pour_top", Required: true, Max: 20},
			&core.TextField{Name: "pour_bottom", Required: true, Max: 20},
			&core.TextField{Name: "badge", Max: 50},
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
		)

		collection.AddIndex("idx_products_slug", true, "slug", "")

		// Menu data is public read; writes go through the Admin dashboard only
		// (create/update/delete rules stay nil, i.e. superuser-only).
		publicRule := ""
		collection.ListRule = &publicRule
		collection.ViewRule = &publicRule

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("products")
		if err != nil {
			return err
		}
		return app.Delete(collection)
	})
}

func floatPtr(v float64) *float64 {
	return &v
}
