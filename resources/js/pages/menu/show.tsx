import { Head } from '@inertiajs/react';
import AddToCart from '@/components/add-to-cart';
import {
    CatFace,
    DrinkGlass,
    Sparkle,
    SquiggleRule,
} from '@/components/doodles';
import ProductCard from '@/components/product-card';
import type { Product, ProductDetail } from '@/types';

type Props = {
    product: ProductDetail;
    alsoLike: Product[];
};

export default function MenuShow({ product, alsoLike }: Props) {
    return (
        <div className="mx-auto max-w-6xl px-5 py-12">
            <Head title={product.name} />

            <div className="mt-6 grid gap-10 lg:grid-cols-2">
                {/* ── The drink, drawn ───────────────────────────────────── */}
                <div className="sticker bg-lav-300/70 relative grid place-items-center overflow-hidden rounded-[2.5rem] py-14">
                    <Sparkle
                        size={34}
                        className="twinkle absolute top-8 left-8 text-white"
                    />
                    <Sparkle
                        size={22}
                        className="twinkle absolute right-10 bottom-10 text-white"
                    />
                    <DrinkGlass
                        top={product.pour.top}
                        bottom={product.pour.bottom}
                        ice={
                            product.category === 'signature' ||
                            product.category === 'matcha'
                        }
                        className="bob w-56 drop-shadow-[8px_10px_0_rgba(75,42,123,0.18)]"
                    />
                    <CatFace
                        size={54}
                        className="text-lav-700/70 absolute bottom-6 left-8 -rotate-6"
                    />
                </div>

                {/* ── The details ────────────────────────────────────────── */}
                <div>
                    {product.badge && (
                        <span className="bg-lav-600 font-hand inline-block -rotate-2 rounded-full px-4 py-1 text-base text-white">
                            {product.badge}
                        </span>
                    )}

                    <h1 className="font-marker text-lav-800 mt-3 text-4xl leading-tight sm:text-5xl">
                        {product.name}
                    </h1>
                    <p className="font-hand text-lav-600 mt-3 text-2xl">
                        {product.tagline}
                    </p>

                    <p className="font-marker text-lav-700 mt-5 text-3xl">
                        {product.fromPrice
                            ? product.fromPrice.formatted
                            : 'Sold out'}
                        {product.size && (
                            <span className="font-hand text-lav-600 ml-3 text-xl">
                                {product.size}
                            </span>
                        )}
                    </p>

                    <SquiggleRule className="text-lav-400 my-6 h-5 w-full" />

                    <p className="font-hand text-lav-700 text-2xl leading-snug">
                        {product.description}
                    </p>

                    {product.ingredients.length > 0 && (
                        <ul className="mt-6 flex flex-wrap gap-2">
                            {product.ingredients.map((ingredient) => (
                                <li
                                    key={ingredient}
                                    className="border-lav-400 bg-lav-100 font-hand text-lav-700 flex items-center gap-2 rounded-full border-2 border-dashed px-4 py-1.5 text-lg"
                                >
                                    <Sparkle
                                        size={12}
                                        className="text-lav-500"
                                    />
                                    {ingredient}
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="mt-8">
                        <AddToCart product={product} />
                    </div>
                </div>
            </div>

            {alsoLike.length > 0 && (
                <section className="mt-24">
                    <h2 className="font-marker text-lav-800 text-3xl sm:text-4xl">
                        You might also like
                    </h2>
                    <SquiggleRule className="text-lav-400 mt-3 h-5 w-full" />
                    <div className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
                        {alsoLike.map((item, index) => (
                            <ProductCard
                                key={item.slug}
                                product={item}
                                index={index}
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
