import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCTS, SIGNATURES, getProduct } from "@/lib/menu";
import { money } from "@/lib/menu";
import { AddToCart } from "../../components/add-to-cart";
import { ProductCard } from "../../components/product-card";
import {
  CatFace,
  DrinkGlass,
  Sparkle,
  SquiggleRule,
} from "../../components/doodles";

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
    <div className="mx-auto max-w-6xl px-5 py-12">
      <Link
        href="/menu"
        className="font-hand text-xl text-lav-600 underline decoration-dashed hover:text-lav-800"
      >
        ← back to the menu
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        {/* ── The drink, drawn ───────────────────────────────────────────── */}
        <div className="sticker relative grid place-items-center overflow-hidden rounded-[2.5rem] bg-lav-300/70 py-14">
          <Sparkle
            size={34}
            className="twinkle absolute left-8 top-8 text-white"
          />
          <Sparkle
            size={22}
            className="twinkle absolute bottom-10 right-10 text-white"
          />
          <DrinkGlass
            top={product.pour.top}
            bottom={product.pour.bottom}
            ice={product.category === "signature"}
            className="bob w-56 drop-shadow-[8px_10px_0_rgba(75,42,123,0.18)]"
          />
          <CatFace
            size={54}
            className="absolute bottom-6 left-8 -rotate-6 text-lav-700/70"
          />
        </div>

        {/* ── The details ────────────────────────────────────────────────── */}
        <div>
          {product.badge && (
            <span className="inline-block -rotate-2 rounded-full bg-lav-600 px-4 py-1 font-hand text-base text-white">
              {product.badge}
            </span>
          )}
          <h1 className="mt-3 font-marker text-4xl leading-tight text-lav-800 sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-3 font-hand text-2xl text-lav-600">
            {product.tagline}
          </p>

          <p className="mt-5 font-marker text-3xl text-lav-700">
            {money(product.price)}
            {product.size && (
              <span className="ml-3 font-hand text-xl text-lav-600">
                {product.size}
              </span>
            )}
          </p>

          <SquiggleRule className="my-6 h-5 w-full text-lav-400" />

          <p className="font-hand text-2xl leading-snug text-lav-700">
            {product.description}
          </p>

          <ul className="mt-6 flex flex-wrap gap-2">
            {product.ingredients.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 rounded-full border-2 border-dashed border-lav-400 bg-lav-100 px-4 py-1.5 font-hand text-lg text-lav-700"
              >
                <Sparkle size={12} className="text-lav-500" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <AddToCart product={product} />
          </div>
        </div>
      </div>

      <section className="mt-24">
        <h2 className="font-marker text-3xl text-lav-800 sm:text-4xl">
          You might also like
        </h2>
        <SquiggleRule className="mt-3 h-5 w-full text-lav-400" />
        <div className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {alsoLike.map((item, i) => (
            <ProductCard key={item.slug} product={item} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
