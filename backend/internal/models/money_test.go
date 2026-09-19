package models

import "testing"

func TestMoney(t *testing.T) {
	sum, err := NewMoney(850, USD).Add(NewMoney(100, USD))
	if err != nil || sum != NewMoney(950, USD) {
		t.Errorf("sum = %v, %v", sum, err)
	}
	if _, err := NewMoney(1, USD).Add(NewMoney(1, "EUR")); err == nil {
		t.Error("adding different currencies must fail")
	}
	if z, _ := (Money{}).Add(NewMoney(5, USD)); z != NewMoney(5, USD) {
		t.Errorf("zero Money should adopt the other currency: %v", z)
	}
	for m, want := range map[Money]string{
		NewMoney(850, USD):    "$8.50",
		NewMoney(5, USD):      "$0.05",
		NewMoney(-1999, USD):  "-$19.99",
		NewMoney(1200, "JPY"): "1200 JPY",
		NewMoney(1050, "EUR"): "10.50 EUR",
	} {
		if got := m.String(); got != want {
			t.Errorf("%#v.String() = %q, want %q", m, got, want)
		}
	}
	if got := NewMoney(950, USD).Times(3); got.Amount != 2850 {
		t.Errorf("Times = %v", got)
	}
}
