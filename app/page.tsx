import Link from "next/link";
import { PRODUCTS, SHOP, SIGNATURES, money } from "@/lib/menu";
import { ProductCard } from "./components/product-card";
import { CatMark, DrinkGlass, Marquee, Star } from "./components/marks";

export default function HomePage() {
  const merch = PRODUCTS.filter((p) => p.category !== "signature");

  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="border-b-8 border-void bg-paper">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[1.25fr_0.75fr] lg:py-24">
          <div>
            <p className="kicker flex items-center gap-3 text-violet">
              <Star size={12} /> Filipino-American coffee · Fullerton CA
            </p>

            <h1 className="poster mt-6 text-[17vw] text-void lg:text-[9.5rem]">
              Ube
              <br />
              First
            </h1>

            <p className="font-serif mt-6 max-w-lg text-3xl leading-tight italic text-violet">
              Four drinks, four syrups we cook ourselves, and five milks that
              never cost a cent extra.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/menu"
                className="poster bg-void px-10 py-5 text-lg text-paper transition-colors hover:bg-violet"
              >
                Order ahead
              </Link>
              <Link
                href="/about"
                className="poster border-4 border-void px-10 py-5 text-lg text-void transition-colors hover:bg-void hover:text-paper"
              >
                The story
              </Link>
            </div>
          </div>

          <div className="relative grid place-items-center border-4 border-void bg-violet">
            <DrinkGlass
              top={SIGNATURES[0].pour.top}
              bottom={SIGNATURES[0].pour.bottom}
              className="w-48 text-paper sm:w-64"
            />
            <p className="kicker absolute bottom-4 text-paper">
              The Felisa Latte · {money(SIGNATURES[0].price)}
            </p>
          </div>
        </div>
      </section>

      <Marquee
        items={[
          `${SHOP.openingLabel} ${SHOP.openingDate}`,
          SHOP.openingHours,
          SHOP.host,
          SHOP.street,
        ]}
        className="border-b-8 border-void bg-neon py-3 text-void"
      />

      {/* ── Menu index, set like a poster ────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 py-24">
        <div className="flex flex-wrap items-end gap-6">
          <h2 className="poster text-6xl text-void sm:text-8xl">The menu</h2>
          <p className="kicker mb-3 text-violet">16oz / matcha 12oz</p>
        </div>

        <ul className="rule-thick mt-10 text-void">
          {SIGNATURES.map((drink, i) => (
            <li key={drink.slug}>
              <Link
                href={`/menu/${drink.slug}`}
                className="hairline group flex flex-wrap items-center gap-x-6 gap-y-2 py-7 transition-colors hover:bg-void hover:text-paper"
              >
                <span className="kicker w-10 text-violet group-hover:text-neon">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="poster text-4xl sm:text-6xl">{drink.name}</span>
                <span className="font-serif hidden max-w-sm text-xl italic text-grape group-hover:text-neon lg:block">
                  {drink.tagline}
                </span>
                <span className="poster ml-auto text-3xl sm:text-4xl">
                  {money(drink.price)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Modifications, reversed out ──────────────────────────────────── */}
      <section className="bg-void py-24 text-paper">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="kicker text-neon">Modifications</p>
            <h2 className="poster mt-4 text-5xl leading-[0.88] sm:text-7xl">
              Free
              <br />
              Means
              <br />
              Free
            </h2>
            <CatMark size={56} className="mt-8 text-grape" />
          </div>

          <dl className="grid content-start gap-10">
            <div>
              <dt className="kicker text-neon">Choice of milk</dt>
              <dd className="poster hairline mt-4 pt-4 text-3xl leading-tight sm:text-4xl">
                Whole · Oat · Almond · Coconut · Non-fat
              </dd>
            </div>
            <div>
              <dt className="kicker text-neon">Optional add-ons</dt>
              <dd className="poster hairline mt-4 pt-4 text-3xl leading-tight sm:text-4xl">
                Maple cold foam +$1
                <br />
                Ube whipped cream +$1
              </dd>
            </div>
            <div>
              <dt className="kicker text-neon">Any drink, either base</dt>
              <dd className="font-serif hairline mt-4 pt-4 text-2xl italic text-neon">
                Espresso or matcha. Same price, every time.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── Take home ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 py-24">
        <h2 className="poster text-5xl text-void sm:text-7xl">Take home</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {merch.map((item, i) => (
            <ProductCard key={item.slug} product={item} index={i} />
          ))}
        </div>
      </section>
    </>
  );
}
