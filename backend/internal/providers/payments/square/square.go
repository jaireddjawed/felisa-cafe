// Package square implements the payments interfaces with Square's official
// Go SDK (github.com/square/square-go-sdk/v4): Catalog API for products,
// Checkout API payment links over catalog-based Orders for checkout, Orders
// API for authoritative state, and signed webhooks.
//
// This is the only package that imports the Square SDK.
package square

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	sq "github.com/square/square-go-sdk/v4"
	sqclient "github.com/square/square-go-sdk/v4/client"
	sqcore "github.com/square/square-go-sdk/v4/core"
	"github.com/square/square-go-sdk/v4/option"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
)

type Config struct {
	AccessToken   string
	ApplicationID string
	// Environment is "sandbox" or "production".
	Environment string
	LocationID  string
	Currency    models.Currency

	// WebhookSignatureKey and WebhookURL come from the webhook subscription
	// in the Square Developer Dashboard. The URL must match the subscription
	// exactly: it is part of the signed payload.
	WebhookSignatureKey string
	WebhookURL          string

	// Timeout bounds each Square API call (including SDK retries).
	Timeout      time.Duration
	AllowTipping bool

	// BaseURL overrides the API host (tests).
	BaseURL string
}

// Client implements payments.Catalog, payments.Checkout and payments.Webhooks.
type Client struct {
	cfg Config
	sq  *sqclient.Client
}

var (
	_ payments.Catalog  = (*Client)(nil)
	_ payments.Checkout = (*Client)(nil)
	_ payments.Webhooks = (*Client)(nil)
)

func New(cfg Config) (*Client, error) {
	if cfg.AccessToken == "" || cfg.LocationID == "" {
		return nil, fmt.Errorf("%w: SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID are required", payments.ErrNotConfigured)
	}
	if cfg.Currency == "" {
		cfg.Currency = models.USD
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 15 * time.Second
	}
	baseURL := cfg.BaseURL
	if baseURL == "" {
		switch cfg.Environment {
		case "production":
			baseURL = sq.Environments.Production
		case "sandbox", "":
			baseURL = sq.Environments.Sandbox
		default:
			return nil, fmt.Errorf("SQUARE_ENVIRONMENT must be sandbox or production, got %q", cfg.Environment)
		}
	}
	client := sqclient.NewClient(
		option.WithToken(cfg.AccessToken),
		option.WithBaseURL(baseURL),
		// Hard per-attempt ceiling; the context passed to each call bounds
		// the total including SDK retries (which only happen for 408/429/5xx
		// and are safe because every mutating call carries an idempotency key).
		option.WithHTTPClient(&http.Client{Timeout: cfg.Timeout}),
		option.WithMaxAttempts(2),
	)
	return &Client{cfg: cfg, sq: client}, nil
}

func (c *Client) IsProduction() bool { return c.cfg.Environment == "production" }

func (c *Client) withTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, c.cfg.Timeout)
}

// classify wraps a Square SDK error in payments.ErrUnavailable or
// payments.ErrRejected. The SDK's error text is kept (it contains Square's
// error codes, never credentials).
func classify(op string, err error) error {
	var apiErr *sqcore.APIError
	if errors.As(err, &apiErr) {
		if apiErr.StatusCode == http.StatusTooManyRequests || apiErr.StatusCode == http.StatusRequestTimeout || apiErr.StatusCode >= 500 {
			return fmt.Errorf("square %s: %w: %w", op, payments.ErrUnavailable, err)
		}
		return fmt.Errorf("square %s: %w: %w", op, payments.ErrRejected, err)
	}
	// Network error, timeout, context deadline: outcome unknown.
	return fmt.Errorf("square %s: %w: %w", op, payments.ErrUnavailable, err)
}

// errorsIn turns Square's in-body errors into a rejected error.
func errorsIn(op string, errs []*sq.Error) error {
	if len(errs) == 0 {
		return nil
	}
	e := errs[0]
	detail := ""
	if e.Detail != nil {
		detail = *e.Detail
	}
	return fmt.Errorf("square %s: %w: %s %s", op, payments.ErrRejected, e.Code, detail)
}

func money(m *sq.Money, fallback models.Currency) models.Money {
	if m == nil {
		return models.NewMoney(0, fallback)
	}
	cur := fallback
	if m.Currency != nil {
		cur = models.Currency(*m.Currency)
	}
	var amount int64
	if m.Amount != nil {
		amount = *m.Amount
	}
	return models.NewMoney(amount, cur)
}

func parseTime(s *string) time.Time {
	if s == nil || *s == "" {
		return time.Time{}
	}
	t, err := time.Parse(time.RFC3339Nano, *s)
	if err != nil {
		return time.Time{}
	}
	return t
}

func deref[T any](p *T) T {
	var zero T
	if p == nil {
		return zero
	}
	return *p
}
