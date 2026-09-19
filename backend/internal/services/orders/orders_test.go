package orders_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
	"felisa-cafe/backend/internal/services/cart"
	"felisa-cafe/backend/internal/services/checkout"
	"felisa-cafe/backend/internal/services/orders"
	"felisa-cafe/backend/internal/testutil"
)

var ctx = context.Background()

// placeOrder runs a real checkout and returns the local order and, for
// guests, the access token.
func placeOrder(t *testing.T, env *testutil.Env, user models.UserID, key string) (models.Order, string) {
	t.Helper()
	owner := models.CartOwner{UserID: user}
	if user == "" {
		owner = models.CartOwner{Token: "guest-" + key}
	}
	if _, err := env.Carts.Add(ctx, owner, cart.AddItem{
		VariationID: testutil.LatteEspresso, ModifierIDs: []models.SquareModifierID{testutil.WholeMilk}, Quantity: 1,
	}); err != nil {
		t.Fatal(err)
	}
	res, err := env.Checkout.Checkout(ctx, checkout.Request{
		Owner: owner, UserID: user, IdempotencyKey: key,
		Contact: models.Contact{Name: "Ana", Email: "ana@example.com"},
	})
	if err != nil {
		t.Fatal(err)
	}
	return res.Order, res.AccessToken
}

func event(id string, o models.Order) *payments.WebhookEvent {
	return &payments.WebhookEvent{ID: id, Type: "payment.updated", Kind: payments.WebhookOrderChanged, OrderID: o.Square.OrderID}
}

func load(t *testing.T, env *testutil.Env, id models.OrderID) models.Order {
	t.Helper()
	o, err := env.Store.Orders.FindByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	return o
}

func TestWebhookMarksPaidAndIsIdempotent(t *testing.T) {
	env := testutil.NewEnv(t)
	o, _ := placeOrder(t, env, "", "key-webhook-00000001")

	env.Square.Pay(o.Square.OrderID)
	if err := env.Webhooks.Handle(ctx, event("evt-1", o)); err != nil {
		t.Fatal(err)
	}
	paid := load(t, env, o.ID)
	if paid.Status != models.OrderPaid || paid.PaidAt.IsZero() || paid.Square.PaymentID == "" {
		t.Fatalf("after payment webhook: %+v", paid)
	}
	if paid.EstimatedReadyAt.IsZero() {
		t.Error("ETA should be (re)estimated at payment time")
	}

	// Redelivery of the same event is acknowledged without reprocessing.
	calls := env.Square.GetCalls
	if err := env.Webhooks.Handle(ctx, event("evt-1", o)); err != nil {
		t.Fatal(err)
	}
	if env.Square.GetCalls != calls {
		t.Error("duplicate event was reprocessed")
	}
	// A different event for the same state changes nothing.
	if err := env.Webhooks.Handle(ctx, event("evt-2", o)); err != nil {
		t.Fatal(err)
	}
	if again := load(t, env, o.ID); again.Status != models.OrderPaid || !again.PaidAt.Equal(paid.PaidAt) {
		t.Errorf("reprocessing changed the order: %+v", again)
	}
}

// Webhooks carry an order ID only; processing always reads Square's latest
// state, so delivery order doesn't matter.
func TestOutOfOrderWebhooksConverge(t *testing.T) {
	env := testutil.NewEnv(t)
	o, _ := placeOrder(t, env, "", "key-ooo-000000000001")

	env.Square.Pay(o.Square.OrderID)
	env.Square.SetFulfillment(o.Square.OrderID, payments.FulfillmentPrepared)

	// The later "fulfillment updated" event arrives first...
	if err := env.Webhooks.Handle(ctx, event("evt-fulfillment", o)); err != nil {
		t.Fatal(err)
	}
	// ...then the older "payment" event.
	if err := env.Webhooks.Handle(ctx, event("evt-payment", o)); err != nil {
		t.Fatal(err)
	}
	if got := load(t, env, o.ID); got.Status != models.OrderReady || got.PaidAt.IsZero() {
		t.Errorf("status = %v, want ready", got.Status)
	}
}

func TestApplyIgnoresStaleVersions(t *testing.T) {
	o := models.Order{Status: models.OrderReady, Square: models.SquareOrderRefs{OrderID: "SQ", OrderVersion: 5}}
	stale := payments.OrderState{ID: "SQ", Version: 3, State: payments.OrderOpen, FullyPaid: true, Fulfillment: payments.FulfillmentProposed}
	if orders.Apply(&o, stale, time.Now()) || o.Status != models.OrderReady {
		t.Errorf("stale state applied: %+v", o)
	}

	// Square never un-pays: a newer read without tenders can't regress.
	paid := models.Order{Status: models.OrderPaid, Square: models.SquareOrderRefs{OrderID: "SQ", OrderVersion: 5}}
	odd := payments.OrderState{ID: "SQ", Version: 6, State: payments.OrderOpen}
	orders.Apply(&paid, odd, time.Now())
	if paid.Status != models.OrderPaid {
		t.Errorf("paid order regressed to %v", paid.Status)
	}
}

