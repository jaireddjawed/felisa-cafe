import Link from "next/link";
import { money, type Product } from "@/lib/menu";
import { DrinkGlass, Motif } from "./marks";

/** A catalogue plate: arched frame, motif from wherever the drink was shot,
 *  then name and price on a single ruled line. */
export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/menu/${product.slug}`} className="group block">
      <div className="arch relative grid place-items-center overflow-hidden border border-paper-300 bg-paper-100 px-4 pt-12 pb-8 transition-colors duration-500 group-hover:border-plum-400">
        <span className="absolute top-5 text-sage/70">
          <Motif slug={product.slug} />
        </span>
        <DrinkGlass
          top={product.pour.top}
          bottom={product.pour.bottom}
          ice={product.category === "signature"}
          className="relative mt-4 h-36 w-auto text-plum-800 transition-transform duration-500 group-hover:-translate-y-1"
        />
      </div>

      <div className="rule-fine mt-4 flex items-baseline gap-3 pt-3">
        <h3 className="font-display text-lg text-plum-800">{product.name}</h3>
        <span className="ml-auto text-sm text-quiet">
          {money(product.price)}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-quiet">
        {product.tagline}
      </p>
    </Link>
  );
}
