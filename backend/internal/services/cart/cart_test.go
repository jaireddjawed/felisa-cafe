package cart_test

import (
	"context"
	"errors"
	"testing"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/services/cart"
	"felisa-cafe/backend/internal/testutil"
)

var ctx = context.Background()

func usd(a int64) models.Money { return models.NewMoney(a, models.USD) }

func latte(t *testing.T) models.Product {
	t.Helper()
	env := testutil.NewEnv(t)
	p, err := env.Catalog.Get(ctx, "felisa-latte")
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func TestValidateSelection(t *testing.T) {
	p := latte(t)
	cases := map[string]struct {
		mods []models.SquareModifierID
		ok   bool
	}{
		"one milk":                {[]models.SquareModifierID{testutil.OatMilk}, true},
		"milk and add-ons":        {[]models.SquareModifierID{testutil.OatMilk, testutil.UbeCream, testutil.MapleFoam}, true},
		"missing required milk":   {nil, false},
		"two milks":               {[]models.SquareModifierID{testutil.OatMilk, testutil.WholeMilk}, false},
		"duplicate":               {[]models.SquareModifierID{testutil.OatMilk, testutil.OatMilk}, false},
		"hidden from online menu": {[]models.SquareModifierID{testutil.OatMilk, testutil.HiddenSecretMenu}, false},
		"not offered on product":  {[]models.SquareModifierID{testutil.OatMilk, "MOD_FROM_ELSEWHERE"}, false},
	}
	for name, tc := range cases {
		_, err := cart.ValidateSelection(p, testutil.LatteEspresso, tc.mods)
		if (err == nil) != tc.ok {
			t.Errorf("%s: err = %v", name, err)
		}
		if err != nil && !errors.Is(err, cart.ErrInvalidItem) {
			t.Errorf("%s: err should wrap ErrInvalidItem: %v", name, err)
		}
	}
	if _, err := cart.ValidateSelection(p, "VAR_UNKNOWN", []models.SquareModifierID{testutil.OatMilk}); err == nil {
		t.Error("unknown variation accepted")
	}
}

func TestPriceComputesFromCatalogOnly(t *testing.T) {
	p := latte(t)
	c := models.Cart{Items: []models.CartItem{
		{LineID: "1", VariationID: testutil.LatteEspresso, ModifierIDs: []models.SquareModifierID{testutil.OatMilk, testutil.UbeCream}, Quantity: 3},
		{LineID: "2", VariationID: "VAR_GONE", Quantity: 1},
	}}
	priced := cart.Price(c, map[models.SquareVariationID]models.Product{testutil.LatteEspresso: p})

	if priced.Valid {
		t.Error("a cart with an unavailable line is not valid")
	}
	line := priced.Lines[0]
	if line.UnitPrice != usd(950) || line.Total != usd(2850) {
		t.Errorf("unit=%v total=%v, want $9.50 / $28.50", line.UnitPrice, line.Total)
	}
	if priced.Lines[1].Problem == "" {
		t.Error("unknown variation must be flagged")
	}
	if priced.Subtotal != usd(2850) {
		t.Errorf("subtotal = %v; problem lines are excluded", priced.Subtotal)
	}

	// Items' made-to-order-ness feeds the ETA.
	if items := priced.OrderItems(); models.PrepUnits(items) != 3 {
		t.Errorf("prep units = %d", models.PrepUnits(items))
	}
}

func TestGuestAndCustomerCarts(t *testing.T) {
	env := testutil.NewEnv(t)
	guest := models.CartOwner{Token: "guest-token"}
	add := func(owner models.CartOwner, v models.SquareVariationID, qty int64, mods ...models.SquareModifierID) cart.Priced {
		t.Helper()
		p, err := env.Carts.Add(ctx, owner, cart.AddItem{VariationID: v, ModifierIDs: mods, Quantity: qty})
		if err != nil {
			t.Fatal(err)
		}
		return p
	}

	add(guest, testutil.LatteEspresso, 1, testutil.UbeCream, testutil.OatMilk)
	p := add(guest, testutil.LatteEspresso, 2, testutil.OatMilk, testutil.UbeCream) // same build, other order
	if len(p.Lines) != 1 || p.Lines[0].Item.Quantity != 3 {
		t.Fatalf("identical builds should merge: %+v", p.Lines)
	}
	p = add(guest, testutil.SyrupRegular, 1)
	if p.Subtotal != usd(3*950+1600) || !p.Valid {
		t.Errorf("subtotal = %v", p.Subtotal)
	}

	if _, err := env.Carts.Add(ctx, guest, cart.AddItem{VariationID: testutil.LatteEspresso, Quantity: 1}); !errors.Is(err, cart.ErrInvalidItem) {
		t.Errorf("missing required milk: err = %v", err)
	}

	p, err := env.Carts.SetQuantity(ctx, guest, p.Lines[0].Item.LineID, 0)
	if err != nil || len(p.Lines) != 1 {
		t.Fatalf("remove line: %+v, %v", p.Lines, err)
	}
	if _, err := env.Carts.SetQuantity(ctx, guest, "nope", 1); !errors.Is(err, cart.ErrLineMissing) {
		t.Errorf("err = %v", err)
	}

	// Another guest's token sees nothing.
	if other, _ := env.Carts.Get(ctx, models.CartOwner{Token: "someone-else"}); !other.IsEmpty() {
		t.Error("carts leaked across tokens")
	}

	// Signing in merges the guest cart into the customer's cart.
	user, _ := testutil.NewUser(t, env.App, "c@example.com", "C")
	customer := models.CartOwner{UserID: user}
	add(customer, testutil.SyrupRegular, 2)
	merged, err := env.Carts.Merge(ctx, guest.Token, user)
	if err != nil {
		t.Fatal(err)
	}
	if len(merged.Lines) != 1 || merged.Lines[0].Item.Quantity != 3 {
		t.Errorf("merged = %+v", merged.Lines)
	}
	if g, _ := env.Carts.Get(ctx, guest); !g.IsEmpty() {
		t.Error("guest cart should be gone after merge")
	}
}

func TestCartRepricesWhenCatalogChanges(t *testing.T) {
	env := testutil.NewEnv(t)
	owner := models.CartOwner{Token: "t"}
	if _, err := env.Carts.Add(ctx, owner, cart.AddItem{VariationID: testutil.SyrupRegular, Quantity: 1}); err != nil {
		t.Fatal(err)
	}
	env.Square.Catalog.Items[1].Variations[0].Price = usd(1800)
	if _, err := env.Catalog.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	p, _ := env.Carts.Get(ctx, owner)
	if p.Subtotal != usd(1800) {
		t.Errorf("cart must reflect current prices, got %v", p.Subtotal)
	}
}
