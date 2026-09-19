// Package models holds the application's domain types. It has no knowledge
// of PocketBase or Square: conversion to and from storage happens in
// internal/database, and to and from Square in internal/providers.
package models

import (
	"fmt"
	"strconv"
)

// Currency is an ISO 4217 currency code, e.g. "USD".
type Currency string

const USD Currency = "USD"

// zeroDecimalCurrencies have no minor unit (1 JPY is the smallest amount).
var zeroDecimalCurrencies = map[Currency]bool{"JPY": true, "KRW": true, "VND": true, "CLP": true, "ISK": true}

// Money is an amount in the currency's smallest unit (cents for USD).
// Never use floating point for money.
type Money struct {
	Amount   int64
	Currency Currency
}

func NewMoney(amount int64, currency Currency) Money {
	return Money{Amount: amount, Currency: currency}
}

// Add returns m+o. Adding a zero-valued Money (no currency) is allowed so
// sums can start from Money{}.
func (m Money) Add(o Money) (Money, error) {
	switch {
	case m.Currency == "":
		return o, nil
	case o.Currency == "":
		return m, nil
	case m.Currency != o.Currency:
		return Money{}, fmt.Errorf("currency mismatch: %s + %s", m.Currency, o.Currency)
	}
	return Money{Amount: m.Amount + o.Amount, Currency: m.Currency}, nil
}

// Times returns m multiplied by a quantity.
func (m Money) Times(qty int64) Money {
	return Money{Amount: m.Amount * qty, Currency: m.Currency}
}

// String formats for display, e.g. "$8.50" or "1200 JPY".
func (m Money) String() string {
	sign := ""
	amount := m.Amount
	if amount < 0 {
		sign, amount = "-", -amount
	}
	if zeroDecimalCurrencies[m.Currency] {
		return sign + strconv.FormatInt(amount, 10) + " " + string(m.Currency)
	}
	major, minor := amount/100, amount%100
	if m.Currency == USD || m.Currency == "" {
		return fmt.Sprintf("%s$%d.%02d", sign, major, minor)
	}
	return fmt.Sprintf("%s%d.%02d %s", sign, major, minor, m.Currency)
}
