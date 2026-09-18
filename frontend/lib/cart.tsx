"use client";

import { useMemo, useSyncExternalStore } from "react";

export type CartLine = {
  /** slug plus the chosen options, so two builds of one drink stay separate. */
  id: string;
  slug: string;
  name: string;
  unitPrice: number;
  qty: number;
  options: string[];
};

type CartSnapshot = {
  lines: CartLine[];
  isOpen: boolean;
};

const STORAGE_KEY = "felisa-cart";

/** The server has no cart, and hydration has to agree with that. */
const EMPTY: CartSnapshot = { lines: [], isOpen: false };

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    // A corrupt or unavailable store just means we start empty.
    return [];
  }
}

let snapshot: CartSnapshot =
  typeof window === "undefined" ? EMPTY : { lines: read(), isOpen: false };

const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit(next: CartSnapshot) {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.lines));
  } catch {
    // Ignore quota or private-mode failures.
  }
  for (const fn of listeners) fn();
}

function lineId(slug: string, options: string[]) {
  return [slug, ...options].join("|");
}

export const cart = {
  add(line: Omit<CartLine, "id" | "qty">, qty = 1) {
    const id = lineId(line.slug, line.options);
    const existing = snapshot.lines.find((l) => l.id === id);
    const lines = existing
      ? snapshot.lines.map((l) => (l.id === id ? { ...l, qty: l.qty + qty } : l))
      : [...snapshot.lines, { ...line, id, qty }];
    commit({ lines, isOpen: true });
  },
  setQty(id: string, qty: number) {
    const lines =
      qty <= 0
        ? snapshot.lines.filter((l) => l.id !== id)
        : snapshot.lines.map((l) => (l.id === id ? { ...l, qty } : l));
    commit({ ...snapshot, lines });
  },
  remove(id: string) {
    commit({ ...snapshot, lines: snapshot.lines.filter((l) => l.id !== id) });
  },
  clear() {
    commit({ ...snapshot, lines: [] });
  },
  open() {
    commit({ ...snapshot, isOpen: true });
  },
  close() {
    commit({ ...snapshot, isOpen: false });
  },
};

export function useCart() {
  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );

  return useMemo(
    () => ({
      ...cart,
      lines: state.lines,
      isOpen: state.isOpen,
      count: state.lines.reduce((n, l) => n + l.qty, 0),
      subtotal: state.lines.reduce((n, l) => n + l.qty * l.unitPrice, 0),
    }),
    [state],
  );
}
