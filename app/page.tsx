import Link from "next/link";
import { PRODUCTS, SHOP, SIGNATURES } from "@/lib/menu";
import { ProductCard } from "./components/product-card";
import { CatMark, DrinkGlass, Sparkle } from "./components/marks";

export default function HomePage() {
  const merch = PRODUCTS.filter((p) => p.category !== "signature");

  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="orb -top-24 -left-24 h-96 w-96 bg-mist-300" />
        <div className="orb top-10 right-0 h-80 w-80 bg-plum-400/40" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 pt-24 pb-28 lg:grid-cols-[1fr_0.8fr]">
          <div className="rise">
            <p className="eyebrow flex items-center gap-2">
              <Sparkle size={11} /> Fullerton, California
            </p>

            <h1 className="mt-6 text-5xl leading-[1.05] font-light tracking-tight text-plum-900 sm:text-6xl lg:text-7xl">
              Ube in the bottom
              <br />
              of every cup.
            </h1>

            <p className="font-script mt-4 text-3xl text-plum-500">
              espresso or matcha, always your choice
            </p>

            <p className="mt-7 max-w-md leading-relaxed text-muted">
              A Filipino-American coffee bar built on syrups we cook ourselves —
              ube, chocolate, caramelized banana, coconut. Five milks, none of
              them an upcharge.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/menu"
                className="rounded-full bg-plum-600 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-plum-700"
              >
                Order ahead
              </Link>
              <Link
                href="/about"
                className="rounded-full border border-mist-300 px-8 py-3.5 text-sm text-plum-700 transition-colors hover:border-plum-400"
              >
                Our story
              </Link>
            </div>
          </div>

          <div className="rise relative grid place-items-center">
            <div className="absolute inset-8 rounded-full bg-mist-200" />
            <DrinkGlass
              top={SIGNATURES[0].pour.top}
              bottom={SIGNATURES[0].pour.bottom}
              className="relative w-56 text-plum-900 drop-shadow-[0_24px_40px_rgba(85,58,131,0.25)]"
            />
          </div>
        </div>
      </section>

      {/* ── Opening detail strip ─────────────────────────────────────────── */}
      <section className="border-y border-mist-200 bg-mist-100">
        <dl className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-3">
          {[
            { label: SHOP.openingLabel, value: SHOP.openingDate },
            { label: "Hours", value: SHOP.openingHours },
            { label: "Inside", value: SHOP.host },
          ].map((item) => (
            <div key={item.label}>
              <dt className="eyebrow">{item.label}</dt>
              <dd className="mt-2 text-lg font-light text-plum-900">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Signature menu ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-28">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="eyebrow">The signatures</p>
            <h2 className="mt-3 text-4xl font-light tracking-tight text-plum-900">
              Four drinks, all $8.50
            </h2>
          </div>
          <Link
            href="/menu"
            className="ml-auto text-sm text-plum-700 underline-offset-4 hover:underline"
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
      <section className="mx-auto mt-28 max-w-6xl px-6">
        <div className="card-soft grid gap-12 p-10 sm:p-14 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow">Modifications</p>
            <h2 className="mt-3 text-3xl leading-tight font-light text-plum-900">
              Free means free.
            </h2>
            <p className="mt-5 leading-relaxed text-muted">
              Every milk on the bar costs the same: nothing. Swap espresso for
              matcha in any drink and the price does not move either.
            </p>
            <CatMark size={40} className="mt-8 text-mist-400" />
          </div>

          <dl className="grid content-start gap-8">
            <div>
              <dt className="eyebrow">Milk</dt>
              <dd className="mt-3 flex flex-wrap gap-2">
                {["Whole", "Oat", "Almond", "Coconut", "Non-fat"].map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-mist-300 px-4 py-2 text-sm text-muted"
                  >
                    {m}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Optional add-ons</dt>
              <dd className="mt-3 flex flex-wrap gap-2">
                {["Maple cold foam +$1", "Ube whipped cream +$1"].map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-mist-200 px-4 py-2 text-sm text-plum-700"
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
        <p className="eyebrow">Take home</p>
        <h2 className="mt-3 text-4xl font-light tracking-tight text-plum-900">
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
