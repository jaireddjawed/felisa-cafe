import Link from "next/link";
import { PRODUCTS, SHOP, SIGNATURES, money } from "@/lib/menu";
import { ProductCard } from "./components/product-card";
import { CatSign, DrinkGlass, Star } from "./components/marks";

export default function HomePage() {
  const merch = PRODUCTS.filter((p) => p.category !== "signature");

  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pt-20 pb-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="overline flex items-center gap-2.5">
              <Star size={10} className="pulse-glow" /> Five til midnight ·
              Fullerton
            </p>

            <h1 className="mt-6 font-display text-6xl leading-[0.95] font-extrabold tracking-tight uppercase sm:text-7xl lg:text-8xl">
              <span className="neon flicker">Ube</span>
              <br />
              after dark
            </h1>

            <p className="mt-7 max-w-md leading-relaxed text-haze">
              A Filipino-American coffee bar that opens when the rest of them
              close. Four housemade syrups, espresso or matcha in anything, and
              five milks that never cost extra.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/menu"
                className="rounded-full border border-glow-400 bg-glow-600/40 px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-glow-600/70 hover:shadow-[0_0_40px_-6px_rgba(168,108,245,0.95)]"
              >
                Order ahead
              </Link>
              <Link
                href="/about"
                className="rounded-full border border-white/15 px-8 py-3.5 text-sm text-haze transition-colors hover:border-glow-500/60 hover:text-glow-300"
              >
                Our story
              </Link>
            </div>
          </div>

          <div className="relative grid place-items-center">
            <div className="pulse-glow absolute h-72 w-72 rounded-full bg-glow-600/35 blur-[90px]" />
            <div className="relative flex items-end gap-3 sm:gap-6">
              {SIGNATURES.slice(0, 3).map((drink, i) => (
                <DrinkGlass
                  key={drink.slug}
                  top={drink.pour.top}
                  bottom={drink.pour.bottom}
                  className={`w-24 sm:w-32 ${i === 1 ? "mb-10 w-28 sm:w-40" : ""}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Neon hours sign ──────────────────────────────────────────────── */}
      <section className="px-5">
        <div className="panel mx-auto flex max-w-6xl flex-col items-center gap-3 px-8 py-10 text-center sm:flex-row sm:text-left">
          <CatSign size={52} className="flicker text-glow-400" />
          <div>
            <p className="overline">{SHOP.openingLabel}</p>
            <p className="mt-1.5 font-display text-2xl font-bold tracking-tight">
              {SHOP.openingDate}
            </p>
          </div>
          <p className="neon-warm font-display text-3xl font-extrabold sm:ml-auto">
            {SHOP.openingHours}
          </p>
          <p className="text-sm leading-relaxed text-haze sm:max-w-[16rem]">
            {SHOP.host}
            <br />
            {SHOP.street}, {SHOP.city}
          </p>
        </div>
      </section>

      {/* ── Signature menu ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-28">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="overline">The signatures</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight uppercase sm:text-5xl">
              Four pours, all {money(8.5)}
            </h2>
          </div>
          <Link
            href="/menu"
            className="ml-auto text-sm text-glow-300 underline-offset-4 hover:underline"
          >
            See everything →
          </Link>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SIGNATURES.map((drink) => (
            <ProductCard key={drink.slug} product={drink} />
          ))}
        </div>
      </section>

      {/* ── Modifications ────────────────────────────────────────────────── */}
      <section className="mx-auto mt-28 max-w-6xl px-5">
        <div className="panel grid gap-12 p-10 sm:p-14 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="overline">Modifications</p>
            <h2 className="neon mt-4 font-display text-4xl leading-tight font-extrabold uppercase">
              Free
              <br />
              means free
            </h2>
            <p className="mt-6 leading-relaxed text-haze">
              Every milk on the bar costs the same: nothing. Swap espresso for
              matcha in any drink and the price does not move either.
            </p>
          </div>

          <dl className="grid content-start gap-8">
            <div>
              <dt className="overline">Choice of milk</dt>
              <dd className="mt-3 flex flex-wrap gap-2">
                {["Whole", "Oat", "Almond", "Coconut", "Non-fat"].map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm text-haze"
                  >
                    {m}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="overline">Optional add-ons</dt>
              <dd className="mt-3 flex flex-wrap gap-2">
                {["Maple cold foam +$1", "Ube whipped cream +$1"].map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-glow-500/50 bg-glow-600/25 px-4 py-2 text-sm text-glow-300"
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
      <section className="mx-auto mt-28 max-w-6xl px-5">
        <p className="overline">Take home</p>
        <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight uppercase sm:text-5xl">
          Syrups and small things
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {merch.map((item) => (
            <ProductCard key={item.slug} product={item} />
          ))}
        </div>
      </section>
    </>
  );
}
