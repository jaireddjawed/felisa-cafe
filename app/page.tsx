import Link from "next/link";
import { PRODUCTS, SHOP, SIGNATURES } from "@/lib/menu";
import { ProductCard } from "./components/product-card";
import {
  CatLine,
  Cloud,
  DrinkGlass,
  Grass,
  Sprig,
  Succulent,
} from "./components/marks";

export default function HomePage() {
  const merch = PRODUCTS.filter((p) => p.category !== "signature");

  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <Cloud size={90} className="absolute top-12 right-[8%] text-sky/55" />
        <Succulent size={70} className="absolute bottom-24 left-[4%] text-sage/45" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 pt-20 pb-24 lg:grid-cols-[1fr_0.75fr]">
          <div>
            <p className="label-fine flex items-center gap-3">
              <Sprig size={14} className="sway text-sage" /> Fullerton,
              California
            </p>

            <h1 className="mt-6 font-display text-5xl leading-[1.08] text-plum-800 sm:text-6xl lg:text-7xl">
              Grown, cooked,
              <br />
              and poured
              <br />
              <span className="italic text-sage">by hand.</span>
            </h1>

            <p className="mt-8 max-w-md leading-relaxed text-quiet">
              A Filipino-American coffee bar built on four syrups we cook
              ourselves — ube, chocolate, caramelized banana, coconut. Espresso
              or matcha in any of them, and five milks that never cost extra.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/menu"
                className="rounded-sm bg-plum-600 px-8 py-3.5 text-sm text-paper-50 transition-colors hover:bg-plum-800"
              >
                Order ahead
              </Link>
              <Link
                href="/about"
                className="rounded-sm border border-paper-300 px-8 py-3.5 text-sm text-plum-600 transition-colors hover:border-plum-400"
              >
                Our story
              </Link>
            </div>
          </div>

          <div className="arch relative grid place-items-center overflow-hidden border border-paper-300 bg-paper-100 px-6 pt-16 pb-10">
            <Sprig size={26} className="sway absolute top-8 text-sage" />
            <DrinkGlass
              top={SIGNATURES[0].pour.top}
              bottom={SIGNATURES[0].pour.bottom}
              className="mt-6 w-44 text-plum-800"
            />
            <p className="label-fine mt-6">Plate I — The Felisa Latte</p>
          </div>
        </div>

        <Grass className="h-10 w-full text-sage/40" />
      </section>

      {/* ── Opening notice, set like a card in a seed packet ──────────────── */}
      <section className="px-6 pt-16">
        <div className="pressed mx-auto max-w-3xl px-10 py-10 text-center">
          <p className="label-fine">{SHOP.openingLabel}</p>
          <p className="font-display mt-3 text-3xl text-plum-800 sm:text-4xl">
            {SHOP.openingDate}
          </p>
          <p className="mt-3 leading-relaxed text-quiet">
            {SHOP.openingHours} · {SHOP.host}
            <br />
            {SHOP.street}, {SHOP.city}
          </p>
        </div>
      </section>

      {/* ── Signature menu ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-28">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="label-fine">The signatures</p>
            <h2 className="font-display mt-3 text-4xl text-plum-800">
              Four drinks, all $8.50
            </h2>
          </div>
          <Link
            href="/menu"
            className="ml-auto text-sm text-plum-600 underline-offset-4 hover:underline"
          >
            See everything →
          </Link>
        </div>

        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {SIGNATURES.map((drink) => (
            <ProductCard key={drink.slug} product={drink} />
          ))}
        </div>
      </section>

      {/* ── Modifications ────────────────────────────────────────────────── */}
      <section className="mx-auto mt-28 max-w-6xl px-6">
        <div className="pressed grid gap-12 p-10 sm:p-14 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="label-fine">Modifications</p>
            <h2 className="font-display mt-3 text-3xl leading-tight text-plum-800">
              Free means <span className="italic text-sage">free</span>.
            </h2>
            <p className="mt-5 leading-relaxed text-quiet">
              Every milk on the bar costs the same: nothing. Swap espresso for
              matcha in any drink and the price does not move either.
            </p>
            <CatLine size={40} className="mt-8 text-plum-400" />
          </div>

          <dl className="grid content-start gap-8">
            <div>
              <dt className="label-fine">Choice of milk</dt>
              <dd className="rule-fine mt-3 flex flex-wrap gap-2 pt-4">
                {["Whole", "Oat", "Almond", "Coconut", "Non-fat"].map((m) => (
                  <span
                    key={m}
                    className="rounded-sm border border-paper-300 px-4 py-2 text-sm text-quiet"
                  >
                    {m}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="label-fine">Optional add-ons</dt>
              <dd className="rule-fine mt-3 flex flex-wrap gap-2 pt-4">
                {["Maple cold foam +$1", "Ube whipped cream +$1"].map((m) => (
                  <span
                    key={m}
                    className="rounded-sm bg-paper-200 px-4 py-2 text-sm text-plum-600"
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
      <section className="mx-auto mt-28 max-w-6xl px-6">
        <p className="label-fine">Take home</p>
        <h2 className="font-display mt-3 text-4xl text-plum-800">
          Syrups and small things
        </h2>
        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {merch.map((item) => (
            <ProductCard key={item.slug} product={item} />
          ))}
        </div>
      </section>
    </>
  );
}
