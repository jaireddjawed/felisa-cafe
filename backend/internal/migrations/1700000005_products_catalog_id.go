package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/migrations"
)

// Adds a catalog_id cache field: the payment processor (see
// internal/providers/payments.PaymentProcessor) is the source of truth for
// catalog data, and writes its catalog item ID back here after each sync.
func init() {
	migrations.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("products")
		if err != nil {
			return err
		}

		collection.Fields.Add(&core.TextField{Name: "catalog_id", Max: 100})
		collection.AddIndex("idx_products_catalog_id", false, "catalog_id", "")

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("products")
		if err != nil {
			return err
		}

		collection.Fields.RemoveByName("catalog_id")
		collection.RemoveIndex("idx_products_catalog_id")

		return app.Save(collection)
	})
}
