package actions

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/services/cart"
	"felisa-cafe/backend/internal/views"
)

// GetCart handles GET /api/cart.
func (h *Handlers) GetCart(e *core.RequestEvent) error {
	owner, _ := cartOwner(e, false)
	priced, err := h.Carts.Get(e.Request.Context(), owner)
	if err != nil {
		return h.fail(e, err)
	}
	return e.JSON(http.StatusOK, views.NewCartView(priced, ""))
}

// AddCartItem handles POST /api/cart/items. Guests without a cart token get
// one in the response (cartToken).
func (h *Handlers) AddCartItem(e *core.RequestEvent) error {
	var in views.AddCartItemInput
	if err := e.BindBody(&in); err != nil {
		return e.BadRequestError("Invalid request body.", err)
	}
	if err := in.Validate(); err != nil {
		return e.BadRequestError("Invalid cart item.", err)
	}
	mods := make([]models.SquareModifierID, len(in.ModifierIDs))
	for i, id := range in.ModifierIDs {
		mods[i] = models.SquareModifierID(id)
	}

	owner, issued := cartOwner(e, true)
	priced, err := h.Carts.Add(e.Request.Context(), owner, cart.AddItem{
		VariationID: models.SquareVariationID(in.VariationID),
		ModifierIDs: mods,
		Quantity:    in.Quantity,
		Note:        in.Note,
	})
	if err != nil {
		return h.fail(e, err)
	}
	return e.JSON(http.StatusOK, views.NewCartView(priced, issued))
}

// UpdateCartItem handles PATCH /api/cart/items/{lineId}.
func (h *Handlers) UpdateCartItem(e *core.RequestEvent) error {
	var in views.UpdateCartItemInput
	if err := e.BindBody(&in); err != nil {
		return e.BadRequestError("Invalid request body.", err)
	}
	if err := in.Validate(); err != nil {
		return e.BadRequestError("Invalid quantity.", err)
	}
	owner, _ := cartOwner(e, false)
	if owner.IsZero() {
		return h.fail(e, cart.ErrLineMissing)
	}
	priced, err := h.Carts.SetQuantity(e.Request.Context(), owner, e.Request.PathValue("lineId"), in.Quantity)
	if err != nil {
		return h.fail(e, err)
	}
	return e.JSON(http.StatusOK, views.NewCartView(priced, ""))
}

// RemoveCartItem handles DELETE /api/cart/items/{lineId}.
func (h *Handlers) RemoveCartItem(e *core.RequestEvent) error {
	owner, _ := cartOwner(e, false)
	if owner.IsZero() {
		return h.fail(e, cart.ErrLineMissing)
	}
	priced, err := h.Carts.Remove(e.Request.Context(), owner, e.Request.PathValue("lineId"))
	if err != nil {
		return h.fail(e, err)
	}
	return e.JSON(http.StatusOK, views.NewCartView(priced, ""))
}

// MergeCart handles POST /api/cart/merge (signed in, with X-Cart-Token):
// moves the guest cart into the customer's cart after sign-in.
func (h *Handlers) MergeCart(e *core.RequestEvent) error {
	user := userID(e)
	token := e.Request.Header.Get(CartTokenHeader)
	if user == "" || token == "" {
		return e.BadRequestError("Sign in and send the guest cart token to merge carts.", nil)
	}
	priced, err := h.Carts.Merge(e.Request.Context(), token, user)
	if err != nil {
		return h.fail(e, err)
	}
	return e.JSON(http.StatusOK, views.NewCartView(priced, ""))
}

// CartETA handles GET /api/cart/eta: when the current cart would be ready
// if ordered now.
func (h *Handlers) CartETA(e *core.RequestEvent) error {
	owner, _ := cartOwner(e, false)
	priced, err := h.Carts.Get(e.Request.Context(), owner)
	if err != nil {
		return h.fail(e, err)
	}
	ready, err := h.ETA.Estimate(e.Request.Context(), priced.OrderItems())
	if err != nil {
		return h.fail(e, err)
	}
	return e.JSON(http.StatusOK, views.ETAView{EstimatedReadyAt: ready.UTC()})
}
