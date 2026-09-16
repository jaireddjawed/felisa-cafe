import Link from "next/link";
import { money, type Product } from "@/lib/menu";
import { DrinkGlass } from "./marks";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/menu/${product.slug}`}
      className="card-soft card-soft-hover group block overflow-hidden"
    >
      <div className="relative grid place-items-center bg-mist-100 py-10">
        {product.badge && (
          <span className="eyebrow absolute top-4 left-5">{product.badge}</span>
        )}
        <DrinkGlass
          top={product.pour.top}
          bottom={product.pour.bottom}
          ice={product.category === "signature"}
          className="h-40 w-auto text-plum-900 transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      <div className="px-6 py-5">
        <div className="flex items-baseline gap-3">
          <h3 className="font-medium text-plum-900">{product.name}</h3>
          <span className="ml-auto text-sm text-muted">
            {money(product.price)}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {product.tagline}
        </p>
      </div>
    </Link>
  );
}
