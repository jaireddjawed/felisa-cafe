// Package views holds the JSON wire types of the storefront API: request
// inputs (with validation) and response shapes. It is also the source for
// frontend/lib/api-types.ts (see backend/tygo.yaml). It converts domain
// models and service results to JSON, and never touches persistence or
// providers.
package views

import (
	"regexp"
	"time"

	validation "github.com/pocketbase/ozzo-validation/v4"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/services/cart"
)

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

// MoneyView is an amount in minor units (cents) plus a display string.
type MoneyView struct {
	Amount    int64  `json:"amount"`
	Currency  string `json:"currency"`
	Formatted string `json:"formatted"`
}

func NewMoneyView(m models.Money) MoneyView {
	return MoneyView{Amount: m.Amount, Currency: string(m.Currency), Formatted: m.String()}
}

// timePtr renders zero times as absent rather than "0001-01-01".
func timePtr(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	u := t.UTC()
	return &u
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

type ProductView struct {
	ID            string                 `json:"id"`
	Slug          string                 `json:"slug"`
	Name          string                 `json:"name"`
	Category      models.ProductCategory `json:"category"`
	Description   string                 `json:"description"`
	Tagline       string                 `json:"tagline"`
	Ingredients   []string               `json:"ingredients"`
	Size          string                 `json:"size,omitempty"`
	Pour          PourView               `json:"pour"`
	Badge         string                 `json:"badge,omitempty"`
	Available     bool                   `json:"available"`
	FromPrice     *MoneyView             `json:"fromPrice,omitempty"`
	Variations    []VariationView        `json:"variations"`
	ModifierLists []ModifierListView     `json:"modifierLists"`
}

type PourView struct {
	Top    string `json:"top"`
	Bottom string `json:"bottom"`
}

// VariationView.ID is the Square variation ID the cart API expects.
type VariationView struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Price     MoneyView `json:"price"`
	Available bool      `json:"available"`
}

type ModifierListView struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	MinSelected int64          `json:"minSelected"`
	MaxSelected int64          `json:"maxSelected"` // 0 = no maximum
	Modifiers   []ModifierView `json:"modifiers"`
}

type ModifierView struct {
	ID    string    `json:"id"`
	Name  string    `json:"name"`
	Price MoneyView `json:"price"`
}

