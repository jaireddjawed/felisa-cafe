import PocketBase from "pocketbase";

import type { TypedPocketBase } from "./pocketbase-types";
import type {
  AddCartItemInput,
  CartView,
  CheckoutInput,
  CheckoutView,
  ETAView,
  OrderView,
  PayCheckoutInput,
  ProductView,
} from "./api-types";

// Browser requests use NEXT_PUBLIC_PB_URL; server-side calls inside Docker use
// the private Compose service URL.
const PB_URL =
  typeof window === "undefined"
    ? process.env.PB_URL ?? process.env.NEXT_PUBLIC_PB_URL ?? "http://127.0.0.1:8090"
    : process.env.NEXT_PUBLIC_PB_URL ?? "http://127.0.0.1:8090";

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

/** Typed wrappers for the storefront API in backend/internal/actions. */
export const menuApi = {
  listProducts(...categories: ProductView["category"][]) {
    const query = categories.length ? `?category=${categories.join(",")}` : "";
    return api<ProductView[]>(`/api/menu/products${query}`, { cache: "no-store" });
  },
  getProduct(slug: string) {
    return api<ProductView>(`/api/menu/products/${slug}`, { cache: "no-store" });
  },
};

/**
 * Server-side cart. Guests: persist `cartToken` from the first add response
 * and pass it back; signed-in customers pass their auth token instead (then
 * call merge once after sign-in to fold the guest cart in).
 */
export type StoreAuth = { cartToken?: string; authToken?: string };

function authHeaders({ cartToken, authToken }: StoreAuth): HeadersInit {
  return {
    ...(cartToken ? { "X-Cart-Token": cartToken } : {}),
    ...(authToken ? { Authorization: authToken } : {}),
  };
}

export const cartApi = {
  get(auth: StoreAuth) {
    return api<CartView>("/api/cart", { headers: authHeaders(auth) });
  },
  add(auth: StoreAuth, item: AddCartItemInput) {
    return api<CartView>("/api/cart/items", {
      method: "POST",
      headers: authHeaders(auth),
      body: JSON.stringify(item),
    });
  },
  setQuantity(auth: StoreAuth, lineId: string, quantity: number) {
    return api<CartView>(`/api/cart/items/${lineId}`, {
      method: "PATCH",
      headers: authHeaders(auth),
      body: JSON.stringify({ quantity }),
    });
  },
  merge(auth: Required<StoreAuth>) {
    return api<CartView>("/api/cart/merge", { method: "POST", headers: authHeaders(auth) });
  },
  eta(auth: StoreAuth) {
    return api<ETAView>("/api/cart/eta", { headers: authHeaders(auth) });
  },
};

export const orderApi = {
  /**
   * Starts checkout by creating a pending Square order.
   * Generate `idempotencyKey` once per checkout attempt (crypto.randomUUID())
   * and reuse it on retries. Guests must store the returned `orderToken`.
   */
  checkout(auth: StoreAuth, input: CheckoutInput, idempotencyKey: string) {
    return api<CheckoutView>("/api/checkout", {
      method: "POST",
      headers: { ...authHeaders(auth), "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    });
  },
  pay(
    opts: { orderToken?: string; authToken?: string },
    input: PayCheckoutInput,
    idempotencyKey: string,
  ) {
    return api<OrderView>("/api/checkout/pay", {
      method: "POST",
      headers: {
        ...(opts.orderToken ? { "X-Order-Token": opts.orderToken } : {}),
        ...(opts.authToken ? { Authorization: opts.authToken } : {}),
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input),
    });
  },
  get(orderId: string, opts: { orderToken?: string; authToken?: string }) {
    return api<OrderView>(`/api/orders/${orderId}`, {
      headers: {
        ...(opts.orderToken ? { "X-Order-Token": opts.orderToken } : {}),
        ...(opts.authToken ? { Authorization: opts.authToken } : {}),
      },
    });
  },
  history(authToken: string) {
    return api<OrderView[]>("/api/orders", { headers: { Authorization: authToken } });
  },
};
