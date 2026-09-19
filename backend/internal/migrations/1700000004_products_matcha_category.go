package migrations

import (
	"fmt"
	"slices"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/migrations"
)

// Adds the "matcha" category for the iced matcha series (see
// 1700000006_seed_matcha_series.go).
func init() {
	migrations.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("products")
		if err != nil {
			return err
		}

		category, ok := collection.Fields.GetByName("category").(*core.SelectField)
		if !ok {
			return fmt.Errorf("products.category is not a select field")
		}
		category.Values = append(category.Values, "matcha")

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("products")
		if err != nil {
			return err
		}

		if category, ok := collection.Fields.GetByName("category").(*core.SelectField); ok {
			category.Values = slices.DeleteFunc(category.Values, func(v string) bool { return v == "matcha" })
		}

		return app.Save(collection)
	})
}
