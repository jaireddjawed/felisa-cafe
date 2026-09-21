/**
 * The shapes Laravel sends to Inertia pages.
 *
 * These mirror the `toArray()` / payload methods on the PHP side, which are
 * the only places props are built:
 *
 *   Money            App\Support\Money::toArray()
 *   Product          App\Models\Product::toMenuCard() / toMenuDetail()
 *   Cart, CartLine   App\Cart\PricedCart / PricedLine::toArray()
 *   Order            App\Http\Controllers\OrderController::payload()
 *   SavedCard        App\Models\SavedCard::toPayload()
 *
 * Keeping them hand-written and in one file makes the boundary auditable:
 * change a payload in PHP and the matching type is one file away.
 */

export type ProductCategory = 'signature' | 'matcha' | 'pantry' | 'merch';

export type OrderStatus =
    | 'pending_payment'
    | 'paid'
    | 'preparing'
    | 'ready'
    | 'completed'
    | 'cancelled';

/** Money is always integer minor units; `formatted` is rendered by PHP. */
export interface Money {
    cents: number;
    currency: string;
    formatted: string;
}

export interface Pour {
    top: string;
    bottom: string;
}

/** What a menu card needs. */
export interface Product {
    id: number;
    slug: string;
    name: string;
    category: ProductCategory | null;
    tagline: string;
    badge: string;
    pour: Pour;
    fromPrice: Money | null;
    available: boolean;
}

export interface Variation {
    id: string;
    name: string;
    price: Money;
    available: boolean;
}

export interface Modifier {
    id: string;
    name: string;
    price: Money;
}

export interface ModifierList {
    id: string;
    name: string;
    /** 0 means no minimum. */
    minSelected: number;
    /** 0 means no maximum. */
    maxSelected: number;
    modifiers: Modifier[];
}

/** Everything on a card, plus what the customer picks from. */
export interface ProductDetail extends Product {
    description: string;
    ingredients: string[];
    size: string;
    variations: Variation[];
    modifierLists: ModifierList[];
}

export interface CartLine {
    id: string;
    productName: string;
    productSlug: string;
    variationName: string;
    modifiers: Modifier[];
    quantity: number;
    note: string;
    unitPrice: Money;
    total: Money;
    /** Set when the line can no longer be bought; blocks checkout. */
    problem: string | null;
}

export interface Cart {
    lines: CartLine[];
    subtotal: Money;
    itemCount: number;
    valid: boolean;
}

export interface OrderItem {
    id: number;
    productName: string;
    productSlug: string;
    /** "Espresso · Oat Milk", as chosen at the time of purchase. */
    options: string;
    quantity: number;
    note: string;
    unitPrice: Money;
    total: Money;
}

export interface Order {
    id: number;
    reference: string;
    status: OrderStatus;
    statusLabel: string;
    isPaid: boolean;
    placedAt: string | null;
    estimatedReadyAt: string | null;
    customerName: string;
    subtotal: Money;
    tax: Money;
    tip: Money;
    total: Money;
    items: OrderItem[];
}

/**
 * A card the customer keeps on file. Only Square holds the card itself; `id`
 * is this application's own row, and is all the browser ever sends back.
 */
export interface SavedCard {
    id: number;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    expired: boolean;
    addedAt: string | null;
    lastUsedAt: string | null;
}

export interface Shop {
    host: string;
    street: string;
    city: string;
    opening_label: string;
    opening_date: string;
    opening_hours: string;
    instagram: string;
}

export interface AuthUser {
    id: number;
    name: string;
    email: string;
}

/** Props shared with every page by HandleInertiaRequests. */
export interface SharedProps {
    name: string;
    auth: { user: AuthUser | null };
    cart: Cart;
    shop: Shop;
    /** A new token each time something is added, so the drawer can reopen. */
    flash: { cartOpened: string | null };
    [key: string]: unknown;
}
