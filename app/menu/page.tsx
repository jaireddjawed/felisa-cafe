import type { Metadata } from "next";
import { PRODUCTS, SHOP } from "@/lib/menu";
import { ProductCard } from "../components/product-card";

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
    <div className="mx-auto max-w-6xl px-6 py-20">
      <header className="max-w-2xl">
        <p className="eyebrow">
          {SHOP.host} · {SHOP.city}
        </p>
        <h1 className="mt-4 text-5xl leading-tight font-light tracking-tight text-plum-900">
          The menu
        </h1>
        <p className="mt-5 leading-relaxed text-muted">
          Espresso or matcha in anything, five milks that never cost extra, and
          four syrups we cook in small batches. Choose a drink to build it.
        </p>
      </header>

      {SECTIONS.map((section) => {
        const items = PRODUCTS.filter((p) => p.category === section.key);
        return (
          <section key={section.key} className="mt-20">
            <div className="flex items-baseline gap-4 border-b border-mist-200 pb-4">
              <h2 className="text-2xl font-light text-plum-900">
                {section.title}
              </h2>
              <p className="ml-auto text-sm text-muted">{section.note}</p>
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
