/**
 * Wire types for the custom PocketBase controllers, mirroring the Go response
 * shapes exactly. Source of truth: backend/internal/views/*.go and
 * backend/internal/controllers/*.go — update both sides together, since these
 * (unlike lib/pocketbase-types.ts) aren't derived from the live DB schema.
 */

export type ProductCategory = "signature" | "pantry" | "merch";

export type Pour = {
  top: string;
  bottom: string;
};

export type ProductView = {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  price: number;
  priceFormatted: string;
  tagline: string;
  description: string;
  ingredients: string[];
  size?: string;
  bases?: string[];
  pour: Pour;
  badge?: string;
};

export type CheckoutItemInput = {
  slug: string;
  qty: number;
  options: string[];
};

export type CheckoutInput = {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  notes?: string;
  items: CheckoutItemInput[];
};

export type OrderStatus = "pending" | "confirmed" | "completed" | "cancelled";

export type OrderItemView = {
  slug: string;
  name: string;
  unitPrice: number;
  qty: number;
  options: string[];
};

export type OrderView = {
  id: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  items: OrderItemView[];
  subtotal: number;
  subtotalFormatted: string;
  created: string;
};
