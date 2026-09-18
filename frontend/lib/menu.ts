export type Category = "signature" | "pantry" | "merch";

export type Modifier = {
  id: string;
  label: string;
  price: number;
};

export type Product = {
  slug: string;
  name: string;
  category: Category;
  price: number;
  tagline: string;
  description: string;
  ingredients: string[];
  size?: string;
  /** Base choice shown on the product page, e.g. espresso or matcha. */
  bases?: string[];
  /** Gradient stops for the illustrated glass, top layer to bottom layer. */
  pour: { top: string; bottom: string };
  badge?: string;
};

export const MILKS: Modifier[] = [
  { id: "whole", label: "Whole milk", price: 0 },
  { id: "oat", label: "Oat milk", price: 0 },
  { id: "almond", label: "Almond milk", price: 0 },
  { id: "coconut", label: "Coconut milk", price: 0 },
  { id: "nonfat", label: "Non-fat milk", price: 0 },
];

export const ADD_ONS: Modifier[] = [
  { id: "maple-foam", label: "Maple cold foam", price: 1 },
  { id: "ube-cream", label: "Ube whipped cream", price: 1 },
];

export const PRODUCTS: Product[] = [
  {
    slug: "felisa-latte",
    name: "Felisa Latte",
    category: "signature",
    price: 8.5,
    tagline: "The one we named ourselves after.",
    description:
      "Housemade ube syrup poured under your choice of espresso or matcha, so it layers violet into gold. Sweet, nutty, a little floral — this is the drink people come back for.",
    ingredients: ["espresso or matcha", "housemade ube syrup", "choice of milk"],
    size: "16oz / matcha 12oz",
    bases: ["Espresso", "Matcha"],
    pour: { top: "#C08A5E", bottom: "#9B6BD8" },
    badge: "Signature",
  },
  {
    slug: "mabuhay-mocha",
    name: "Mabuhay Mocha",
    category: "signature",
    price: 8.5,
    tagline: "Chocolate sauce we cook in-house.",
    description:
      "Our housemade chocolate sauce stirred into espresso or matcha and finished with the milk of your choice. Deep, cocoa-forward, never cloying.",
    ingredients: [
      "espresso or matcha",
      "housemade chocolate sauce (contains dairy)",
      "choice of milk",
    ],
    size: "16oz / matcha 12oz",
    bases: ["Espresso", "Matcha"],
    pour: { top: "#6F4530", bottom: "#C4A084" },
    badge: "Signature",
  },
  {
    slug: "turon-milk-tea",
    name: "Turon Milk Tea",
    category: "signature",
    price: 8.5,
    tagline: "Tastes like the street-corner dessert.",
    description:
      "Assam black tea shaken with non-dairy creamer and our caramelized banana syrup. Toasty, jammy, and exactly as comforting as the turon it is named for.",
    ingredients: [
      "assam black tea",
      "non-dairy creamer",
      "housemade caramelized banana syrup",
    ],
    size: "16oz",
    pour: { top: "#C69A6D", bottom: "#E3C9A8" },
    badge: "Signature",
  },
  {
    slug: "lubi-chai-latte",
    name: "Lubi Chai Latte",
    category: "signature",
    price: 8.5,
    tagline: "Coconut, spice, blue-sky afternoons.",
    description:
      "Organic chai concentrate with our housemade coconut syrup and the milk of your choice. Warming spice up front, toasted coconut on the finish.",
    ingredients: [
      "organic chai concentrate",
      "housemade coconut syrup",
      "choice of milk",
    ],
    size: "16oz",
    pour: { top: "#B08A63", bottom: "#EFE3D2" },
    badge: "Signature",
  },
  {
    slug: "ube-syrup-bottle",
    name: "Housemade Ube Syrup",
    category: "pantry",
    price: 16,
    tagline: "Take the purple home. 12oz bottle.",
    description:
      "The same ube syrup we ladle into every Felisa Latte, bottled for your kitchen. Good in coffee, better on pancakes.",
    ingredients: ["ube", "cane sugar", "coconut", "vanilla"],
    pour: { top: "#7B4FB5", bottom: "#B892E4" },
  },
  {
    slug: "banana-syrup-bottle",
    name: "Caramelized Banana Syrup",
    category: "pantry",
    price: 16,
    tagline: "Turon in a bottle. 12oz.",
    description:
      "Bananas cooked down with brown sugar until they taste like the inside of a turon. Pour it over ice, tea, or anything.",
    ingredients: ["banana", "brown sugar", "cinnamon"],
    pour: { top: "#A9743F", bottom: "#DDBB8A" },
  },
  {
    slug: "cat-tote",
    name: "Felisa Cat Tote",
    category: "merch",
    price: 22,
    tagline: "Heavyweight canvas, purple cat print.",
    description:
      "A sturdy cotton tote screen-printed with the Felisa cat. Holds a laptop, a library run, and two iced drinks without complaint.",
    ingredients: ["12oz cotton canvas", "screen-printed", "14in x 16in"],
    pour: { top: "#8E6BC8", bottom: "#D9C7F0" },
  },
  {
    slug: "sticker-pack",
    name: "Doodle Sticker Pack",
    category: "merch",
    price: 8,
    tagline: "Six vinyl stickers, all hand-drawn.",
    description:
      "The cat, the sparkles, the whole lettered logo — six waterproof vinyl stickers drawn by the same hand that draws our menus.",
    ingredients: ["6 stickers", "waterproof vinyl", "dishwasher safe"],
    pour: { top: "#B48AE6", bottom: "#EADDF8" },
  },
];

export const SIGNATURES = PRODUCTS.filter((p) => p.category === "signature");

export function getProduct(slug: string) {
  return PRODUCTS.find((p) => p.slug === slug);
}

export const SHOP = {
  name: "Felisa Cafe",
  host: "Chase Coffee Roasters",
  street: "2736 Nutwood Ave",
  city: "Fullerton, CA 92831",
  openingLabel: "Grand Opening",
  openingDate: "Monday, October 5",
  openingHours: "5:00PM – 12:00AM",
  instagram: "@felisacafe",
};

export function money(n: number) {
  return `$${n.toFixed(2)}`;
}
