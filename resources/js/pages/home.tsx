import { Head, Link, usePage } from '@inertiajs/react';
import {
    CatFace,
    DrinkGlass,
    GirlDoodle,
    Sparkle,
    SquiggleRule,
} from '@/components/doodles';
import ProductCard from '@/components/product-card';
import { about, menu } from '@/routes';
import type { Product, SharedProps } from '@/types';

const MILKS = ['whole', 'oat', 'almond', 'coconut', 'non-fat'];
const ADD_ONS = ['maple cold foam', 'ube whipped cream'];

type Props = {
    signatures: Product[];
    takeHome: Product[];
};

export default function Home({ signatures, takeHome }: Props) {
    const { shop } = usePage<SharedProps>().props;

    return (
        <>
            <Head title="Ube, matcha, and housemade everything" />

            {/* ── Hero ───────────────────────────────────────────────────── */}
            <section className="relative overflow-hidden px-5 pt-14 pb-16 sm:pt-20">
                <Sparkle
                    size={46}
                    className="twinkle text-lav-400 absolute top-10 left-[6%]"
                />
                <Sparkle
                    size={26}
                    className="twinkle text-lav-500 absolute top-24 right-[10%]"
                />
                <Sparkle
                    size={34}
                    className="twinkle text-lav-300 absolute bottom-16 left-[18%]"
                />

                <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
                    <div>
                        <p className="font-hand text-lav-600 flex items-center gap-2 text-xl">
                            <CatFace size={26} /> Filipino-American coffee bar ·
                            Fullerton
                        </p>

                        <h1 className="font-marker text-lav-800 mt-4 text-5xl leading-[1.15] sm:text-6xl lg:text-7xl">
                            Ube in the
                            <br />
                            bottom of
                            <br />
                            every cup.
                        </h1>

                        <p className="font-hand text-lav-700 mt-6 max-w-md text-2xl leading-snug">
                            Housemade syrups, matcha or espresso in anything,
                            and five milks that never cost extra. Drawn, poured,
                            and named by us.
                        </p>

                        <div className="mt-8 flex flex-wrap items-center gap-3">
                            <Link
                                href={menu()}
                                className="sticker bg-lav-600 font-marker hover:bg-lav-700 rounded-full px-7 py-3 text-base text-white transition hover:-rotate-2"
                            >
                                Order ahead
                            </Link>
                            <Link
                                href={about()}
                                className="border-lav-500 font-hand text-lav-700 hover:bg-lav-300 rounded-full border-3 border-dashed px-7 py-3 text-xl transition"
                            >
                                Who is Felisa?
                            </Link>
                        </div>
                    </div>

                    <div className="relative grid place-items-center">
                        <div className="blob bg-lav-300/70 absolute inset-6" />
                        <div className="relative flex items-end gap-2 sm:gap-5">
                            {signatures.slice(0, 3).map((drink, index) => (
                                <DrinkGlass
                                    key={drink.slug}
                                    top={drink.pour.top}
                                    bottom={drink.pour.bottom}
                                    className={`bob w-24 drop-shadow-[6px_8px_0_rgba(75,42,123,0.16)] sm:w-32 ${
                                        index === 1 ? 'mb-8 w-28 sm:w-40' : ''
                                    }`}
                                    // Stagger the float so the glasses never bob in unison.
                                    style={{
                                        animationDelay: `${index * 0.8}s`,
                                    }}
                                />
                            ))}
                        </div>
                        <GirlDoodle
                            size={70}
                            className="text-lav-700 absolute -right-2 -bottom-2 rotate-6"
                        />
                    </div>
                </div>
            </section>

            {/* ── Opening banner ─────────────────────────────────────────── */}
            <section className="px-5">
                <div className="sticker bg-lav-600 mx-auto flex max-w-6xl -rotate-1 flex-col items-center gap-2 rounded-3xl px-6 py-6 text-center text-white sm:flex-row sm:text-left">
                    <Sparkle size={26} className="twinkle text-lav-200" />
                    <p className="font-marker text-xl sm:text-2xl">
                        {shop.opening_label}: {shop.opening_date}
                    </p>
                    <p className="font-hand text-lav-100 text-xl sm:ml-auto">
                        {shop.host} · {shop.street}, {shop.city} ·{' '}
                        {shop.opening_hours}
                    </p>
                </div>
            </section>

            {/* ── Signature menu ─────────────────────────────────────────── */}
            <section className="mx-auto max-w-6xl px-5 pt-20">
                <div className="flex flex-wrap items-end gap-3">
                    <h2 className="font-marker text-lav-800 text-4xl sm:text-5xl">
                        Signature menu
                    </h2>
                    <p className="font-hand text-lav-600 text-2xl">
                        16oz / matcha 12oz · all $8.50
                    </p>
                </div>
                <SquiggleRule className="text-lav-400 mt-3 h-5 w-full" />

                <div className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
                    {signatures.map((drink, index) => (
                        <ProductCard
                            key={drink.slug}
                            product={drink}
                            index={index}
                        />
                    ))}
                </div>
            </section>

            {/* ── Free modifications ─────────────────────────────────────── */}
            <section className="mx-auto mt-24 max-w-6xl px-5">
                <div className="sticker bg-lav-100 grid gap-8 rounded-[2.5rem] p-8 sm:p-12 lg:grid-cols-2">
                    <div>
                        <h2 className="font-marker text-lav-800 text-3xl leading-snug">
                            Free modifications,
                            <br />
                            actually free
                        </h2>
                        <p className="font-hand text-lav-700 mt-4 text-2xl leading-snug">
                            Every milk on our bar is the same price: nothing.
                            Swap the base for matcha in any espresso drink and
                            we will not blink.
                        </p>
                        <CatFace size={64} className="text-lav-400 mt-6" />
                    </div>

                    <dl className="grid content-start gap-5">
                        <div>
                            <dt className="font-marker text-lav-700 text-base">
                                Milks
                            </dt>
                            <dd className="mt-2 flex flex-wrap gap-2">
                                {MILKS.map((milk) => (
                                    <span
                                        key={milk}
                                        className="border-lav-400 font-hand text-lav-700 rounded-full border-2 border-dashed bg-white px-4 py-1.5 text-lg"
                                    >
                                        {milk}
                                    </span>
                                ))}
                            </dd>
                        </div>
                        <div>
                            <dt className="font-marker text-lav-700 text-base">
                                Optional add-ons
                            </dt>
                            <dd className="mt-2 flex flex-wrap gap-2">
                                {ADD_ONS.map((addOn) => (
                                    <span
                                        key={addOn}
                                        className="bg-lav-600 font-hand rounded-full px-4 py-1.5 text-lg text-white"
                                    >
                                        {addOn}
                                    </span>
                                ))}
                            </dd>
                        </div>
                    </dl>
                </div>
            </section>

            {/* ── Take home ──────────────────────────────────────────────── */}
            {takeHome.length > 0 && (
                <section className="mx-auto mt-24 max-w-6xl px-5">
                    <h2 className="font-marker text-lav-800 text-4xl sm:text-5xl">
                        Take some home
                    </h2>
                    <SquiggleRule className="text-lav-400 mt-3 h-5 w-full" />
                    <div className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
                        {takeHome.map((item, index) => (
                            <ProductCard
                                key={item.slug}
                                product={item}
                                index={index + 1}
                            />
                        ))}
                    </div>
                </section>
            )}
        </>
    );
}
