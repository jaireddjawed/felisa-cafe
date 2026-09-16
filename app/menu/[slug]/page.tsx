import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCTS, SIGNATURES, getProduct, money } from "@/lib/menu";
import { AddToCart } from "../../components/add-to-cart";
import { ProductCard } from "../../components/product-card";
import { CatSticker, DrinkGlass, Heart, Star } from "../../components/marks";

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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href="/menu"
        className="pop-sm pop-press inline-block bg-white px-4 py-1.5 font-bubble text-base text-grape-900"
      >
        ← back to the menu
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        {/* ── Polaroid ───────────────────────────────────────────────────── */}
        <div className="pop tape relative grid -rotate-1 place-items-center bg-white p-5">
          <Star size={26} className="wiggle absolute top-7 left-7 text-butter" />
          <Heart size={22} className="absolute right-8 bottom-24 text-bubblegum" />
          <div className="grid w-full place-items-center rounded-xl border-3 border-grape-900 bg-lilac-200 py-10">
            <DrinkGlass
              top={product.pour.top}
              bottom={product.pour.bottom}
              ice={product.category === "signature"}
              className="w-52"
            />
          </div>
          <p className="font-note mt-3 text-2xl text-grape-600">
            {product.name.toLowerCase()} ♡
          </p>
        </div>

        {/* ── Details ────────────────────────────────────────────────────── */}
        <div>
          {product.badge && (
            <span className="pop-sm inline-block -rotate-2 bg-bubblegum px-4 py-1 font-bubble text-base text-white">
              {product.badge}
            </span>
          )}
          <h1 className="mt-3 font-bubble text-5xl leading-none text-grape-900 sm:text-6xl">
            {product.name}
          </h1>
          <p className="font-note mt-3 text-3xl leading-tight text-grape-600">
            {product.tagline}
          </p>

          <div className="mt-6 flex items-center gap-4">
            <span className="starburst grid h-20 w-20 place-items-center bg-butter font-bubble text-xl text-grape-900">
              {money(product.price)}
            </span>
            {product.size && (
              <span className="font-note text-2xl text-grape-600">
                {product.size}
              </span>
            )}
          </div>

          <p className="font-note mt-6 text-2xl leading-snug text-grape-900">
            {product.description}
          </p>

          <ul className="mt-5 flex flex-wrap gap-2">
            {product.ingredients.map((item) => (
              <li
                key={item}
                className="pop-sm flex items-center gap-2 bg-white px-4 py-1.5 font-bubble text-base text-grape-900"
              >
                <Star size={12} className="text-mint" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <AddToCart product={product} />
          </div>
        </div>
      </div>

      <section className="mt-20">
        <div className="flex items-center gap-3">
          <CatSticker size={36} className="text-grape-600" />
          <h2 className="font-bubble text-4xl text-grape-900 sm:text-5xl">
            you might also like
          </h2>
        </div>
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {alsoLike.map((item, i) => (
            <ProductCard key={item.slug} product={item} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
