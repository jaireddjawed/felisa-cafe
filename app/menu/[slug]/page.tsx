import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCTS, SIGNATURES, getProduct, money } from "@/lib/menu";
import { AddToCart } from "../../components/add-to-cart";
import { ProductCard } from "../../components/product-card";
import { DrinkGlass, Star } from "../../components/marks";

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
    <div className="mx-auto max-w-6xl px-5 py-14">
      <Link
        href="/menu"
        className="text-sm text-haze underline-offset-4 transition-colors hover:text-glow-300 hover:underline"
      >
        ← Menu
      </Link>

      <div className="mt-8 grid gap-16 lg:grid-cols-2">
        <div className="panel relative grid place-items-center overflow-hidden py-24">
          <div
            className="pulse-glow absolute h-56 w-56 rounded-full blur-[70px]"
            style={{ backgroundColor: product.pour.bottom, opacity: 0.5 }}
          />
          <DrinkGlass
            top={product.pour.top}
            bottom={product.pour.bottom}
            ice={product.category === "signature"}
            className="relative w-56"
          />
        </div>

        <div className="lg:py-6">
          {product.badge && <p className="overline">{product.badge}</p>}
          <h1 className="neon mt-4 font-display text-5xl leading-[0.95] font-extrabold tracking-tight uppercase">
            {product.name}
          </h1>
          <p className="mt-5 text-xl leading-snug text-glow-300">
            {product.tagline}
          </p>

          <div className="mt-7 flex items-baseline gap-4">
            <span className="font-display text-3xl font-extrabold">
              {money(product.price)}
            </span>
            {product.size && (
              <span className="text-sm text-haze">{product.size}</span>
            )}
          </div>

          <p className="mt-7 leading-relaxed text-haze">
            {product.description}
          </p>

          <ul className="mt-8 flex flex-col gap-2.5">
            {product.ingredients.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-sm text-white/90"
              >
                <Star size={9} className="shrink-0 text-glow-400" />
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
        <h2 className="hairline-glow pt-5 font-display text-2xl font-bold tracking-tight uppercase">
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
