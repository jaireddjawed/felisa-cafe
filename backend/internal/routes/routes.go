package routes

import (
	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/actions"
)

// Register binds all custom controller routes on top of PocketBase's
// built-in API (auth, files, realtime, etc. still work as normal).
func Register(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/menu/products", actions.ListProducts)
		se.Router.GET("/api/menu/products/{slug}", actions.GetProduct)
		se.Router.POST("/api/checkout", actions.Checkout)

		return se.Next()
	})
}
