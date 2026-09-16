import type { Metadata } from "next";
import { PRODUCTS, SHOP } from "@/lib/menu";
import { ProductCard } from "../components/product-card";
import { CatSticker, Star } from "../components/marks";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Four signature drinks, two housemade syrups, and a tote. Espresso or matcha in anything.",
};

const SECTIONS = [
  {
    key: "signature" as const,
    title: "signature menu",
    note: "16oz / matcha 12oz",
    mat: "bg-butter",
  },
  {
    key: "pantry" as const,
    title: "pantry",
    note: "syrups we bottle for you",
    mat: "bg-mint",
  },
  {
    key: "merch" as const,
    title: "merch",
    note: "drawn by the same hand",
    mat: "bg-bubblegum",
  },
];

export default function MenuPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="pop relative bg-white px-7 py-8">
        <Star size={30} className="wiggle absolute -top-4 right-6 text-butter" />
        <p className="font-note flex items-center gap-2 text-2xl text-grape-600">
          <CatSticker size={28} className="text-grape-600" /> {SHOP.host} ·{" "}
          {SHOP.city}
        </p>
        <h1 className="mt-2 font-bubble text-6xl leading-none text-grape-900 sm:text-7xl">
          the whole menu
        </h1>
        <p className="font-note mt-4 max-w-lg text-2xl leading-snug text-grape-600">
          espresso or matcha in anything, five milks that never cost extra. tap
          a drink to build it your way!
        </p>
      </header>

      {SECTIONS.map((section) => {
        const items = PRODUCTS.filter((p) => p.category === section.key);
        return (
          <section key={section.key} className="mt-14">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-bubble text-4xl text-grape-900 sm:text-5xl">
                {section.title}
              </h2>
              <span
                className={`pop-sm px-4 py-1 font-bubble text-base text-grape-900 ${section.mat}`}
              >
                {section.note}
              </span>
            </div>
            <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
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
