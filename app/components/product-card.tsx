import Link from "next/link";
import { money, type Product } from "@/lib/menu";
import { DrinkGlass } from "./marks";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/menu/${product.slug}`}
      className="panel panel-lift group block overflow-hidden"
    >
      <div className="relative grid place-items-center py-10">
        {/* The drink's own colour, thrown onto the wall behind it. */}
        <div
          className="pulse-glow absolute h-32 w-32 rounded-full blur-3xl"
          style={{ backgroundColor: product.pour.bottom, opacity: 0.45 }}
        />
        {product.badge && (
          <span className="overline absolute top-4 left-5">{product.badge}</span>
        )}
        <DrinkGlass
          top={product.pour.top}
          bottom={product.pour.bottom}
          ice={product.category === "signature"}
          className="relative h-40 w-auto transition-transform duration-500 group-hover:-translate-y-1.5"
        />
      </div>

      <div className="border-t border-white/10 px-6 py-5">
        <div className="flex items-baseline gap-3">
          <h3 className="font-display font-bold tracking-tight text-white">
            {product.name}
          </h3>
          <span className="ml-auto text-sm text-glow-300">
            {money(product.price)}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-haze">
          {product.tagline}
        </p>
      </div>
    </Link>
  );
}