func TestProjectStatus(t *testing.T) {
	cases := []struct {
		st   payments.OrderState
		want models.OrderStatus
	}{
		{payments.OrderState{State: payments.OrderOpen}, models.OrderPendingPayment},
		{payments.OrderState{State: payments.OrderOpen, FullyPaid: true, Fulfillment: payments.FulfillmentProposed}, models.OrderPaid},
		{payments.OrderState{State: payments.OrderOpen, FullyPaid: true, Fulfillment: payments.FulfillmentReserved}, models.OrderPreparing},
		{payments.OrderState{State: payments.OrderOpen, FullyPaid: true, Fulfillment: payments.FulfillmentPrepared}, models.OrderReady},
		{payments.OrderState{State: payments.OrderCompleted, FullyPaid: true, Fulfillment: payments.FulfillmentCompleted}, models.OrderCompleted},
		{payments.OrderState{State: payments.OrderOpen, FullyPaid: true, Fulfillment: payments.FulfillmentCanceled}, models.OrderCancelled},
		{payments.OrderState{State: payments.OrderCanceled}, models.OrderCancelled},
	}
	for _, tc := range cases {
		if got := orders.ProjectStatus(tc.st); got != tc.want {
			t.Errorf("%+v -> %v, want %v", tc.st, got, tc.want)
		}
	}
}

func TestFulfillmentLifecycle(t *testing.T) {
	env := testutil.NewEnv(t)
	o, _ := placeOrder(t, env, "", "key-lifecycle-000001")
	env.Square.Pay(o.Square.OrderID)

	steps := []struct {
		state payments.FulfillmentState
		want  models.OrderStatus
	}{
		{payments.FulfillmentReserved, models.OrderPreparing},
		{payments.FulfillmentPrepared, models.OrderReady},
		{payments.FulfillmentCompleted, models.OrderCompleted},
	}
	for i, s := range steps {
		env.Square.SetFulfillment(o.Square.OrderID, s.state)
		if err := env.Webhooks.Handle(ctx, event("evt-step-"+string(rune('a'+i)), o)); err != nil {
			t.Fatal(err)
		}
		if got := load(t, env, o.ID); got.Status != s.want {
			t.Errorf("after %s: status %v, want %v", s.state, got.Status, s.want)
		}
	}
	if load(t, env, o.ID).CompletedAt.IsZero() {
		t.Error("completion time should be recorded")
	}
}

// The customer lands on the confirmation page before the webhook arrives:
// viewing the order re-reads Square, so they see the verified payment.
func TestRedirectBeforeWebhook(t *testing.T) {
	env := testutil.NewEnv(t)
	o, token := placeOrder(t, env, "", "key-redirect-0000001")
	env.Square.Pay(o.Square.OrderID)

	got, err := env.Orders.GetForViewer(ctx, o.ID, orders.Viewer{AccessToken: token})
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != models.OrderPaid {
		t.Errorf("status = %v, want paid (verified with Square)", got.Status)
	}

	// The webhook arriving afterwards is harmless.
	if err := env.Webhooks.Handle(ctx, event("evt-late", o)); err != nil {
		t.Fatal(err)
	}
	if load(t, env, o.ID).Status != models.OrderPaid {
		t.Error("late webhook changed the order")
	}
}

func TestOrderAuthorization(t *testing.T) {
	env := testutil.NewEnv(t)
	alice, _ := testutil.NewUser(t, env.App, "alice@example.com", "Alice")
	mallory, _ := testutil.NewUser(t, env.App, "mallory@example.com", "Mallory")

	guestOrder, token := placeOrder(t, env, "", "key-guest-0000000001")
	aliceOrder, _ := placeOrder(t, env, alice, "key-alice-0000000001")

	denied := map[string]struct {
		id models.OrderID
		v  orders.Viewer
	}{
		"guest order, no token":         {guestOrder.ID, orders.Viewer{}},
		"guest order, wrong token":      {guestOrder.ID, orders.Viewer{AccessToken: "guess"}},
		"guest order, signed-in user":   {guestOrder.ID, orders.Viewer{UserID: mallory}},
		"account order, other customer": {aliceOrder.ID, orders.Viewer{UserID: mallory}},
		"account order, anonymous":      {aliceOrder.ID, orders.Viewer{}},
		"account order, guest token":    {aliceOrder.ID, orders.Viewer{AccessToken: token}},
	}
	for name, tc := range denied {
		if _, err := env.Orders.GetForViewer(ctx, tc.id, tc.v); !errors.Is(err, models.ErrNotFound) {
			t.Errorf("%s: err = %v, want ErrNotFound", name, err)
		}
	}
	if _, err := env.Orders.GetForViewer(ctx, guestOrder.ID, orders.Viewer{AccessToken: token}); err != nil {
		t.Errorf("guest with token: %v", err)
	}
	if _, err := env.Orders.GetForViewer(ctx, aliceOrder.ID, orders.Viewer{UserID: alice}); err != nil {
		t.Errorf("owner: %v", err)
	}

	history, err := env.Orders.ListForUser(ctx, alice)
	if err != nil || len(history) != 1 || history[0].ID != aliceOrder.ID {
		t.Errorf("alice history = %+v, %v", history, err)
	}
	if h, _ := env.Orders.ListForUser(ctx, mallory); len(h) != 0 {
		t.Errorf("mallory sees %d orders", len(h))
	}
	// Order history is a snapshot: renaming the product doesn't rewrite it.
	env.Square.Catalog.Items[0].Name = "Felisa Latte (New!)"
	if _, err := env.Catalog.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	if h, _ := env.Orders.ListForUser(ctx, alice); h[0].Items[0].ProductName != "Felisa Latte" {
		t.Errorf("historical line item changed: %q", h[0].Items[0].ProductName)
	}
}

