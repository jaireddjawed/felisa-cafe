// Package actions is the HTTP boundary. Each action parses and validates
// input, calls one service, and renders the result. No business rules,
// queries or Square calls live here.
package actions

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/database"
	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
	"felisa-cafe/backend/internal/services/cart"
	"felisa-cafe/backend/internal/services/catalog"
	"felisa-cafe/backend/internal/services/checkout"
	"felisa-cafe/backend/internal/services/eta"
	"felisa-cafe/backend/internal/services/orders"
	"felisa-cafe/backend/internal/services/webhooks"
	"felisa-cafe/backend/internal/tokens"
)

// Request headers used by the storefront API.
const (
	CartTokenHeader   = "X-Cart-Token"
	OrderTokenHeader  = "X-Order-Token"
	IdempotencyHeader = "Idempotency-Key"
)

type Handlers struct {
	Catalog  *catalog.Service
	Carts    *cart.Service
	Checkout *checkout.Service
	Orders   *orders.Service
	Webhooks *webhooks.Service
	ETA      eta.Estimator
	// WebhookParser verifies webhook signatures; nil if Square is not configured.
	WebhookParser payments.Webhooks
	Log           *slog.Logger
}

// userID is the signed-in customer, if any.
func userID(e *core.RequestEvent) models.UserID {
	id, _ := database.UserIDFromAuth(e.Auth)
	return id
}

// cartOwner identifies the caller's cart. With mint set, a guest without a
// cart token is issued one (returned as the second value).
func cartOwner(e *core.RequestEvent, mint bool) (models.CartOwner, string) {
	if id := userID(e); id != "" {
		return models.CartOwner{UserID: id}, ""
	}
	token := strings.TrimSpace(e.Request.Header.Get(CartTokenHeader))
	if len(token) > 128 {
		token = ""
	}
	if token == "" && mint {
		token = tokens.New()
		return models.CartOwner{Token: token}, token
	}
	return models.CartOwner{Token: token}, ""
}

// fail maps service errors to HTTP responses. Unexpected errors are logged
// and answered with a generic 500 so internals never leak to clients.
func (h *Handlers) fail(e *core.RequestEvent, err error) error {
	status, msg := http.StatusInternalServerError, "Something went wrong. Please try again."
	switch {
	case errors.Is(err, models.ErrNotFound), errors.Is(err, cart.ErrLineMissing):
		status, msg = http.StatusNotFound, "Not found."
	case errors.Is(err, cart.ErrInvalidItem):
		status, msg = http.StatusUnprocessableEntity, publicMessage(err)
	case errors.Is(err, cart.ErrCartFull):
		status, msg = http.StatusUnprocessableEntity, "Your cart is full."
	case errors.Is(err, checkout.ErrEmptyCart):
		status, msg = http.StatusBadRequest, "Your cart is empty."
	case errors.Is(err, checkout.ErrInvalidContact):
		status, msg = http.StatusBadRequest, "Please enter your name and email."
	case errors.Is(err, checkout.ErrCartInvalid):
		status, msg = http.StatusConflict, "Some items in your cart are no longer available. Please review your cart."
	case errors.Is(err, checkout.ErrPricesChanged):
		status, msg = http.StatusConflict, "Our menu just changed. Please review your cart and try again."
	case errors.Is(err, checkout.ErrIdempotencyConflict):
		status, msg = http.StatusConflict, "This checkout can't be retried. Please start again."
	case errors.Is(err, checkout.ErrRejected):
		status, msg = http.StatusBadGateway, "Our payment provider couldn't start checkout. Please check your details and try again."
	case errors.Is(err, checkout.ErrUnavailable), errors.Is(err, payments.ErrUnavailable), errors.Is(err, payments.ErrNotConfigured):
		status, msg = http.StatusServiceUnavailable, "Checkout is temporarily unavailable. Please try again in a moment."
	}
	if status >= 500 {
		h.Log.Error("request failed", "method", e.Request.Method, "path", e.Request.URL.Path, "status", status, "error", err)
	}
	return e.Error(status, msg, nil)
}

// publicMessage returns the user-facing part of a validation error.
func publicMessage(err error) string {
	msg := err.Error()
	if i := strings.LastIndex(msg, ": "); i >= 0 {
		msg = msg[i+2:]
	}
	if msg == "" {
		return "That item can't be added."
	}
	return strings.ToUpper(msg[:1]) + msg[1:] + "."
}
