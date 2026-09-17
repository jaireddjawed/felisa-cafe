package views

import (
	"regexp"

	validation "github.com/pocketbase/ozzo-validation/v4"
)

// Format-only check. ozzo's is.Email wraps govalidator.IsExistingEmail, which
// does a live MX/DNS lookup per call — too brittle to run on every checkout.
var emailFormat = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

// CheckoutItemInput and CheckoutInput are the wire shapes the frontend posts
// to POST /api/checkout — the request-side counterpart to ProductView and
// OrderView. Kept here (rather than in the controllers package) so tygo can
// generate lib/api-types.ts from this one package; see backend/tygo.yaml.
type CheckoutItemInput struct {
	Slug    string   `json:"slug"`
	Qty     int      `json:"qty"`
	Options []string `json:"options"`
}

func (i CheckoutItemInput) Validate() error {
	return validation.ValidateStruct(&i,
		validation.Field(&i.Slug, validation.Required),
		validation.Field(&i.Qty, validation.Required, validation.Min(1)),
	)
}

type CheckoutInput struct {
	CustomerName  string              `json:"customerName"`
	CustomerEmail string              `json:"customerEmail"`
	CustomerPhone string              `json:"customerPhone,omitempty"`
	Notes         string              `json:"notes,omitempty"`
	Items         []CheckoutItemInput `json:"items"`
}

// Validate cascades into each Items element automatically, since
// CheckoutItemInput implements Validatable.
func (in CheckoutInput) Validate() error {
	return validation.ValidateStruct(&in,
		validation.Field(&in.CustomerName, validation.Required),
		validation.Field(&in.CustomerEmail, validation.Required, validation.Match(emailFormat)),
		validation.Field(&in.Items, validation.Required),
	)
}