func TestWebhookForInStoreOrderIsIgnored(t *testing.T) {
	env := testutil.NewEnv(t)
	ev := &payments.WebhookEvent{ID: "evt-pos", Type: "order.updated", Kind: payments.WebhookOrderChanged, OrderID: "POS_ORDER"}
	if err := env.Webhooks.Handle(ctx, ev); err != nil {
		t.Fatal(err)
	}
	if env.Square.GetCalls != 0 {
		t.Error("foreign orders should not cost a Square API call")
	}
	if seen, _ := env.Store.WebhookEvents.Seen(ctx, "evt-pos"); !seen {
		t.Error("ignored events are still acknowledged")
	}
}

// The payment link was created but its response lost, and the customer
// somehow paid (e.g. the retry happened later): the webhook links the
// Square order to ours via reference_id.
func TestWebhookLinksOrderWhoseLinkResponseWasLost(t *testing.T) {
	env := testutil.NewEnv(t)
	owner := models.CartOwner{Token: "guest"}
	if _, err := env.Carts.Add(ctx, owner, cart.AddItem{VariationID: testutil.SyrupRegular, Quantity: 1}); err != nil {
		t.Fatal(err)
	}
	env.Square.TimeoutAfterCreate = true
	key := "key-lost-00000000001"
	_, err := env.Checkout.Checkout(ctx, checkout.Request{Owner: owner, IdempotencyKey: key, Contact: models.Contact{Name: "A", Email: "a@example.com"}})
	if !errors.Is(err, checkout.ErrUnavailable) {
		t.Fatalf("err = %v", err)
	}

	env.Square.Pay("sq-order-1")
	ev := &payments.WebhookEvent{ID: "evt-lost", Type: "payment.updated", Kind: payments.WebhookOrderChanged, OrderID: "sq-order-1"}
	if err := env.Webhooks.Handle(ctx, ev); err != nil {
		t.Fatal(err)
	}
	o, _ := env.Store.Orders.FindByIdempotencyKey(ctx, key)
	if o.Square.OrderID != "sq-order-1" || o.Status != models.OrderPaid {
		t.Errorf("order = %+v", o)
	}
}

func TestReconcileRecoversMissedWebhooks(t *testing.T) {
	env := testutil.NewEnv(t)
	a, _ := placeOrder(t, env, "", "key-reconcile-000001")
	b, _ := placeOrder(t, env, "", "key-reconcile-000002")
	env.Square.Pay(a.Square.OrderID) // no webhook delivered

	n, err := env.Orders.Reconcile(ctx)
	if err != nil || n != 2 {
		t.Fatalf("reconciled %d, %v", n, err)
	}
	if load(t, env, a.ID).Status != models.OrderPaid || load(t, env, b.ID).Status != models.OrderPendingPayment {
		t.Error("reconcile must apply exactly what Square reports")
	}

	// Square being down doesn't break reconciliation, it just retries later.
	env.Square.GetErr = payments.ErrUnavailable
	if _, err := env.Orders.Reconcile(ctx); err != nil {
		t.Errorf("reconcile should log and continue, got %v", err)
	}
}

func TestWebhookErrorsAreRetried(t *testing.T) {
	env := testutil.NewEnv(t)
	o, _ := placeOrder(t, env, "", "key-retry-0000000001")
	env.Square.GetErr = payments.ErrUnavailable
	if err := env.Webhooks.Handle(ctx, event("evt-retry", o)); err == nil {
		t.Fatal("expected an error so Square redelivers")
	}
	if seen, _ := env.Store.WebhookEvents.Seen(ctx, "evt-retry"); seen {
		t.Fatal("failed events must not be marked processed")
	}
	env.Square.GetErr = nil
	env.Square.Pay(o.Square.OrderID)
	if err := env.Webhooks.Handle(ctx, event("evt-retry", o)); err != nil {
		t.Fatal(err)
	}
	if load(t, env, o.ID).Status != models.OrderPaid {
		t.Error("redelivery should succeed")
	}
}
