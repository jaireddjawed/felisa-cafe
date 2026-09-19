package square

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	sq "github.com/square/square-go-sdk/v4"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
)

const (
	testLocation = "LOC_MAIN"
	testKey      = "whsec_test_key"
	testHookURL  = "https://api.felisa.test/api/webhooks/square"
)

func newTestClient(t *testing.T, baseURL string) *Client {
	t.Helper()
	c, err := New(Config{
		AccessToken: "EAAA-test-token", Environment: "sandbox", LocationID: testLocation,
		WebhookSignatureKey: testKey, WebhookURL: testHookURL,
		Timeout: 2 * time.Second, BaseURL: baseURL,
	})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func sign(body string) string {
	mac := hmac.New(sha256.New, []byte(testKey))
	mac.Write([]byte(testHookURL + body))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

const paymentUpdated = `{"merchant_id":"M1","type":"payment.updated","event_id":"evt-123","created_at":"2026-09-19T10:00:00Z",
 "data":{"type":"payment","id":"PAY1","object":{"payment":{"id":"PAY1","order_id":"SQORDER1","status":"COMPLETED"}}}}`

func TestParseWebhookVerifiesSignature(t *testing.T) {
	c := newTestClient(t, "http://unused")
	ctx := context.Background()

	ev, err := c.ParseWebhook(ctx, []byte(paymentUpdated), sign(paymentUpdated))
	if err != nil {
		t.Fatalf("valid signature rejected: %v", err)
	}
	if ev.ID != "evt-123" || ev.Kind != payments.WebhookOrderChanged || ev.OrderID != "SQORDER1" {
		t.Errorf("event = %+v", ev)
	}

	tampered := strings.Replace(paymentUpdated, "SQORDER1", "SQORDER2", 1)
	for name, tc := range map[string]struct{ body, sig string }{
		"tampered body":     {tampered, sign(paymentUpdated)},
		"missing signature": {paymentUpdated, ""},
		"garbage signature": {paymentUpdated, "bm9wZQ=="},
		"empty body":        {"", sign("")},
	} {
		if _, err := c.ParseWebhook(ctx, []byte(tc.body), tc.sig); !errors.Is(err, payments.ErrInvalidSignature) {
			t.Errorf("%s: err = %v, want ErrInvalidSignature", name, err)
		}
	}

	// The notification URL is part of the signed payload.
	other := newTestClient(t, "http://unused")
	other.cfg.WebhookURL = "https://attacker.test/hook"
	if _, err := other.ParseWebhook(ctx, []byte(paymentUpdated), sign(paymentUpdated)); !errors.Is(err, payments.ErrInvalidSignature) {
		t.Errorf("signature for a different URL accepted: %v", err)
	}
}

func TestDecodeEvent(t *testing.T) {
	cases := map[string]struct {
		body    string
		kind    payments.WebhookKind
		orderID models.SquareOrderID
	}{
		"order updated": {
			`{"event_id":"e1","type":"order.updated","data":{"type":"order_updated","id":"O1","object":{"order_updated":{"order_id":"O1","state":"OPEN","version":3}}}}`,
			payments.WebhookOrderChanged, "O1",
		},
		"fulfillment updated": {
			`{"event_id":"e2","type":"order.fulfillment.updated","data":{"type":"order_fulfillment_updated","id":"O2","object":{"order_fulfillment_updated":{"order_id":"O2"}}}}`,
			payments.WebhookOrderChanged, "O2",
		},
		"catalog": {
			`{"event_id":"e3","type":"catalog.version.updated","data":{"type":"catalog","id":"","object":{"catalog_version":{"updated_at":"2026-09-19T10:00:00Z"}}}}`,
			payments.WebhookCatalogChanged, "",
		},
		"unrelated": {
			`{"event_id":"e4","type":"customer.created","data":{"type":"customer","id":"C1","object":{"customer":{"id":"C1"}}}}`,
			payments.WebhookIgnored, "",
		},
	}
	for name, tc := range cases {
		ev, err := decodeEvent([]byte(tc.body))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if ev.Kind != tc.kind || ev.OrderID != tc.orderID {
			t.Errorf("%s: got kind=%v order=%q", name, ev.Kind, ev.OrderID)
		}
	}
	if _, err := decodeEvent([]byte(`{"type":"order.updated"}`)); err == nil {
		t.Error("event without event_id must be rejected")
	}
}

// ---------------------------------------------------------------------------
// Catalog mapping
// ---------------------------------------------------------------------------

const catalogJSON = `[
 {"type":"CATEGORY","id":"CAT_SIG","category_data":{"name":"Signature Drinks"}},
 {"type":"MODIFIER_LIST","id":"ML_MILK","version":5,"modifier_list_data":{"name":"Milk","min_selected_modifiers":1,"max_selected_modifiers":1,
   "modifiers":[
     {"type":"MODIFIER","id":"MOD_OAT","modifier_data":{"name":"Oat","price_money":{"amount":0,"currency":"USD"}}},
     {"type":"MODIFIER","id":"MOD_SOLDOUT","modifier_data":{"name":"Soy","price_money":{"amount":0,"currency":"USD"},
        "location_overrides":[{"location_id":"LOC_MAIN","sold_out":true}]}}]}},
 {"type":"MODIFIER_LIST","id":"ML_ADDONS","modifier_list_data":{"name":"Add-Ons","min_selected_modifiers":-1,"max_selected_modifiers":-1,
   "modifiers":[{"type":"MODIFIER","id":"MOD_FOAM","modifier_data":{"name":"Foam","price_money":{"amount":100,"currency":"USD"},
      "location_overrides":[{"location_id":"LOC_MAIN","price_money":{"amount":125,"currency":"USD"}}]}}]}},
 {"type":"ITEM","id":"ITEM_LATTE","version":9,"item_data":{"name":"Felisa Latte","description_plaintext":"Ube.",
   "categories":[{"id":"CAT_SIG"}],
   "modifier_list_info":[{"modifier_list_id":"ML_MILK","min_selected_modifiers":0,"max_selected_modifiers":1},{"modifier_list_id":"ML_ADDONS","min_selected_modifiers":-1,"max_selected_modifiers":-1},{"modifier_list_id":"ML_OFF","enabled":false}],
   "variations":[
     {"type":"ITEM_VARIATION","id":"VAR_ESP","version":9,"item_variation_data":{"name":"Espresso","pricing_type":"FIXED_PRICING","price_money":{"amount":850,"currency":"USD"},
        "location_overrides":[{"location_id":"LOC_MAIN","price_money":{"amount":900,"currency":"USD"}},{"location_id":"LOC_OTHER","price_money":{"amount":1,"currency":"USD"}}]}},
     {"type":"ITEM_VARIATION","id":"VAR_CUSTOM","item_variation_data":{"name":"Custom","pricing_type":"VARIABLE_PRICING"}},
     {"type":"ITEM_VARIATION","id":"VAR_ELSEWHERE","present_at_all_locations":false,"present_at_location_ids":["LOC_OTHER"],
        "item_variation_data":{"name":"Elsewhere","pricing_type":"FIXED_PRICING","price_money":{"amount":850,"currency":"USD"}}}]}},
 {"type":"ITEM","id":"ITEM_ARCHIVED","item_data":{"name":"Old Drink","is_archived":true,"variations":[]}},
 {"type":"ITEM","id":"ITEM_NOT_HERE","absent_at_location_ids":["LOC_MAIN"],"item_data":{"name":"Other Store Only","variations":[]}}
]`

func TestSnapshotAppliesSquareCatalogRules(t *testing.T) {
	var objects []*sq.CatalogObject
	if err := json.Unmarshal([]byte(catalogJSON), &objects); err != nil {
		t.Fatal(err)
	}
	snap := newTestClient(t, "http://unused").snapshot(objects)

	items := map[models.SquareItemID]payments.CatalogItem{}
	for _, it := range snap.Items {
		items[it.ID] = it
	}
	latte := items["ITEM_LATTE"]
	if !latte.Available || latte.Version != 9 || latte.Description != "Ube." {
		t.Errorf("latte = %+v", latte)
	}
	if len(latte.CategoryNames) != 1 || latte.CategoryNames[0] != "Signature Drinks" {
		t.Errorf("categories = %v", latte.CategoryNames)
	}
	if items["ITEM_ARCHIVED"].Available || items["ITEM_NOT_HERE"].Available {
		t.Error("archived items and items absent at our location must be unavailable")
	}

	if len(latte.Variations) != 2 {
		t.Fatalf("variations = %+v (the one not at our location must be dropped)", latte.Variations)
	}
	esp, custom := latte.Variations[0], latte.Variations[1]
	if esp.Price != models.NewMoney(900, models.USD) || !esp.Sellable {
		t.Errorf("our location's price override must win: %+v", esp)
	}
	if custom.Sellable {
		t.Error("variable-priced variations can't be sold online")
	}

	if len(latte.ModifierLists) != 2 {
		t.Fatalf("disabled modifier list must be skipped: %+v", latte.ModifierLists)
	}
	milkRef, addOnRef := latte.ModifierLists[0], latte.ModifierLists[1]
	if milkRef.MinSelected == nil || *milkRef.MinSelected != 0 || *milkRef.MaxSelected != 1 {
		t.Errorf("item-level override not captured: %+v", milkRef)
	}
	if addOnRef.MinSelected != nil {
		t.Error("-1/-1 means 'use the list limits', not an override")
	}

	lists := map[models.SquareModifierListID]models.ModifierList{}
	for _, l := range snap.ModifierLists {
		lists[l.SquareID] = l
	}
	if milk := lists["ML_MILK"]; milk.MinSelected != 1 || milk.MaxSelected != 1 || len(milk.Modifiers) != 1 {
		t.Errorf("milk list = %+v (sold-out modifier must be dropped)", milk)
	}
	addOns := lists["ML_ADDONS"]
	if addOns.MinSelected != 0 || addOns.MaxSelected != 0 {
		t.Errorf("unset limits should normalize to 0: %+v", addOns)
	}
	if addOns.Modifiers[0].Price.Amount != 125 {
		t.Errorf("modifier location price override ignored: %+v", addOns.Modifiers[0])
	}
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

func TestOrderStatePaidOnlyWithFullTender(t *testing.T) {
	c := newTestClient(t, "http://unused")
	parse := func(s string) *sq.Order {
		var o sq.Order
		if err := json.Unmarshal([]byte(s), &o); err != nil {
			t.Fatal(err)
		}
		return &o
	}

	unpaid := c.orderState(parse(`{"id":"O1","location_id":"L","version":1,"state":"OPEN","total_money":{"amount":1870,"currency":"USD"},
		"net_amount_due_money":{"amount":1870,"currency":"USD"},"fulfillments":[{"type":"PICKUP","state":"PROPOSED"}]}`))
	if unpaid.FullyPaid {
		t.Error("an order without tenders is not paid")
	}

	paid := c.orderState(parse(`{"id":"O1","location_id":"L","version":4,"state":"OPEN","reference_id":"local1",
		"total_money":{"amount":1870,"currency":"USD"},"total_tax_money":{"amount":170,"currency":"USD"},
		"net_amount_due_money":{"amount":0,"currency":"USD"},
		"tenders":[{"id":"T1","type":"CARD","amount_money":{"amount":1870,"currency":"USD"},"payment_id":"PAY1"}],
		"fulfillments":[{"type":"PICKUP","state":"RESERVED","pickup_details":{"pickup_at":"2026-09-19T10:15:00Z"}}]}`))
	if !paid.FullyPaid || paid.PaymentID != "PAY1" || paid.Version != 4 || paid.ReferenceID != "local1" {
		t.Errorf("paid = %+v", paid)
	}
	if paid.Fulfillment != payments.FulfillmentReserved || paid.Tax.Amount != 170 || paid.PickupAt.IsZero() {
		t.Errorf("paid = %+v", paid)
	}
}

func TestCreateOrderBuildsCatalogOrder(t *testing.T) {
	var gotBody map[string]any
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/orders" {
			http.NotFound(w, r)
			return
		}
		gotAuth = r.Header.Get("Authorization")
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &gotBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"order":{"id":"SQO1","location_id":"LOC_MAIN","version":1,"state":"OPEN",
			"total_money":{"amount":1870,"currency":"USD"},"total_tax_money":{"amount":170,"currency":"USD"}}}`)
	}))
	defer srv.Close()

	c := newTestClient(t, srv.URL)
	created, err := c.CreateOrder(context.Background(), payments.OrderRequest{
		IdempotencyKey: "felisa-order-abc",
		LocalOrderID:   "abc",
		Lines: []payments.OrderLine{{
			VariationID: "VAR_ESP", ModifierIDs: []models.SquareModifierID{"MOD_OAT", "MOD_FOAM"}, Quantity: 2, Note: "less ice",
		}},
		Customer: models.Contact{Name: "Ana", Email: "ana@example.com", Phone: "+15555550100"},
		PrepTime: 11*time.Minute + 20*time.Second,
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.ID != "SQO1" || created.Total.Amount != 1870 {
		t.Errorf("order = %+v", created)
	}
	if gotAuth != "Bearer EAAA-test-token" {
		t.Errorf("Authorization = %q", gotAuth)
	}

	if gotBody["idempotency_key"] != "felisa-order-abc" {
		t.Errorf("idempotency_key = %v", gotBody["idempotency_key"])
	}
	order := gotBody["order"].(map[string]any)
	if order["location_id"] != testLocation || order["reference_id"] != "abc" {
		t.Errorf("order = %v", order)
	}
	line := order["line_items"].([]any)[0].(map[string]any)
	// Lines reference catalog IDs only: Square prices them, never us.
	if line["catalog_object_id"] != "VAR_ESP" || line["quantity"] != "2" || line["base_price_money"] != nil {
		t.Errorf("line = %v", line)
	}
	if mods := line["modifiers"].([]any); len(mods) != 2 || mods[0].(map[string]any)["catalog_object_id"] != "MOD_OAT" {
		t.Errorf("modifiers = %v", mods)
	}
	pickup := order["fulfillments"].([]any)[0].(map[string]any)["pickup_details"].(map[string]any)
	if pickup["prep_time_duration"] != "PT12M" || pickup["schedule_type"] != "ASAP" {
		t.Errorf("pickup = %v", pickup)
	}
	if order["pricing_options"].(map[string]any)["auto_apply_taxes"] != true {
		t.Error("taxes must be applied by Square")
	}
}

func TestErrorsAreClassified(t *testing.T) {
	var status atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(int(status.Load()))
		_, _ = io.WriteString(w, `{"errors":[{"category":"API_ERROR","code":"INTERNAL_SERVER_ERROR"}]}`)
	}))
	defer srv.Close()
	c := newTestClient(t, srv.URL)

	status.Store(http.StatusServiceUnavailable)
	if _, err := c.GetOrder(context.Background(), "O1"); !errors.Is(err, payments.ErrUnavailable) {
		t.Errorf("503: err = %v, want ErrUnavailable", err)
	}

	status.Store(http.StatusBadRequest)
	if _, err := c.GetOrder(context.Background(), "O1"); !errors.Is(err, payments.ErrRejected) {
		t.Errorf("400: err = %v, want ErrRejected", err)
	}

	srv.Close()
	if _, err := c.GetOrder(context.Background(), "O1"); !errors.Is(err, payments.ErrUnavailable) {
		t.Errorf("network failure: err = %v, want ErrUnavailable", err)
	}
}

func TestNewRequiresCredentials(t *testing.T) {
	if _, err := New(Config{}); !errors.Is(err, payments.ErrNotConfigured) {
		t.Errorf("err = %v", err)
	}
	if _, err := New(Config{AccessToken: "x", LocationID: "L", Environment: "staging"}); err == nil {
		t.Error("unknown environment must be rejected")
	}
}

func TestSeedingRefusesProduction(t *testing.T) {
	c, err := New(Config{AccessToken: "x", LocationID: "L", Environment: "production", BaseURL: "http://unused"})
	if err != nil {
		t.Fatal(err)
	}
	if err := c.SeedSandboxCatalog(context.Background(), nil, nil); err == nil {
		t.Error("seeding must refuse production")
	}
}

func TestCatalogObjectMarshalInfersTypeFromUnionField(t *testing.T) {
	object := &sq.CatalogObject{
		Item: &sq.CatalogObjectItem{
			ID:       "#item",
			ItemData: &sq.CatalogItem{Name: sq.String("Test item")},
		},
	}
	if _, err := json.Marshal(object); err != nil {
		t.Fatalf("marshal catalog item: %v", err)
	}
}
