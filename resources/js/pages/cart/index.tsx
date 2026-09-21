import { Head, Link } from '@inertiajs/react';
import CartLineRow from '@/components/cart-line-row';
import { CatFace, Sparkle, SquiggleRule } from '@/components/doodles';
import { checkout, menu } from '@/routes';
import type { Cart } from '@/types';

type Props = {
    cart: Cart;
};

export default function CartIndex({ cart }: Props) {
    return (
        <div className="mx-auto max-w-3xl px-5 py-12">
            <Head title="Your order" />

            <div className="flex items-center gap-3">
                <CatFace size={40} className="text-lav-600" />
                <h1 className="font-marker text-lav-800 text-4xl sm:text-5xl">
                    Your order
                </h1>
            </div>
            <SquiggleRule className="text-lav-400 my-6 h-5 w-full" />

            {cart.lines.length === 0 ? (
                <div className="grid place-items-center gap-3 py-20 text-center">
                    <Sparkle size={32} className="twinkle text-lav-400" />
                    <p className="font-hand text-lav-700 text-2xl">
                        Nothing in here yet.
                    </p>
                    <Link
                        href={menu()}
                        className="sticker bg-lav-600 font-hand mt-2 rounded-full px-6 py-2.5 text-xl text-white"
                    >
                        See the menu
                    </Link>
                </div>
            ) : (
                <>
                    <ul className="flex flex-col gap-3">
                        {cart.lines.map((line) => (
                            <CartLineRow key={line.id} line={line} />
                        ))}
                    </ul>

                    <div className="sticker bg-lav-100 mt-6 rounded-3xl p-6">
                        <div className="flex items-baseline">
                            <span className="font-hand text-lav-700 text-xl">
                                Subtotal
                            </span>
                            <span className="font-marker text-lav-800 ml-auto text-2xl">
                                {cart.subtotal.formatted}
                            </span>
                        </div>

                        <Link
                            href={checkout()}
                            className={`sticker bg-lav-600 font-marker hover:bg-lav-700 mt-4 block w-full rounded-full py-3 text-center text-lg text-white transition ${
                                cart.valid
                                    ? ''
                                    : 'pointer-events-none opacity-40'
                            }`}
                        >
                            Checkout
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
}
