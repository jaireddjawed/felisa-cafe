package checkout_test

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
	"felisa-cafe/backend/internal/services/cart"
	"felisa-cafe/backend/internal/services/checkout"
	"felisa-cafe/backend/internal/services/orders"
	"felisa-cafe/backend/internal/testutil"
)

var ctx = context.Background()

const key = "checkout-key-0000000001"

func fillCart(t *testing.T, env *testutil.Env, owner models.CartOwner) {
	t.Helper()
	if _, err := env.Carts.Add(ctx, owner, cart.AddItem{
		VariationID: testutil.LatteMatcha, ModifierIDs: []models.SquareModifierID{testutil.OatMilk, testutil.UbeCream}, Quantity: 2, Note: "less ice",
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := env.Carts.Add(ctx, owner, cart.AddItem{VariationID: testutil.SyrupRegular, Quantity: 1}); err != nil {
		t.Fatal(err)
	}
}

func guestRequest(owner models.CartOwner, k string) checkout.Request {
	return checkout.Request{
		Owner:          owner,
		Contact:        models.Contact{Name: "Ana", Email: "ana@example.com"},
		IdempotencyKey: k,
	}
}

func countOrders(t *testing.T, env *testutil.Env) int {
	t.Helper()
	var n int
	if err := env.App.DB().NewQuery("SELECT count(*) FROM orders").Row(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestGuestCheckout(t *testing.T) {
	env := testutil.NewEnv(t)
	guest := models.CartOwner{Token: "guest"}
	fillCart(t, env, guest)

	res, err := env.Checkout.Checkout(ctx, guestRequest(guest, key))
	if err != nil {
		t.Fatal(err)
	}
	o := res.Order
	if o.Status != models.OrderPendingPayment || o.UserID != "" || o.Square.OrderID == "" {
		t.Fatalf("order = %+v", o)
	}
	if res.AccessToken == "" || o.AccessTokenHash == "" || o.AccessTokenHash == res.AccessToken {
		t.Error("guests get an access token; only its hash is stored")
	}
	// Snapshot: server-side prices ($8.50 + $0 oat + $1 ube) × 2 + $16.
	if o.Subtotal.Amount != 2*950+1600 || len(o.Items) != 2 || o.Items[0].ProductName != "Felisa Latte" || o.Items[0].Note != "less ice" {
		t.Errorf("snapshot = %+v", o)
	}
	if o.EstimatedReadyAt.IsZero() {
		t.Error("checkout must estimate a ready time")
	}

	// The Square order references catalog IDs, built from the snapshot.
	req := env.Square.Requests[0]
	if req.IdempotencyKey != "felisa-order-"+string(o.ID) || req.LocalOrderID != o.ID ||
		req.Lines[0].VariationID != testutil.LatteMatcha || req.Lines[0].Quantity != 2 {
		t.Errorf("square request = %+v", req)
	}

	if c, _ := env.Carts.Get(ctx, guest); !c.IsEmpty() {
		t.Error("cart should be cleared once the order snapshot exists")
	}
	// Returning from Square proves nothing: still unpaid until Square says so.
	got, err := env.Orders.GetForViewer(ctx, o.ID, orders.Viewer{AccessToken: res.AccessToken})
	if err != nil || got.Status != models.OrderPendingPayment {
		t.Errorf("after redirect without payment: %v, %v", got.Status, err)
	}
}

func TestCheckoutIsIdempotentPerKey(t *testing.T) {
	env := testutil.NewEnv(t)
	guest := models.CartOwner{Token: "guest"}
	fillCart(t, env, guest)

	first, err := env.Checkout.Checkout(ctx, guestRequest(guest, key))
	if err != nil {
		t.Fatal(err)
	}
	second, err := env.Checkout.Checkout(ctx, guestRequest(guest, key))
	if err != nil {
		t.Fatal(err)
	}
	if second.Order.ID != first.Order.ID || second.Order.Square.OrderID != first.Order.Square.OrderID {
		t.Error("a retry must return the original order")
	}
	if env.Square.CreateHits != 1 || countOrders(t, env) != 1 {
		t.Errorf("square orders=%d local orders=%d, want 1/1", env.Square.CreateHits, countOrders(t, env))
	}
	// The retry's token is the valid one (the first response was presumably lost).
	if _, err := env.Orders.GetForViewer(ctx, first.Order.ID, orders.Viewer{AccessToken: second.AccessToken}); err != nil {
		t.Errorf("new token rejected: %v", err)
	}
}

// The Square call succeeds but the response is lost (timeout). Retrying
// must not create a second Square order.
func TestCheckoutRecoversFromAmbiguousTimeout(t *testing.T) {
	env := testutil.NewEnv(t)
	guest := models.CartOwner{Token: "guest"}
	fillCart(t, env, guest)
	env.Square.TimeoutAfterCreate = true

	if _, err := env.Checkout.Checkout(ctx, guestRequest(guest, key)); !errors.Is(err, checkout.ErrUnavailable) {
		t.Fatalf("err = %v, want ErrUnavailable", err)
	}
	pending, err := env.Store.Orders.FindByIdempotencyKey(ctx, key)
	if err != nil || pending.Square.OrderID != "" || pending.Status != models.OrderPendingPayment {
		t.Fatalf("pending order = %+v, %v", pending, err)
	}
	if c, _ := env.Carts.Get(ctx, guest); c.IsEmpty() {
		t.Error("cart must survive a failed checkout")
	}

	res, err := env.Checkout.Checkout(ctx, guestRequest(guest, key))
	if err != nil {
		t.Fatal(err)
	}
	if env.Square.CreateHits != 1 {
		t.Errorf("square created %d orders, want 1", env.Square.CreateHits)
	}
	if res.Order.ID != pending.ID || res.Order.Square.OrderID != "sq-order-1" {
		t.Errorf("retry = %+v", res.Order)
	}
	// Square only replays for an identical body, so the retry's request
	// must match the original exactly.
	if !reflect.DeepEqual(env.Square.Requests[0], env.Square.Requests[1]) {
		t.Errorf("retry request differs:\n%+v\n%+v", env.Square.Requests[0], env.Square.Requests[1])
	}
}

func TestCheckoutRefusesStaleCatalog(t *testing.T) {
	env := testutil.NewEnv(t)
	guest := models.CartOwner{Token: "guest"}
	fillCart(t, env, guest)

	// Price rises in Square; our cache hasn't caught up.
	env.Square.Catalog.Items[0].Variations[1].Price = models.NewMoney(900, models.USD)

	if _, err := env.Checkout.Checkout(ctx, guestRequest(guest, key)); !errors.Is(err, checkout.ErrPricesChanged) {
		t.Fatalf("err = %v, want ErrPricesChanged", err)
	}
	if countOrders(t, env) != 0 || env.Square.CreateHits != 0 {
		t.Error("no order may be created from stale prices")
	}
	if env.StaleCatalogCalls.Load() != 1 {
		t.Error("a stale cache should trigger a catalog refresh")
	}
}

func TestCheckoutRefusesWhenSquareUnreachable(t *testing.T) {
	env := testutil.NewEnv(t)
	guest := models.CartOwner{Token: "guest"}
	fillCart(t, env, guest)
	env.Square.LookupErr = payments.ErrUnavailable

	if _, err := env.Checkout.Checkout(ctx, guestRequest(guest, key)); !errors.Is(err, checkout.ErrUnavailable) {
		t.Fatalf("err = %v", err)
	}
	if countOrders(t, env) != 0 {
		t.Error("no order without verified prices")
	}
	// The menu itself keeps working from the cache.
	if list, err := env.Catalog.List(ctx); err != nil || len(list) == 0 {
		t.Errorf("menu unavailable: %v", err)
	}
}

func TestRejectedCheckoutIsFinal(t *testing.T) {
	env := testutil.NewEnv(t)
	guest := models.CartOwner{Token: "guest"}
	fillCart(t, env, guest)
	env.Square.CreateErr = payments.ErrRejected

	if _, err := env.Checkout.Checkout(ctx, guestRequest(guest, key)); !errors.Is(err, checkout.ErrRejected) {
		t.Fatalf("err = %v", err)
	}
	o, _ := env.Store.Orders.FindByIdempotencyKey(ctx, key)
	if o.Status != models.OrderCancelled {
		t.Errorf("status = %v", o.Status)
	}
	env.Square.CreateErr = nil
	if _, err := env.Checkout.Checkout(ctx, guestRequest(guest, key)); !errors.Is(err, checkout.ErrIdempotencyConflict) {
		t.Errorf("reusing a failed key: err = %v", err)
	}
	if _, err := env.Checkout.Checkout(ctx, guestRequest(guest, key+"-new")); err != nil {
		t.Errorf("a fresh key should work: %v", err)
	}
}

func TestAuthenticatedCheckout(t *testing.T) {
	env := testutil.NewEnv(t)
	user, _ := testutil.NewUser(t, env.App, "rosa@example.com", "Rosa")
	owner := models.CartOwner{UserID: user}
	fillCart(t, env, owner)

	res, err := env.Checkout.Checkout(ctx, checkout.Request{Owner: owner, UserID: user, IdempotencyKey: key})
	if err != nil {
		t.Fatal(err)
	}
	if res.Order.UserID != user || res.AccessToken != "" {
		t.Errorf("account order = %+v token=%q", res.Order, res.AccessToken)
	}
	if res.Order.Customer.Name != "Rosa" || res.Order.Customer.Email != "rosa@example.com" {
		t.Errorf("contact should default to the profile: %+v", res.Order.Customer)
	}

	// Someone else can't replay another customer's key.
	other, _ := testutil.NewUser(t, env.App, "eve@example.com", "Eve")
	if _, err := env.Checkout.Checkout(ctx, checkout.Request{Owner: models.CartOwner{UserID: other}, UserID: other, IdempotencyKey: key}); !errors.Is(err, checkout.ErrIdempotencyConflict) {
		t.Errorf("err = %v", err)
	}
	if _, err := env.Checkout.Checkout(ctx, guestRequest(models.CartOwner{Token: "x"}, key)); !errors.Is(err, checkout.ErrIdempotencyConflict) {
		t.Errorf("guest replaying a customer's key: err = %v", err)
	}
}

func TestCheckoutInputErrors(t *testing.T) {
	env := testutil.NewEnv(t)
	guest := models.CartOwner{Token: "guest"}

	if _, err := env.Checkout.Checkout(ctx, guestRequest(guest, key)); !errors.Is(err, checkout.ErrEmptyCart) {
		t.Errorf("empty cart: %v", err)
	}
	if _, err := env.Checkout.Checkout(ctx, guestRequest(guest, "short")); !errors.Is(err, checkout.ErrIdempotencyConflict) {
		t.Errorf("weak key: %v", err)
	}
	fillCart(t, env, guest)
	req := guestRequest(guest, key)
	req.Contact = models.Contact{}
	if _, err := env.Checkout.Checkout(ctx, req); !errors.Is(err, checkout.ErrInvalidContact) {
		t.Errorf("no contact: %v", err)
	}
}
