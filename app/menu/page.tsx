import type { Metadata } from "next";
import { PRODUCTS, SHOP } from "@/lib/menu";
import { ProductCard } from "../components/product-card";
import { Star } from "../components/marks";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Four signature drinks, two housemade syrups, and a tote. Espresso or matcha in anything.",
};

const SECTIONS = [
  { key: "signature" as const, title: "Signatures", note: "16oz / matcha 12oz" },
  { key: "pantry" as const, title: "Pantry", note: "Bottled for your kitchen" },
  { key: "merch" as const, title: "Merch", note: "Drawn by the same hand" },
];

export default function MenuPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-20">
      <header className="max-w-2xl">
        <p className="overline flex items-center gap-2.5">
          <Star size={10} className="pulse-glow" /> {SHOP.host} · {SHOP.city}
        </p>
        <h1 className="neon mt-5 font-display text-5xl font-extrabold tracking-tight uppercase sm:text-6xl">
          The menu
        </h1>
        <p className="mt-6 leading-relaxed text-haze">
          Espresso or matcha in anything, five milks that never cost extra, and
          four syrups we cook in small batches. Choose a drink to build it.
        </p>
      </header>

      {SECTIONS.map((section) => {
        const items = PRODUCTS.filter((p) => p.category === section.key);
        return (
          <section key={section.key} className="mt-20">
            <div className="hairline-glow flex items-baseline gap-4 pt-5">
              <h2 className="font-display text-2xl font-bold tracking-tight uppercase">
                {section.title}
              </h2>
              <p className="ml-auto text-sm text-haze">{section.note}</p>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item) => (
                <ProductCard key={item.slug} product={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
