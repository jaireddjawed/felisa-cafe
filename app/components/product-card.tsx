import Link from "next/link";
import { money, type Product } from "@/lib/menu";
import { DrinkGlass } from "./marks";

/** Poster tile: number, flat art, then the name set as large as it will go. */
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
      className="group block border-4 border-void bg-paper transition-colors hover:bg-void"
    >
      <div className="relative grid place-items-center border-b-4 border-void bg-paper-dim py-8 transition-colors group-hover:bg-violet">
        <span className="kicker absolute top-3 left-4 text-void group-hover:text-paper">
          {String(index + 1).padStart(2, "0")}
        </span>
        <DrinkGlass
          top={product.pour.top}
          bottom={product.pour.bottom}
          ice={product.category === "signature"}
          className="h-40 w-auto text-void transition-transform duration-300 group-hover:-translate-y-1 group-hover:text-paper"
        />
      </div>

      <div className="px-5 py-5">
        <h3 className="poster text-2xl text-void group-hover:text-paper">
          {product.name}
        </h3>
        <p className="mt-2 text-sm leading-snug text-grape group-hover:text-neon">
          {product.tagline}
        </p>
        <p className="poster mt-4 text-xl text-violet group-hover:text-neon">
          {money(product.price)}
        </p>
      </div>
    </Link>
  );
}
