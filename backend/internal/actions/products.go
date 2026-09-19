package actions

import (
	"net/http"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/views"
)

// ListProducts handles GET /api/menu/products, with an optional
// ?category=signature|pantry|merch filter.
func ListProducts(e *core.RequestEvent) error {
	category := e.Request.URL.Query().Get("category")

	filter := ""
	params := dbx.Params{}
	if category != "" {
		filter = "category = {:category}"
		params["category"] = category
	}

	records, err := e.App.FindRecordsByFilter("products", filter, "+name", 200, 0, params)
	if err != nil {
		return e.InternalServerError("failed to list products", err)
	}

	out := make([]*views.ProductView, 0, len(records))
	for _, record := range records {
		product, err := models.ProductFromRecord(record)
		if err != nil {
			return e.InternalServerError("failed to read product", err)
		}
		out = append(out, views.NewProductView(product))
	}

	return e.JSON(http.StatusOK, out)
}

// GetProduct handles GET /api/menu/products/{slug}.
func GetProduct(e *core.RequestEvent) error {
	slug := e.Request.PathValue("slug")

	record, err := e.App.FindFirstRecordByFilter("products", "slug = {:slug}", dbx.Params{"slug": slug})
	if err != nil {
		return e.NotFoundError("product not found", err)
	}

	product, err := models.ProductFromRecord(record)
	if err != nil {
		return e.InternalServerError("failed to read product", err)
	}

	return e.JSON(http.StatusOK, views.NewProductView(product))
}
