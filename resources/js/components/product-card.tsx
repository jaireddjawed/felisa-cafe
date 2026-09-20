import { Link } from '@inertiajs/react';
import { DrinkGlass, Sparkle } from '@/components/doodles';
import { show } from '@/routes/menu';
import type { Product } from '@/types';

/** Cards sit a degree or two off square, and straighten when you hover. */
const TILTS = ['-rotate-2', 'rotate-1', '-rotate-1', 'rotate-2'];

type Props = {
    product: Product;
    index?: number;
};

export default function ProductCard({ product, index = 0 }: Props) {
    return (
        <Link
            href={show(product.slug)}
            className={`sticker group bg-lav-100 relative block rounded-3xl p-5 transition-transform duration-300 hover:scale-[1.03] hover:rotate-0 ${TILTS[index % TILTS.length]}`}
        >
            {product.badge && (
                <span className="bg-lav-600 font-hand absolute -top-3 -left-2 z-10 -rotate-6 rounded-full px-3 py-1 text-sm text-white shadow">
                    {product.badge}
                </span>
            )}

            <Sparkle
                size={18}
                className="twinkle text-lav-400 absolute top-4 right-4"
            />

            <div className="bg-lav-300/60 grid place-items-center rounded-2xl py-4">
                <DrinkGlass
                    top={product.pour.top}
                    bottom={product.pour.bottom}
                    ice={
                        product.category === 'signature' ||
                        product.category === 'matcha'
                    }
                    className="h-40 w-auto drop-shadow-[4px_6px_0_rgba(75,42,123,0.18)] transition-transform duration-300 group-hover:-translate-y-1"
                />
            </div>

            <h3 className="font-marker text-lav-800 mt-4 text-lg leading-snug">
                {product.name}
            </h3>
            <p className="font-hand text-lav-600 mt-1 text-lg leading-snug">
                {product.tagline}
            </p>

            <div className="mt-3 flex items-center">
                <span className="font-marker text-lav-700 text-xl">
                    {product.available && product.fromPrice
                        ? product.fromPrice.formatted
                        : 'Sold out'}
                </span>
                <span className="border-lav-400 font-hand text-lav-700 group-hover:bg-lav-600 ml-auto rounded-full border-2 border-dashed px-3 py-1 text-base group-hover:text-white">
                    build it →
                </span>
            </div>
        </Link>
    );
}
