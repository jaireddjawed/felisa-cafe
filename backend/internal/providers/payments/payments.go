// Package payments defines the boundary between the application and its
// commerce platform. Square (subpackage square) is the implementation; the
// services depend only on the interfaces here, which keeps Square SDK types
// out of business logic and lets tests use paymentstest.Fake.
//
// Square is the source of truth for catalog, prices, orders and payments.
package payments

import (
	"context"
	"errors"
	"time"

	"felisa-cafe/backend/internal/models"
)

// Error classes. Provider errors wrap exactly one of these so callers can
// decide whether retrying is meaningful.
var (
	// ErrUnavailable: timeout, network failure, 5xx or rate limit. The
	// request may or may not have taken effect remotely; retry with the
	// same idempotency key.
	ErrUnavailable = errors.New("payment provider unavailable")
	// ErrRejected: the provider refused the request (validation, auth,
	// 4xx). Retrying the same request will not help.
	ErrRejected = errors.New("payment provider rejected request")
	// ErrNotConfigured: credentials are missing, so the provider is off.
	ErrNotConfigured = errors.New("payment provider not configured")
	// ErrInvalidSignature: a webhook failed signature verification.
	ErrInvalidSignature = errors.New("invalid webhook signature")
)

// Catalog reads the authoritative product catalog.
type Catalog interface {
	// FetchCatalog returns every non-deleted item and modifier list.
	FetchCatalog(ctx context.Context) (*CatalogSnapshot, error)
	// LookupPrices re-reads the given variations and modifiers directly
	// from the provider (bypassing our cache) for checkout revalidation.
	LookupPrices(ctx context.Context, variations []models.SquareVariationID, modifiers []models.SquareModifierID) (*PriceCheck, error)
}

// Checkout creates hosted checkouts and reads back order state.
type Checkout interface {
	CreatePaymentLink(ctx context.Context, req PaymentLinkRequest) (*PaymentLink, error)
	GetOrder(ctx context.Context, id models.SquareOrderID) (*OrderState, error)
}

// Webhooks authenticates and decodes webhook deliveries.
type Webhooks interface {
	ParseWebhook(ctx context.Context, body []byte, signature string) (*WebhookEvent, error)
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

type CatalogSnapshot struct {
	Items         []CatalogItem
	ModifierLists []models.ModifierList
}

type CatalogItem struct {
	ID          models.SquareItemID
	Version     int64
	Name        string
	Description string
	// CategoryNames are the item's category names in Square, used to map
	// the item onto a menu section.
	CategoryNames []string
	// Available is false if the item is archived or not offered at our
	// location.
	Available     bool
	Variations    []models.ProductVariation
	ModifierLists []ItemModifierList
}

// ItemModifierList attaches a modifier list to an item. Min/Max are the
// item-level overrides, nil when the list's own limits apply.
type ItemModifierList struct {
	ListID      models.SquareModifierListID
	MinSelected *int64
	MaxSelected *int64
}

// PriceCheck is the live state of catalog objects referenced by a cart.
// IDs that do not exist (or are deleted) are absent from the maps.
type PriceCheck struct {
	Variations map[models.SquareVariationID]LiveVariation
	Modifiers  map[models.SquareModifierID]LiveModifier
}

type LiveVariation struct {
	ItemID models.SquareItemID
	Price  models.Money
	// Sellable is false if the variation or its item is archived, sold out,
	// variable-priced or unavailable at our location.
	Sellable bool
}

type LiveModifier struct {
	Price     models.Money
	Available bool
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

type PaymentLinkRequest struct {
	// IdempotencyKey must be stable for a given local order so a retried
	// request (e.g. after a timeout) returns the link created the first
	// time instead of a second order.
	IdempotencyKey string
	LocalOrderID   models.OrderID
	Lines          []PaymentLinkLine
	Customer       models.Contact
	Notes          string
	// PrepTime is how long from now the order is expected to take; sent to
	// Square as the pickup fulfillment's prep time.
	PrepTime    time.Duration
	RedirectURL string
}

type PaymentLinkLine struct {
	VariationID models.SquareVariationID
	ModifierIDs []models.SquareModifierID
	Quantity    int64
	Note        string
}

type PaymentLink struct {
	ID    string
	URL   string
	Order OrderState
}

// OrderLifecycle mirrors Square's order state.
type OrderLifecycle string

const (
	OrderOpen      OrderLifecycle = "OPEN"
	OrderCompleted OrderLifecycle = "COMPLETED"
	OrderCanceled  OrderLifecycle = "CANCELED"
	OrderDraft     OrderLifecycle = "DRAFT"
)

// FulfillmentState mirrors Square's pickup fulfillment state.
type FulfillmentState string

const (
	FulfillmentProposed  FulfillmentState = "PROPOSED"
	FulfillmentReserved  FulfillmentState = "RESERVED"
	FulfillmentPrepared  FulfillmentState = "PREPARED"
	FulfillmentCompleted FulfillmentState = "COMPLETED"
	FulfillmentCanceled  FulfillmentState = "CANCELED"
	FulfillmentFailed    FulfillmentState = "FAILED"
)

// OrderState is the provider's authoritative view of an order.
type OrderState struct {
	ID          models.SquareOrderID
	Version     int64
	ReferenceID string
	State       OrderLifecycle
	// FullyPaid is true only when the provider reports completed tenders
	// covering the whole amount due. This, never a browser redirect, is
	// what marks a local order paid.
	FullyPaid bool
	PaymentID string
	Total     models.Money
	Tax       models.Money

	Fulfillment FulfillmentState // "" if the order has no pickup fulfillment
	PickupAt    time.Time
	PickedUpAt  time.Time
	ClosedAt    time.Time
	UpdatedAt   time.Time
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

type WebhookKind int

const (
	WebhookIgnored WebhookKind = iota
	// WebhookOrderChanged: an order, its payment or its fulfillment changed.
	WebhookOrderChanged
	// WebhookCatalogChanged: the catalog changed; resync.
	WebhookCatalogChanged
)

type WebhookEvent struct {
	ID      string
	Type    string
	Kind    WebhookKind
	OrderID models.SquareOrderID // set for WebhookOrderChanged
}
