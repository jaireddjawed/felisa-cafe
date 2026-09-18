import Link from "next/link";
import { PRODUCTS, SHOP, SIGNATURES } from "@/lib/menu";
import { ProductCard } from "./components/product-card";
import {
  CatFace,
  DrinkGlass,
  GirlDoodle,
  Sparkle,
  SquiggleRule,
} from "./components/doodles";

export default function HomePage() {
  const merch = PRODUCTS.filter((p) => p.category !== "signature");

  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-5 pb-16 pt-14 sm:pt-20">
        <Sparkle
          size={46}
          className="twinkle absolute left-[6%] top-10 text-lav-400"
        />
        <Sparkle
          size={26}
          className="twinkle absolute right-[10%] top-24 text-lav-500"
        />
        <Sparkle
          size={34}
          className="twinkle absolute bottom-16 left-[18%] text-lav-300"
        />

        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="flex items-center gap-2 font-hand text-xl text-lav-600">
              <CatFace size={26} /> Filipino-American coffee bar · Fullerton
            </p>

            <h1 className="mt-4 font-marker text-5xl leading-[1.15] text-lav-800 sm:text-6xl lg:text-7xl">
              Ube in the
              <br />
              bottom of
              <br />
              every cup.
            </h1>

            <p className="mt-6 max-w-md font-hand text-2xl leading-snug text-lav-700">
              Housemade syrups, matcha or espresso in anything, and five milks
              that never cost extra. Drawn, poured, and named by us.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/menu"
                className="sticker rounded-full bg-lav-600 px-7 py-3 font-marker text-base text-white transition hover:-rotate-2 hover:bg-lav-700"
              >
                Order ahead
              </Link>
              <Link
                href="/about"
                className="rounded-full border-3 border-dashed border-lav-500 px-7 py-3 font-hand text-xl text-lav-700 transition hover:bg-lav-300"
              >
                Who is Felisa?
              </Link>
            </div>
          </div>

          <div className="relative grid place-items-center">
            <div className="blob absolute inset-6 bg-lav-300/70" />
            <div className="relative flex items-end gap-2 sm:gap-5">
              {SIGNATURES.slice(0, 3).map((drink, i) => (
                <DrinkGlass
                  key={drink.slug}
                  top={drink.pour.top}
                  bottom={drink.pour.bottom}
                  className={`bob w-24 drop-shadow-[6px_8px_0_rgba(75,42,123,0.16)] sm:w-32 ${
                    i === 1 ? "mb-8 w-28 sm:w-40" : ""
                  }`}
                  // Stagger the float so the three glasses never bob in unison.
                  style={{ animationDelay: `${i * 0.8}s` }}
                />
              ))}
            </div>
            <GirlDoodle
              size={70}
              className="absolute -bottom-2 -right-2 rotate-6 text-lav-700"
            />
          </div>
        </div>
      </section>

      {/* ── Opening banner ───────────────────────────────────────────────── */}
      <section className="px-5">
        <div className="sticker mx-auto flex max-w-6xl -rotate-1 flex-col items-center gap-2 rounded-3xl bg-lav-600 px-6 py-6 text-center text-white sm:flex-row sm:text-left">
          <Sparkle size={26} className="twinkle text-lav-200" />
          <p className="font-marker text-xl sm:text-2xl">
            {SHOP.openingLabel}: {SHOP.openingDate}
          </p>
          <p className="font-hand text-xl text-lav-100 sm:ml-auto">
            {SHOP.host} · {SHOP.street}, {SHOP.city} · {SHOP.openingHours}
          </p>
        </div>
      </section>

      {/* ── Signature menu ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-20">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="font-marker text-4xl text-lav-800 sm:text-5xl">
            Signature menu
          </h2>
          <p className="font-hand text-2xl text-lav-600">
            16oz / matcha 12oz · all $8.50
          </p>
        </div>
        <SquiggleRule className="mt-3 h-5 w-full text-lav-400" />

        <div className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {SIGNATURES.map((drink, i) => (
            <ProductCard key={drink.slug} product={drink} index={i} />
          ))}
        </div>
      </section>

      {/* ── Free modifications ───────────────────────────────────────────── */}
      <section className="mx-auto mt-24 max-w-6xl px-5">
        <div className="sticker grid gap-8 rounded-[2.5rem] bg-lav-100 p-8 sm:p-12 lg:grid-cols-2">
          <div>
            <h2 className="font-marker text-3xl leading-snug text-lav-800">
              Free modifications,
              <br />
              actually free
            </h2>
            <p className="mt-4 font-hand text-2xl leading-snug text-lav-700">
              Every milk on our bar is the same price: nothing. Swap the base for
              matcha in any espresso drink and we will not blink.
            </p>
            <CatFace size={64} className="mt-6 text-lav-400" />
          </div>

          <dl className="grid content-start gap-5">
            <div>
              <dt className="font-marker text-base text-lav-700">Milks</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {[
                  "whole",
                  "oat",
                  "almond",
                  "coconut",
                  "non-fat",
                ].map((milk) => (
                  <span
                    key={milk}
                    className="rounded-full border-2 border-dashed border-lav-400 bg-white px-4 py-1.5 font-hand text-lg text-lav-700"
                  >
                    {milk}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="font-marker text-base text-lav-700">
                Optional add-ons
              </dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {["maple cold foam +$1", "ube whipped cream +$1"].map((x) => (
                  <span
                    key={x}
                    className="rounded-full bg-lav-600 px-4 py-1.5 font-hand text-lg text-white"
                  >
                    {x}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── Take home ────────────────────────────────────────────────────── */}
      <section className="mx-auto mt-24 max-w-6xl px-5">
        <h2 className="font-marker text-4xl text-lav-800 sm:text-5xl">
          Take some home
        </h2>
        <SquiggleRule className="mt-3 h-5 w-full text-lav-400" />
        <div className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {merch.map((item, i) => (
            <ProductCard key={item.slug} product={item} index={i + 1} />
          ))}
        </div>
      </section>
    </>
  );
}
