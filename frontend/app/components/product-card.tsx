import Link from "next/link";
import type { ProductView } from "@/lib/api-types";
import { DrinkGlass, Sparkle } from "./doodles";

const TILTS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2"];

export function ProductCard({
  product,
  index = 0,
}: {
  product: ProductView;
  index?: number;
}) {
  const price = product.fromPrice ?? product.variations.find((v) => v.available)?.price;

  return (
    <Link
      href={`/menu/${product.slug}`}
      className={`sticker group relative block rounded-3xl bg-lav-100 p-5 transition-transform duration-300 hover:rotate-0 hover:scale-[1.03] ${
        TILTS[index % TILTS.length]
      }`}
    >
      {product.badge && (
        <span className="absolute -left-2 -top-3 z-10 -rotate-6 rounded-full bg-lav-600 px-3 py-1 font-hand text-sm text-white shadow">
          {product.badge}
        </span>
      )}

      <Sparkle
        size={18}
        className="twinkle absolute right-4 top-4 text-lav-400"
      />

      <div className="grid place-items-center rounded-2xl bg-lav-300/60 py-4">
        <DrinkGlass
          top={product.pour.top}
          bottom={product.pour.bottom}
          ice={product.category === "signature"}
          className="h-40 w-auto drop-shadow-[4px_6px_0_rgba(75,42,123,0.18)] transition-transform duration-300 group-hover:-translate-y-1"
        />
      </div>

      <h3 className="mt-4 font-marker text-lg leading-snug text-lav-800">
        {product.name}
      </h3>
      <p className="mt-1 font-hand text-lg leading-snug text-lav-600">
        {product.tagline}
      </p>

      <div className="mt-3 flex items-center">
        <span className="font-marker text-xl text-lav-700">
          {price?.formatted ?? "Sold out"}
        </span>
        <span className="ml-auto rounded-full border-2 border-dashed border-lav-400 px-3 py-1 font-hand text-base text-lav-700 group-hover:bg-lav-600 group-hover:text-white">
          build it →
        </span>
      </div>
    </Link>
  );
}
