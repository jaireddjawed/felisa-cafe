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
    <div className="mx-auto max-w-7xl px-5 py-16">
      <header className="border-b-8 border-void pb-10">
        <p className="kicker flex items-center gap-3 text-violet">
          <Star size={12} /> {SHOP.host} · {SHOP.city}
        </p>
        <h1 className="poster mt-5 text-[16vw] text-void lg:text-[9rem]">
          Menu
        </h1>
        <p className="font-serif mt-4 max-w-2xl text-2xl italic text-grape">
          Espresso or matcha in anything. Five milks, none of them upcharged.
          Choose a drink to build it.
        </p>
      </header>

      {SECTIONS.map((section) => {
        const items = PRODUCTS.filter((p) => p.category === section.key);
        return (
          <section key={section.key} className="mt-16">
            <div className="flex flex-wrap items-baseline gap-4">
              <h2 className="poster text-4xl text-void sm:text-5xl">
                {section.title}
              </h2>
              <p className="kicker ml-auto text-violet">{section.note}</p>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item, i) => (
                <ProductCard key={item.slug} product={item} index={i} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
