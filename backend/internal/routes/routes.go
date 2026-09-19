// Package routes binds the storefront API onto PocketBase's router, next to
// PocketBase's built-in API (auth, files, realtime, admin).
package routes

import (
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/actions"
	"felisa-cafe/backend/internal/database"
)

func Register(app core.App, h *actions.Handlers) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		api := se.Router.Group("/api")
		signedIn := apis.RequireAuth(database.UsersCollection)

		// Menu: always served from the PocketBase cache.
		api.GET("/menu/products", h.ListProducts)
		api.GET("/menu/products/{slug}", h.GetProduct)

		// Cart: guests identify with X-Cart-Token, customers with their auth token.
		api.GET("/cart", h.GetCart)
		api.POST("/cart/items", h.AddCartItem)
		api.PATCH("/cart/items/{lineId}", h.UpdateCartItem)
		api.DELETE("/cart/items/{lineId}", h.RemoveCartItem)
		api.POST("/cart/merge", h.MergeCart).Bind(signedIn)
		api.GET("/cart/eta", h.CartETA)

		// Checkout and orders.
		api.POST("/checkout", h.StartCheckout)
		api.POST("/checkout/pay", h.PayCheckout)
		api.GET("/orders", h.ListOrders).Bind(signedIn)
		api.GET("/orders/{id}", h.GetOrder)

		// Square webhooks (signature-verified).
		api.POST("/webhooks/square", h.SquareWebhook)

		return se.Next()
	})
}
