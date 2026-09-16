import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCTS, SIGNATURES, getProduct, money } from "@/lib/menu";
import { AddToCart } from "../../components/add-to-cart";
import { ProductCard } from "../../components/product-card";
import { DrinkGlass, Sparkle } from "../../components/marks";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  props: PageProps<"/menu/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const product = getProduct(slug);
  if (!product) return { title: "Not on the menu" };
  return { title: product.name, description: product.tagline };
}

export default async function ProductPage(props: PageProps<"/menu/[slug]">) {
  const { slug } = await props.params;
  const product = getProduct(slug);
  if (!product) notFound();

  const alsoLike = SIGNATURES.filter((p) => p.slug !== product.slug).slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <Link
        href="/menu"
        className="text-sm text-muted underline-offset-4 transition-colors hover:text-plum-700 hover:underline"
      >
        ← Menu
      </Link>

      <div className="mt-8 grid gap-16 lg:grid-cols-2">
        <div className="relative grid place-items-center overflow-hidden rounded-[2rem] bg-mist-100 py-20">
          <div className="orb top-6 left-10 h-48 w-48 bg-plum-400/30" />
          <DrinkGlass
            top={product.pour.top}
            bottom={product.pour.bottom}
            ice={product.category === "signature"}
            className="relative w-56 text-plum-900 drop-shadow-[0_24px_40px_rgba(85,58,131,0.22)]"
          />
        </div>

        <div className="lg:py-6">
          {product.badge && <p className="eyebrow">{product.badge}</p>}
          <h1 className="mt-3 text-4xl leading-tight font-light tracking-tight text-plum-900 sm:text-5xl">
            {product.name}
          </h1>
          <p className="font-script mt-3 text-2xl text-plum-500">
            {product.tagline}
          </p>

          <div className="mt-6 flex items-baseline gap-4">
            <span className="text-2xl font-light text-plum-900">
              {money(product.price)}
            </span>
            {product.size && (
              <span className="text-sm text-muted">{product.size}</span>
            )}
          </div>

          <p className="mt-7 leading-relaxed text-muted">
            {product.description}
          </p>

          <ul className="mt-7 flex flex-col gap-2.5">
            {product.ingredients.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-sm text-plum-700"
              >
                <Sparkle size={10} className="shrink-0 text-plum-400" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <AddToCart product={product} />
          </div>
        </div>
      </div>

      <section className="mt-28">
        <h2 className="border-b border-mist-200 pb-4 text-2xl font-light text-plum-900">
          You might also like
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {alsoLike.map((item) => (
            <ProductCard key={item.slug} product={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
