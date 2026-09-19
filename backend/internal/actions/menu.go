package actions

import (
	"net/http"
	"strings"

	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/views"
)

// ListProducts handles GET /api/menu/products[?category=signature,matcha].
// Served entirely from the PocketBase cache.
func (h *Handlers) ListProducts(e *core.RequestEvent) error {
	var cats []models.ProductCategory
	if raw := e.Request.URL.Query().Get("category"); raw != "" {
		for part := range strings.SplitSeq(raw, ",") {
			c, ok := models.ParseProductCategory(strings.TrimSpace(part))
			if !ok {
				return e.BadRequestError("Unknown category.", nil)
			}
			cats = append(cats, c)
		}
	}

	products, err := h.Catalog.List(e.Request.Context(), cats...)
	if err != nil {
		return h.fail(e, err)
	}
	out := make([]views.ProductView, len(products))
	for i, p := range products {
		out[i] = views.NewProductView(p)
	}
	return e.JSON(http.StatusOK, out)
}

// GetProduct handles GET /api/menu/products/{slug}.
func (h *Handlers) GetProduct(e *core.RequestEvent) error {
	p, err := h.Catalog.Get(e.Request.Context(), e.Request.PathValue("slug"))
	if err != nil {
		return h.fail(e, err)
	}
	return e.JSON(http.StatusOK, views.NewProductView(p))
}
