package router

import (
	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/controllers"
)

// Register binds all custom controller routes on top of PocketBase's
// built-in API (auth, files, realtime, etc. still work as normal).
func Register(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/menu/products", controllers.ListProducts)
		se.Router.GET("/api/menu/products/{slug}", controllers.GetProduct)
		se.Router.POST("/api/checkout", controllers.Checkout)

		return se.Next()
	})
}
