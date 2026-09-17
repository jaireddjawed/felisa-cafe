package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/migrations"
)

func init() {
	migrations.Register(func(app core.App) error {
		collection := core.NewBaseCollection("orders")

		collection.Fields.Add(
			&core.SelectField{
				Name:     "status",
				Required: true,
				Values:   []string{"pending", "confirmed", "completed", "cancelled"},
			},
			&core.TextField{Name: "customer_name", Required: true, Max: 200},
			&core.EmailField{Name: "customer_email", Required: true},
			&core.TextField{Name: "customer_phone", Max: 40},
			&core.JSONField{Name: "items", Required: true},
			&core.NumberField{Name: "subtotal", Required: true, Min: floatPtr(0)},
			&core.TextField{Name: "notes", Max: 1000},
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
		)

		// Orders are only ever written by the POST /api/checkout controller,
		// which computes authoritative prices server-side via app.Save
		// (direct App calls bypass collection API rules entirely). Every rule
		// here stays nil/superuser-only, so there is no direct REST access.

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("orders")
		if err != nil {
			return err
		}
		return app.Delete(collection)
	})
}
