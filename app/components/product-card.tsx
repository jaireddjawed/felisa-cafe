import Link from "next/link";
import { money, type Product } from "@/lib/menu";
import { DrinkGlass, Star } from "./marks";

const TILTS = ["-rotate-2", "rotate-1", "rotate-2", "-rotate-1"];
const MATS = ["bg-butter", "bg-mint", "bg-bubblegum", "bg-lilac-300"];

/** A polaroid taped into the scrapbook, price flagged with a sale starburst. */
export function ProductCard({
  product,
  index = 0,
}: {
  product: Product;
  index?: number;
}) {
  return (
    <Link
      href={`/menu/${product.slug}`}
      className={`pop pop-press group relative block bg-white p-3 ${
        TILTS[index % TILTS.length]
      } hover:rotate-0`}
    >
      {product.badge && (
        <span className="pop-sm absolute -top-3 -left-2 z-10 -rotate-6 bg-bubblegum px-3 py-0.5 font-bubble text-sm text-white">
          {product.badge}
        </span>
      )}

      <div
        className={`grid place-items-center rounded-xl border-3 border-grape-900 py-5 ${
          MATS[index % MATS.length]
        }`}
      >
        <DrinkGlass
          top={product.pour.top}
          bottom={product.pour.bottom}
          ice={product.category === "signature"}
          className="h-40 w-auto transition-transform duration-200 group-hover:-translate-y-1"
        />
      </div>

      <h3 className="mt-3 font-bubble text-xl leading-tight text-grape-900">
        {product.name}
      </h3>
      <p className="font-note mt-1 text-xl leading-snug text-grape-600">
        {product.tagline}
      </p>

      <div className="mt-3 flex items-center">
        <span className="starburst grid h-14 w-14 place-items-center bg-butter font-bubble text-sm text-grape-900">
          {money(product.price)}
        </span>
        <span className="pop-sm ml-auto bg-mint px-3 py-1 font-bubble text-sm text-grape-900">
          build it
        </span>
        <Star size={16} className="ml-2 text-bubblegum" />
      </div>
    </Link>
  );
}
