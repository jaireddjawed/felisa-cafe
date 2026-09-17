package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/migrations"
)

// The auto-created "users" collection defaults every rule to nil
// (superuser-only), which blocks the storefront's self-serve signup. Open up
// create (signup) and let signed-in users view/update their own record only.
func init() {
	migrations.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		publicRule := ""
		ownerRule := "id = @request.auth.id"

		collection.CreateRule = &publicRule
		collection.ViewRule = &ownerRule
		collection.UpdateRule = &ownerRule

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		collection.CreateRule = nil
		collection.ViewRule = nil
		collection.UpdateRule = nil

		return app.Save(collection)
	})
}
