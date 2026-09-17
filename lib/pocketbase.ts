import PocketBase from "pocketbase";

import type { TypedPocketBase } from "./pocketbase-types";
import type { CheckoutInput, OrderView, ProductView } from "./api-types";

const PB_URL = process.env.NEXT_PUBLIC_PB_URL ?? "http://127.0.0.1:8090";

/** Typed PocketBase client for direct collection access (auth, realtime, etc). */
export const pb = new PocketBase(PB_URL) as TypedPocketBase;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PB_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `${path} failed with ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** Typed wrappers for the custom controllers in backend/internal/controllers. */
export const menuApi = {
  listProducts(category?: ProductView["category"]) {
    const query = category ? `?category=${category}` : "";
    return api<ProductView[]>(`/api/menu/products${query}`);
  },
  getProduct(slug: string) {
    return api<ProductView>(`/api/menu/products/${slug}`);
  },
  checkout(input: CheckoutInput) {
    return api<OrderView>("/api/checkout", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};
