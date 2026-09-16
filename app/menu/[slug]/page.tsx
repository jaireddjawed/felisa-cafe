import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCTS, SIGNATURES, getProduct, money } from "@/lib/menu";
import { AddToCart } from "../../components/add-to-cart";
import { ProductCard } from "../../components/product-card";
import { DrinkGlass, Motif, Sprig } from "../../components/marks";

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
        className="text-sm text-quiet underline-offset-4 transition-colors hover:text-plum-600 hover:underline"
      >
        ← Menu
      </Link>

      <div className="mt-8 grid gap-16 lg:grid-cols-2">
        <div className="arch relative grid place-items-center overflow-hidden border border-paper-300 bg-paper-100 px-6 pt-20 pb-14">
          <span className="absolute top-10 text-sage/70">
            <Motif slug={product.slug} />
          </span>
          <DrinkGlass
            top={product.pour.top}
            bottom={product.pour.bottom}
            ice={product.category === "signature"}
            className="mt-6 w-52 text-plum-800"
          />
        </div>

        <div className="lg:py-6">
          {product.badge && <p className="label-fine">{product.badge}</p>}
          <h1 className="font-display mt-3 text-4xl leading-tight text-plum-800 sm:text-5xl">
            {product.name}
          </h1>
          <p className="font-display mt-3 text-2xl italic text-sage">
            {product.tagline}
          </p>

          <div className="rule-fine mt-7 flex items-baseline gap-4 pt-4">
            <span className="font-display text-3xl text-plum-800">
              {money(product.price)}
            </span>
            {product.size && (
              <span className="text-sm text-quiet">{product.size}</span>
            )}
          </div>

          <p className="drop-cap mt-7 leading-relaxed text-quiet">
            {product.description}
          </p>

          <ul className="mt-8 flex flex-col gap-2.5">
            {product.ingredients.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-sm text-plum-600"
              >
                <Sprig size={12} className="shrink-0 text-sage" />
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
        <h2 className="rule-fine font-display pt-4 text-2xl text-plum-800">
          You might also like
        </h2>
        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {alsoLike.map((item) => (
            <ProductCard key={item.slug} product={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
