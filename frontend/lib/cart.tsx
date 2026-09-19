"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

import type { AddCartItemInput, CartLineView, CartView } from "./api-types";
import { cartApi, orderApi, type StoreAuth } from "./pocketbase";

const TOKEN_KEY = "felisa-cart-token";
const ORDER_TOKEN_KEY = "felisa-order-token";

type CartSnapshot = {
  cart: CartView | null;
  isOpen: boolean;
  loading: boolean;
  error: string | null;
};

const EMPTY_CART: CartView = {
  lines: [],
  subtotal: { amount: 0, currency: "USD", formatted: "$0.00" },
  itemCount: 0,
  valid: true,
};

const EMPTY: CartSnapshot = {
  cart: EMPTY_CART,
  isOpen: false,
  loading: false,
  error: null,
};

let snapshot: CartSnapshot = EMPTY;
let initialized = false;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(next: CartSnapshot) {
  snapshot = next;
  for (const fn of listeners) fn();
}

function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function setToken(token?: string) {
  if (!token) return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Private mode or quota errors should not break ordering.
  }
}

function auth(): StoreAuth {
  return { cartToken: getToken() };
}

function rememberCart(nextCart: CartView) {
  setToken(nextCart.cartToken);
  emit({ ...snapshot, cart: nextCart, loading: false, error: null });
}

async function refresh() {
  emit({ ...snapshot, loading: true, error: null });
  try {
    rememberCart(await cartApi.get(auth()));
  } catch (err) {
    emit({
      ...snapshot,
      loading: false,
      error: err instanceof Error ? err.message : "Cart unavailable.",
    });
  }
}

export const cart = {
  init() {
    if (initialized || typeof window === "undefined") return;
    initialized = true;
    void refresh();
  },
  async add(item: AddCartItemInput) {
    emit({ ...snapshot, loading: true, error: null });
    try {
      rememberCart(await cartApi.add(auth(), item));
      emit({ ...snapshot, isOpen: true });
    } catch (err) {
      emit({
        ...snapshot,
        loading: false,
        error: err instanceof Error ? err.message : "Could not add item.",
      });
    }
  },
  async setQty(lineId: string, quantity: number) {
    emit({ ...snapshot, loading: true, error: null });
    try {
      rememberCart(await cartApi.setQuantity(auth(), lineId, quantity));
    } catch (err) {
      emit({
        ...snapshot,
        loading: false,
        error: err instanceof Error ? err.message : "Could not update item.",
      });
    }
  },
  async remove(lineId: string) {
    emit({ ...snapshot, loading: true, error: null });
    try {
      rememberCart(await cartApi.setQuantity(auth(), lineId, 0));
    } catch (err) {
      emit({
        ...snapshot,
        loading: false,
        error: err instanceof Error ? err.message : "Could not remove item.",
      });
    }
  },
  async checkout(input: {
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    notes?: string;
  }) {
    emit({ ...snapshot, loading: true, error: null });
    try {
      const result = await orderApi.checkout(
        auth(),
        input,
        window.crypto.randomUUID(),
      );
      if (result.orderToken) {
        window.localStorage.setItem(ORDER_TOKEN_KEY, result.orderToken);
      }
      window.location.href = `/checkout?order=${encodeURIComponent(result.orderId)}`;
    } catch (err) {
      emit({
        ...snapshot,
        loading: false,
        error: err instanceof Error ? err.message : "Could not start checkout.",
      });
    }
  },
  clearError() {
    emit({ ...snapshot, error: null });
  },
  open() {
    emit({ ...snapshot, isOpen: true });
  },
  close() {
    emit({ ...snapshot, isOpen: false });
  },
};

export function useCart() {
  useEffect(() => cart.init(), []);

  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );

  return useMemo(
    () => ({
      ...cart,
      lines: state.cart?.lines ?? ([] as CartLineView[]),
      isOpen: state.isOpen,
      loading: state.loading,
      error: state.error,
      count: state.cart?.itemCount ?? 0,
      subtotal: state.cart?.subtotal ?? EMPTY_CART.subtotal,
      valid: state.cart?.valid ?? true,
    }),
    [state],
  );
}
