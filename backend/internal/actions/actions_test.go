package actions_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/actions"
	"felisa-cafe/backend/internal/providers/payments"
	"felisa-cafe/backend/internal/providers/payments/paymentstest"
	"felisa-cafe/backend/internal/routes"
	"felisa-cafe/backend/internal/testutil"
	"felisa-cafe/backend/internal/views"
)

type server struct {
	t   *testing.T
	env *testutil.Env
	mux http.Handler
}

func newServer(t *testing.T) *server {
	t.Helper()
	env := testutil.NewEnv(t)
	routes.Register(env.App, env.Handlers())

	router, err := apis.NewRouter(env.App)
	if err != nil {
		t.Fatal(err)
	}
	var mux http.Handler
	err = env.App.OnServe().Trigger(&core.ServeEvent{App: env.App, Router: router}, func(e *core.ServeEvent) error {
		m, err := e.Router.BuildMux()
		mux = m
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	return &server{t: t, env: env, mux: mux}
}

func (s *server) do(method, path string, body any, headers map[string]string) (int, []byte) {
	s.t.Helper()
	var r io.Reader
	switch b := body.(type) {
	case nil:
	case string:
		r = strings.NewReader(b)
	default:
		raw, _ := json.Marshal(b)
		r = strings.NewReader(string(raw))
	}
	req := httptest.NewRequest(method, path, r)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	s.mux.ServeHTTP(rec, req)
	return rec.Code, rec.Body.Bytes()
}

func decode[T any](t *testing.T, raw []byte) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatalf("decode %s: %v", raw, err)
	}
	return v
}

func TestGuestFlowOverHTTP(t *testing.T) {
	s := newServer(t)

	status, body := s.do("GET", "/api/menu/products?category=signature", nil, nil)
	menu := decode[[]views.ProductView](t, body)
	if status != 200 || len(menu) != 1 || menu[0].Variations[0].Price.Formatted != "$8.50" {
		t.Fatalf("menu: %d %s", status, body)
	}

	// Prices sent by the browser are simply not part of the API.
	status, body = s.do("POST", "/api/cart/items", map[string]any{
		"variationId": string(testutil.LatteEspresso), "modifierIds": []string{string(testutil.OatMilk)},
		"quantity": 2, "unitPrice": 1,
	}, nil)
	cart := decode[views.CartView](t, body)
	if status != 200 || cart.CartToken == "" || cart.Subtotal.Amount != 1700 {
		t.Fatalf("add: %d %s", status, body)
	}
	cartHeader := map[string]string{actions.CartTokenHeader: cart.CartToken}

	if status, _ := s.do("POST", "/api/checkout", map[string]string{"customerName": "Ana", "customerEmail": "ana@example.com"}, cartHeader); status != 400 {
		t.Errorf("checkout without Idempotency-Key: %d", status)
	}
	if status, _ := s.do("POST", "/api/checkout", map[string]string{"customerName": "Ana"},
		map[string]string{actions.CartTokenHeader: cart.CartToken, actions.IdempotencyHeader: "idem-0000000000000001"}); status != 400 {
		t.Errorf("guest checkout without email: %d", status)
	}

	status, body = s.do("POST", "/api/checkout", map[string]string{"customerName": "Ana", "customerEmail": "ana@example.com"},
		map[string]string{actions.CartTokenHeader: cart.CartToken, actions.IdempotencyHeader: "idem-0000000000000001"})
	co := decode[views.CheckoutView](t, body)
	if status != 201 || co.OrderToken == "" || co.Total.Amount != 1700 || co.Square.LocationID == "" {
		t.Fatalf("checkout: %d %s", status, body)
	}

	path := "/api/orders/" + co.OrderID
	if status, _ := s.do("GET", path, nil, nil); status != 404 {
		t.Errorf("order without token: %d, want 404", status)
	}
	status, body = s.do("GET", path, nil, map[string]string{actions.OrderTokenHeader: co.OrderToken})
	if o := decode[views.OrderView](t, body); status != 200 || o.Status != "pending_payment" {
		t.Errorf("order: %d %s", status, body)
	}

	status, body = s.do("POST", "/api/checkout/pay",
		map[string]any{"orderId": co.OrderID, "sourceId": "cnon:card-nonce-ok", "tipAmount": 200},
		map[string]string{actions.OrderTokenHeader: co.OrderToken, actions.IdempotencyHeader: "pay-0000000000000001"})
	if status != 200 {
		t.Fatalf("pay: %d %s", status, body)
	}
	status, body = s.do("GET", path, nil, map[string]string{actions.OrderTokenHeader: co.OrderToken})
	if o := decode[views.OrderView](t, body); status != 200 || o.Status != "paid" || o.PaidAt == nil || o.Total.Amount != 1900 {
		t.Errorf("paid order: %d %s", status, body)
	}
}

func TestWebhookEndpoint(t *testing.T) {
	s := newServer(t)

	ev, _ := json.Marshal(payments.WebhookEvent{ID: "evt-http", Type: "order.updated", Kind: payments.WebhookOrderChanged, OrderID: "UNKNOWN"})
	if status, _ := s.do("POST", "/api/webhooks/square", string(ev), map[string]string{"X-Square-Hmacsha256-Signature": "forged"}); status != 401 {
		t.Errorf("forged signature: %d, want 401", status)
	}
	if seen, _ := s.env.Store.WebhookEvents.Seen(t.Context(), "evt-http"); seen {
		t.Error("unverified event was processed")
	}
	if status, body := s.do("POST", "/api/webhooks/square", string(ev), map[string]string{"X-Square-Hmacsha256-Signature": paymentstest.ValidSignature}); status != 200 {
		t.Errorf("valid webhook: %d %s", status, body)
	}
}

func TestOrderHistoryRequiresSignIn(t *testing.T) {
	s := newServer(t)
	if status, _ := s.do("GET", "/api/orders", nil, nil); status != 401 {
		t.Errorf("anonymous history: %d, want 401", status)
	}

	_, rec := testutil.NewUser(t, s.env.App, "rosa@example.com", "Rosa")
	token, err := rec.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	auth := map[string]string{"Authorization": token}

	s.do("POST", "/api/cart/items", map[string]any{"variationId": string(testutil.SyrupRegular), "quantity": 1}, auth)
	auth[actions.IdempotencyHeader] = "idem-rosa-0000000001"
	if status, body := s.do("POST", "/api/checkout", map[string]string{}, auth); status != 201 {
		t.Fatalf("signed-in checkout with profile contact: %d %s", status, body)
	}
	status, body := s.do("GET", "/api/orders", nil, auth)
	history := decode[[]views.OrderView](t, body)
	if status != 200 || len(history) != 1 || history[0].CustomerName != "Rosa" {
		t.Errorf("history: %d %s", status, body)
	}
}
