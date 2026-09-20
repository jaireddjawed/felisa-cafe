import { Head, usePage } from '@inertiajs/react';
import { CatFace, Sparkle, SquiggleRule } from '@/components/doodles';
import ProductCard from '@/components/product-card';
import type { Product, ProductCategory, SharedProps } from '@/types';

const SECTIONS: { key: ProductCategory; title: string; note: string }[] = [
    { key: 'signature', title: 'Signature menu', note: '16oz / matcha 12oz' },
    {
        key: 'matcha',
        title: 'Matcha series',
        note: '12oz iced · first-harvest Uji',
    },
    { key: 'pantry', title: 'Pantry', note: 'Syrups we bottle for you' },
    { key: 'merch', title: 'Merch', note: 'Drawn by the same hand' },
];

type Props = {
    products: Product[];
};

export default function MenuIndex({ products }: Props) {
    const { shop } = usePage<SharedProps>().props;

    return (
        <div className="mx-auto max-w-6xl px-5 py-14">
            <Head title="Menu" />

            <header className="relative">
                <Sparkle
                    size={30}
                    className="twinkle text-lav-400 absolute -top-4 right-4"
                />
                <p className="font-hand text-lav-600 flex items-center gap-2 text-xl">
                    <CatFace size={24} /> {shop.host} · {shop.city}
                </p>
                <h1 className="font-marker text-lav-800 mt-2 text-5xl leading-tight sm:text-6xl">
                    The whole menu
                </h1>
                <p className="font-hand text-lav-700 mt-4 max-w-lg text-2xl leading-snug">
                    Espresso or matcha in anything. Five milks, none of them
                    upcharged. Tap a drink to build it the way you like.
                </p>
            </header>

            {SECTIONS.map((section) => {
                const items = products.filter(
                    (product) => product.category === section.key,
                );

                if (items.length === 0) {
                    return null;
                }

                return (
                    <section key={section.key} className="mt-16">
                        <div className="flex flex-wrap items-end gap-3">
                            <h2 className="font-marker text-lav-800 text-3xl sm:text-4xl">
                                {section.title}
                            </h2>
                            <p className="font-hand text-lav-600 text-xl">
                                {section.note}
                            </p>
                        </div>
                        <SquiggleRule className="text-lav-400 mt-3 h-5 w-full" />
                        <div className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
                            {items.map((item, index) => (
                                <ProductCard
                                    key={item.slug}
                                    product={item}
                                    index={index}
                                />
                            ))}
                        </div>
                    </section>
                );
            })}

            {products.length === 0 && (
                <p className="border-lav-400 bg-lav-100 font-hand text-lav-700 mt-16 rounded-3xl border-2 border-dashed px-5 py-6 text-2xl">
                    The online menu is still syncing. Check back in a minute.
                </p>
            )}
        </div>
    );
}
