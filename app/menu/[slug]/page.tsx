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
    <div className="mx-auto max-w-7xl px-5 py-12">
      <Link href="/menu" className="kicker text-violet hover:text-void">
        ← Back to menu
      </Link>

      <div className="mt-8 grid gap-12 lg:grid-cols-2">
        <div className="relative grid place-items-center border-4 border-void bg-violet py-20">
          <Star size={26} className="absolute top-6 left-6 text-neon" />
          <DrinkGlass
            top={product.pour.top}
            bottom={product.pour.bottom}
            ice={product.category === "signature"}
            className="w-60 text-paper"
          />
        </div>

        <div>
          {product.badge && <p className="kicker text-violet">{product.badge}</p>}
          <h1 className="poster mt-3 text-6xl leading-[0.88] text-void sm:text-7xl">
            {product.name}
          </h1>
          <p className="font-serif mt-5 text-3xl italic text-violet">
            {product.tagline}
          </p>

          <p className="poster hairline mt-8 flex items-baseline gap-5 pt-5 text-5xl text-void">
            {money(product.price)}
            {product.size && (
              <span className="kicker font-body text-grape">{product.size}</span>
            )}
          </p>

          <p className="mt-7 text-lg leading-relaxed text-grape">
            {product.description}
          </p>

          <ul className="mt-8">
            {product.ingredients.map((item) => (
              <li
                key={item}
                className="hairline flex items-center gap-3 py-3 text-void"
              >
                <Star size={11} className="shrink-0 text-violet" />
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
        <h2 className="poster text-4xl text-void sm:text-6xl">
          You might also like
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {alsoLike.map((item, i) => (
            <ProductCard key={item.slug} product={item} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