func NewProductView(p models.Product) ProductView {
	v := ProductView{
		ID:            string(p.ID),
		Slug:          p.Slug,
		Name:          p.Name,
		Category:      p.Category,
		Description:   p.Description,
		Tagline:       p.Tagline,
		Ingredients:   p.Ingredients,
		Size:          p.Size,
		Pour:          PourView{Top: p.Pour.Top, Bottom: p.Pour.Bottom},
		Badge:         p.Badge,
		Available:     p.Purchasable(),
		Variations:    []VariationView{},
		ModifierLists: []ModifierListView{},
	}
	if v.Ingredients == nil {
		v.Ingredients = []string{}
	}
	if from, ok := p.FromPrice(); ok {
		mv := NewMoneyView(from)
		v.FromPrice = &mv
	}
	for _, pv := range p.Variations {
		v.Variations = append(v.Variations, VariationView{
			ID: string(pv.SquareID), Name: pv.Name, Price: NewMoneyView(pv.Price), Available: pv.Sellable,
		})
	}
	for _, pml := range p.ModifierLists {
		lv := ModifierListView{
			ID: string(pml.List.SquareID), Name: pml.List.Name,
			MinSelected: pml.MinSelected, MaxSelected: pml.MaxSelected, Modifiers: []ModifierView{},
		}
		for _, m := range pml.List.Modifiers {
			if m.HiddenOnline {
				continue
			}
			lv.Modifiers = append(lv.Modifiers, ModifierView{ID: string(m.SquareID), Name: m.Name, Price: NewMoneyView(m.Price)})
		}
		v.ModifierLists = append(v.ModifierLists, lv)
	}
	return v
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

// AddCartItemInput adds a product variation with chosen modifiers. Only IDs
// and a quantity are accepted: prices always come from the server.
type AddCartItemInput struct {
	VariationID string   `json:"variationId"`
	ModifierIDs []string `json:"modifierIds"`
	Quantity    int64    `json:"quantity"`
	Note        string   `json:"note,omitempty"`
}

func (in AddCartItemInput) Validate() error {
	return validation.ValidateStruct(&in,
		validation.Field(&in.VariationID, validation.Required, validation.Length(1, 100)),
		validation.Field(&in.ModifierIDs, validation.Length(0, 20)),
		validation.Field(&in.Quantity, validation.Required, validation.Min(int64(1)), validation.Max(int64(cart.MaxLineQuantity))),
		validation.Field(&in.Note, validation.Length(0, cart.MaxNoteLength)),
	)
}

// UpdateCartItemInput sets a line's quantity; 0 removes the line.
type UpdateCartItemInput struct {
	Quantity int64 `json:"quantity"`
}

func (in UpdateCartItemInput) Validate() error {
	return validation.ValidateStruct(&in,
		validation.Field(&in.Quantity, validation.Min(int64(0)), validation.Max(int64(cart.MaxLineQuantity))),
	)
}

type CartView struct {
	// CartToken is set when the server has just issued a guest cart token.
	// Send it back as the X-Cart-Token header on later cart and checkout calls.
	CartToken string         `json:"cartToken,omitempty"`
	Lines     []CartLineView `json:"lines"`
	Subtotal  MoneyView      `json:"subtotal"`
	ItemCount int64          `json:"itemCount"`
	// Valid is false if any line has a problem; checkout will be refused.
	Valid bool `json:"valid"`
}

type CartLineView struct {
	LineID        string         `json:"lineId"`
	ProductSlug   string         `json:"productSlug"`
	ProductName   string         `json:"productName"`
	VariationID   string         `json:"variationId"`
	VariationName string         `json:"variationName"`
	Modifiers     []ModifierView `json:"modifiers"`
	Quantity      int64          `json:"quantity"`
	Note          string         `json:"note,omitempty"`
	UnitPrice     MoneyView      `json:"unitPrice"`
	Total         MoneyView      `json:"total"`
	Problem       string         `json:"problem,omitempty"`
}

func NewCartView(p cart.Priced, issuedToken string) CartView {
	v := CartView{
		CartToken: issuedToken,
		Lines:     []CartLineView{},
		Subtotal:  NewMoneyView(p.Subtotal),
		ItemCount: p.Cart.ItemCount(),
		Valid:     p.Valid,
	}
	if v.Subtotal.Currency == "" {
		v.Subtotal = NewMoneyView(models.NewMoney(0, models.USD))
	}
	for _, l := range p.Lines {
		lv := CartLineView{
			LineID:        l.Item.LineID,
			ProductSlug:   l.Product.Slug,
			ProductName:   l.Product.Name,
			VariationID:   string(l.Item.VariationID),
			VariationName: l.Variation.Name,
			Modifiers:     []ModifierView{},
			Quantity:      l.Item.Quantity,
			Note:          l.Item.Note,
			UnitPrice:     NewMoneyView(l.UnitPrice),
			Total:         NewMoneyView(l.Total),
			Problem:       l.Problem,
		}
		for _, m := range l.Modifiers {
			lv.Modifiers = append(lv.Modifiers, ModifierView{ID: string(m.SquareID), Name: m.Name, Price: NewMoneyView(m.Price)})
		}
		v.Lines = append(v.Lines, lv)
	}
	return v
}

type ETAView struct {
	EstimatedReadyAt time.Time `json:"estimatedReadyAt"`
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

// Format-only check. ozzo's is.Email wraps govalidator.IsExistingEmail, which
// does a live MX/DNS lookup per call — too brittle to run on every checkout.
var (
	emailFormat = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	phoneFormat = regexp.MustCompile(`^\+?[0-9 ().-]{7,20}$`)
)

// CheckoutInput starts checkout for the caller's current cart. Items are not
// sent: the server-side cart is the order. Send an Idempotency-Key header
// (e.g. a UUID generated when the checkout form is shown) and reuse it on
// retries. Signed-in customers may omit fields saved on their profile.
type CheckoutInput struct {
	CustomerName  string `json:"customerName,omitempty"`
	CustomerEmail string `json:"customerEmail,omitempty"`
	CustomerPhone string `json:"customerPhone,omitempty"`
	Notes         string `json:"notes,omitempty"`
}

func (in CheckoutInput) Validate(signedIn bool) error {
	// Guests must identify themselves; customers default to their profile.
	required := validation.When(!signedIn, validation.Required)
	return validation.ValidateStruct(&in,
		validation.Field(&in.CustomerName, required, validation.Length(0, 200)),
		validation.Field(&in.CustomerEmail, required, validation.Length(0, 254), validation.Match(emailFormat)),
		validation.Field(&in.CustomerPhone, validation.Match(phoneFormat)),
		validation.Field(&in.Notes, validation.Length(0, 1000)),
	)
}

type CheckoutView struct {
	OrderID     string `json:"orderId"`
	CheckoutURL string `json:"checkoutUrl"`
	// OrderToken authorizes a guest to view this order: send it as the
	// X-Order-Token header to GET /api/orders/{id}. Store it client-side;
	// it cannot be recovered.
	OrderToken       string    `json:"orderToken,omitempty"`
	EstimatedReadyAt time.Time `json:"estimatedReadyAt"`
	Total            MoneyView `json:"total"`
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

type OrderView struct {
	ID               string             `json:"id"`
	Status           models.OrderStatus `json:"status"`
	CustomerName     string             `json:"customerName"`
	CustomerEmail    string             `json:"customerEmail"`
	Items            []OrderItemView    `json:"items"`
	Subtotal         MoneyView          `json:"subtotal"`
	Tax              MoneyView          `json:"tax"`
	Total            MoneyView          `json:"total"`
	EstimatedReadyAt *time.Time         `json:"estimatedReadyAt,omitempty"`
	PaidAt           *time.Time         `json:"paidAt,omitempty"`
	CompletedAt      *time.Time         `json:"completedAt,omitempty"`
	Created          time.Time          `json:"created"`
	// CheckoutURL is included while payment is pending, so an abandoned
	// checkout can be resumed.
	CheckoutURL string `json:"checkoutUrl,omitempty"`
}

type OrderItemView struct {
	ProductName   string              `json:"productName"`
	ProductSlug   string              `json:"productSlug,omitempty"`
	VariationName string              `json:"variationName,omitempty"`
	Quantity      int64               `json:"quantity"`
	UnitPrice     MoneyView           `json:"unitPrice"`
	Total         MoneyView           `json:"total"`
	Modifiers     []OrderModifierView `json:"modifiers"`
	Note          string              `json:"note,omitempty"`
}

type OrderModifierView struct {
	Name  string    `json:"name"`
	Price MoneyView `json:"price"`
}

func NewOrderView(o models.Order) OrderView {
	v := OrderView{
		ID:            string(o.ID),
		Status:        o.Status,
		CustomerName:  o.Customer.Name,
		CustomerEmail: o.Customer.Email,
		Items:         []OrderItemView{},
		Subtotal:      NewMoneyView(o.Subtotal),
		Tax:           NewMoneyView(o.Tax),
		Total:         NewMoneyView(o.Total),
		PaidAt:        timePtr(o.PaidAt),
		CompletedAt:   timePtr(o.CompletedAt),
		Created:       o.Created.UTC(),
	}
	if !o.Status.IsTerminal() && o.Status != models.OrderReady {
		v.EstimatedReadyAt = timePtr(o.EstimatedReadyAt)
	}
	if o.Status == models.OrderPendingPayment {
		v.CheckoutURL = o.Square.CheckoutURL
	}
	for _, it := range o.Items {
		iv := OrderItemView{
			ProductName:   it.ProductName,
			ProductSlug:   it.ProductSlug,
			VariationName: it.VariationName,
			Quantity:      it.Quantity,
			UnitPrice:     NewMoneyView(it.UnitPrice),
			Total:         NewMoneyView(it.Total),
			Modifiers:     []OrderModifierView{},
			Note:          it.Note,
		}
		for _, m := range it.Modifiers {
			iv.Modifiers = append(iv.Modifiers, OrderModifierView{Name: m.Name, Price: NewMoneyView(m.Price)})
		}
		v.Items = append(v.Items, iv)
	}
	return v
}
