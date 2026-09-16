import Link from "next/link";
import { PRODUCTS, SHOP, SIGNATURES } from "@/lib/menu";
import { ProductCard } from "./components/product-card";
import { CatSticker, DrinkGlass, Heart, Star } from "./components/marks";

export default function HomePage() {
  const merch = PRODUCTS.filter((p) => p.category !== "signature");

  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pt-12 pb-16">
        <Star size={44} className="wiggle absolute top-8 left-[7%] text-butter" />
        <Star size={26} className="wiggle absolute top-28 right-[12%] text-mint" />
        <Heart size={30} className="absolute bottom-12 left-[20%] text-bubblegum" />

        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="pop-sm inline-flex items-center gap-2 bg-mint px-4 py-1 font-bubble text-base text-grape-900">
              <span className="blink">●</span> now open in fullerton
            </span>

            <h1 className="mt-5 font-bubble text-6xl leading-[0.95] text-grape-900 sm:text-7xl lg:text-8xl">
              ube in the
              <br />
              <span className="text-bubblegum">bottom</span> of
              <br />
              every cup
            </h1>

            <p className="font-note mt-6 max-w-md text-3xl leading-tight text-grape-600">
              housemade syrups, espresso or matcha in anything, and five milks
              that never cost extra!!
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/menu"
                className="pop pop-press bg-bubblegum px-8 py-4 font-bubble text-2xl text-white"
              >
                order ahead
              </Link>
              <Link
                href="/about"
                className="pop pop-press bg-white px-8 py-4 font-bubble text-2xl text-grape-900"
              >
                who is felisa?
              </Link>
            </div>
          </div>

          <div className="relative grid place-items-center">
            <div className="pop absolute inset-4 rotate-3 bg-butter" />
            <div className="pop relative flex items-end gap-2 bg-white p-5 sm:gap-4">
              {SIGNATURES.slice(0, 3).map((drink, i) => (
                <DrinkGlass
                  key={drink.slug}
                  top={drink.pour.top}
                  bottom={drink.pour.bottom}
                  className={`w-20 sm:w-28 ${i === 1 ? "mb-6 w-24 sm:w-32" : ""}`}
                />
              ))}
            </div>
            <CatSticker
              size={64}
              className="wiggle absolute -right-3 -bottom-4 text-grape-600"
            />
          </div>
        </div>
      </section>

      {/* ── Opening flag ─────────────────────────────────────────────────── */}
      <section className="px-4">
        <div className="pop tape mx-auto flex max-w-5xl -rotate-1 flex-col items-center gap-2 bg-butter px-6 py-7 text-center sm:flex-row sm:text-left">
          <Star size={26} className="wiggle text-bubblegum" />
          <p className="font-bubble text-2xl text-grape-900">
            {SHOP.openingLabel}: {SHOP.openingDate}
          </p>
          <p className="font-note text-2xl text-grape-600 sm:ml-auto">
            {SHOP.host} · {SHOP.street} · {SHOP.openingHours}
          </p>
        </div>
      </section>

      {/* ── Signature menu ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <div className="flex flex-wrap items-end gap-4">
          <h2 className="font-bubble text-5xl text-grape-900 sm:text-6xl">
            signature menu
          </h2>
          <span className="pop-sm bg-mint px-4 py-1 font-bubble text-base text-grape-900">
            16oz / matcha 12oz · all $8.50
          </span>
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {SIGNATURES.map((drink, i) => (
            <ProductCard key={drink.slug} product={drink} index={i} />
          ))}
        </div>
      </section>

      {/* ── Modifications ────────────────────────────────────────────────── */}
      <section className="mx-auto mt-24 max-w-6xl px-4">
        <div className="pop grid gap-8 bg-white p-8 sm:p-12 lg:grid-cols-2">
          <div>
            <h2 className="font-bubble text-4xl leading-tight text-grape-900">
              free mods,
              <br />
              <span className="text-bubblegum">actually free</span>
            </h2>
            <p className="font-note mt-4 text-3xl leading-tight text-grape-600">
              every milk costs the same: nothing. swap espresso for matcha and
              we will not even blink
            </p>
            <CatSticker size={64} className="mt-6 text-lilac-300" />
          </div>

          <dl className="grid content-start gap-6">
            <div>
              <dt className="font-bubble text-xl text-grape-900">milks</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {["whole", "oat", "almond", "coconut", "non-fat"].map((m) => (
                  <span
                    key={m}
                    className="pop-sm bg-lilac-200 px-4 py-1.5 font-bubble text-base text-grape-900"
                  >
                    {m}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="font-bubble text-xl text-grape-900">add-ons</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {["maple cold foam +$1", "ube whipped cream +$1"].map((m) => (
                  <span
                    key={m}
                    className="pop-sm bg-bubblegum px-4 py-1.5 font-bubble text-base text-white"
                  >
                    {m}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── Take home ────────────────────────────────────────────────────── */}
      <section className="mx-auto mt-24 max-w-6xl px-4">
        <h2 className="font-bubble text-5xl text-grape-900 sm:text-6xl">
          take some home
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {merch.map((item, i) => (
            <ProductCard key={item.slug} product={item} index={i + 2} />
          ))}
        </div>
      </section>
    </>
  );
}
