package views

import (
	"fmt"

	"felisa-cafe/backend/internal/models"
)

// ProductView is the JSON shape returned to the frontend, kept separate from
// the Model so the wire contract (camelCase, computed fields) can evolve
// without touching how products are read from PocketBase.
type ProductView struct {
	ID             string                 `json:"id"`
	Slug           string                 `json:"slug"`
	Name           string                 `json:"name"`
	Category       models.ProductCategory `json:"category"`
	Price          float64                `json:"price"`
	PriceFormatted string                 `json:"priceFormatted"`
	Tagline        string                 `json:"tagline"`
	Description    string                 `json:"description"`
	Ingredients    []string               `json:"ingredients"`
	Size           string                 `json:"size,omitempty"`
	Bases          []string               `json:"bases,omitempty"`
	Pour           PourView               `json:"pour"`
	Badge          string                 `json:"badge,omitempty"`
}

type PourView struct {
	Top    string `json:"top"`
	Bottom string `json:"bottom"`
}

func NewProductView(p *models.Product) *ProductView {
	return &ProductView{
		ID:             p.ID,
		Slug:           p.Slug,
		Name:           p.Name,
		Category:       p.Category,
		Price:          p.Price,
		PriceFormatted: fmt.Sprintf("$%.2f", p.Price),
		Tagline:        p.Tagline,
		Description:    p.Description,
		Ingredients:    p.Ingredients,
		Size:           p.Size,
		Bases:          p.Bases,
		Pour:           PourView{Top: p.PourTop, Bottom: p.PourBottom},
		Badge:          p.Badge,
	}
}
