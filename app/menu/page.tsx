import type { Metadata } from "next";
import { PRODUCTS, SHOP } from "@/lib/menu";
import { ProductCard } from "../components/product-card";
import { Sprig } from "../components/marks";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Four signature drinks, two housemade syrups, and a tote. Espresso or matcha in anything.",
};

const SECTIONS = [
  {
    key: "signature" as const,
    title: "Signatures",
    note: "16oz / matcha 12oz",
  },
  { key: "pantry" as const, title: "Pantry", note: "Bottled for your kitchen" },
  { key: "merch" as const, title: "Merch", note: "Drawn by the same hand" },
];

export default function MenuPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <header className="max-w-2xl">
        <p className="label-fine flex items-center gap-3">
          <Sprig size={14} className="sway text-sage" /> {SHOP.host} ·{" "}
          {SHOP.city}
        </p>
        <h1 className="font-display mt-5 text-5xl leading-tight text-plum-800">
          The menu
        </h1>
        <p className="mt-6 leading-relaxed text-quiet">
          Espresso or matcha in anything, five milks that never cost extra, and
          four syrups we cook in small batches. Choose a drink to build it.
        </p>
      </header>

      {SECTIONS.map((section) => {
        const items = PRODUCTS.filter((p) => p.category === section.key);
        return (
          <section key={section.key} className="mt-20">
            <div className="rule-fine flex items-baseline gap-4 pt-4">
              <h2 className="font-display text-2xl text-plum-800">
                {section.title}
              </h2>
              <p className="ml-auto text-sm text-quiet">{section.note}</p>
            </div>
            <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
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
