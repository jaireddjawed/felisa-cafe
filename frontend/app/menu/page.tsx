import type { Metadata } from "next";
import { PRODUCTS, SHOP } from "@/lib/menu";
import { ProductCard } from "../components/product-card";
import { CatFace, Sparkle, SquiggleRule } from "../components/doodles";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Four signature drinks, two housemade syrups, and a tote. Espresso or matcha in anything.",
};

const SECTIONS = [
  {
    key: "signature" as const,
    title: "Signature menu",
    note: "16oz / matcha 12oz",
  },
  { key: "pantry" as const, title: "Pantry", note: "Syrups we bottle for you" },
  { key: "merch" as const, title: "Merch", note: "Drawn by the same hand" },
];

export default function MenuPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <header className="relative">
        <Sparkle
          size={30}
          className="twinkle absolute -top-4 right-4 text-lav-400"
        />
        <p className="flex items-center gap-2 font-hand text-xl text-lav-600">
          <CatFace size={24} /> {SHOP.host} · {SHOP.city}
        </p>
        <h1 className="mt-2 font-marker text-5xl leading-tight text-lav-800 sm:text-6xl">
          The whole menu
        </h1>
        <p className="mt-4 max-w-lg font-hand text-2xl leading-snug text-lav-700">
          Espresso or matcha in anything. Five milks, none of them upcharged.
          Tap a drink to build it the way you like.
        </p>
      </header>

      {SECTIONS.map((section) => {
        const items = PRODUCTS.filter((p) => p.category === section.key);
        return (
          <section key={section.key} className="mt-16">
            <div className="flex flex-wrap items-end gap-3">
              <h2 className="font-marker text-3xl text-lav-800 sm:text-4xl">
                {section.title}
              </h2>
              <p className="font-hand text-xl text-lav-600">{section.note}</p>
            </div>
            <SquiggleRule className="mt-3 h-5 w-full text-lav-400" />
            <div className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
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
