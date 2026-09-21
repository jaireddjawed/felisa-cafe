import { Link } from '@inertiajs/react';
import CartLineRow from '@/components/cart-line-row';
import { CatFace, Sparkle } from '@/components/doodles';
import { checkout, menu } from '@/routes';
import type { Cart } from '@/types';

type Props = {
    cart: Cart;
    open: boolean;
    onClose: () => void;
};

export default function CartDrawer({ cart, open, onClose }: Props) {
    // Everything inside leaves the tab order while the drawer is closed.
    const tabIndex = open ? 0 : -1;

    return (
        <div
            className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
            aria-hidden={!open}
        >
            <button
                type="button"
                tabIndex={tabIndex}
                onClick={onClose}
                aria-label="Close cart"
                className={`bg-lav-900/40 absolute inset-0 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
            />

            <aside
                role="dialog"
                aria-label="Your order"
                className={`border-lav-400 bg-lav-100 absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l-4 border-dashed transition-transform duration-300 ${
                    open ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <header className="border-lav-300 flex items-center gap-3 border-b-4 border-dashed px-5 py-4">
                    <CatFace size={34} className="text-lav-600" />
                    <h2 className="font-marker text-lav-800 text-2xl">
                        Your order
                    </h2>
                    <button
                        type="button"
                        tabIndex={tabIndex}
                        onClick={onClose}
                        className="font-hand text-lav-700 hover:bg-lav-300 ml-auto rounded-full px-3 py-1 text-xl"
                    >
                        close
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {cart.lines.length === 0 ? (
                        <div className="grid place-items-center gap-3 py-20 text-center">
                            <Sparkle
                                size={28}
                                className="twinkle text-lav-400"
                            />
                            <p className="font-hand text-lav-700 text-2xl">
                                Nothing in here yet.
                            </p>
                            <Link
                                href={menu()}
                                onClick={onClose}
                                tabIndex={tabIndex}
                                className="sticker bg-lav-600 font-hand rounded-full px-5 py-2 text-xl text-white"
                            >
                                See the menu
                            </Link>
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {cart.lines.map((line) => (
                                <CartLineRow
                                    key={line.id}
                                    line={line}
                                    tabIndex={tabIndex}
                                />
                            ))}
                        </ul>
                    )}
                </div>

                <footer className="border-lav-300 border-t-4 border-dashed px-5 py-4">
                    <div className="flex items-baseline">
                        <span className="font-hand text-lav-700 text-xl">
                            Subtotal
                        </span>
                        <span className="font-marker text-lav-800 ml-auto text-2xl">
                            {cart.subtotal.formatted}
                        </span>
                    </div>

                    {cart.lines.length > 0 ? (
                        <Link
                            href={checkout()}
                            onClick={onClose}
                            tabIndex={tabIndex}
                            className={`sticker bg-lav-600 font-marker hover:bg-lav-700 mt-3 block w-full rounded-full py-3 text-center text-lg text-white transition ${
                                cart.valid
                                    ? ''
                                    : 'pointer-events-none opacity-40'
                            }`}
                        >
                            Checkout
                        </Link>
                    ) : (
                        <button
                            type="button"
                            tabIndex={-1}
                            disabled
                            className="sticker bg-lav-600 font-marker mt-3 w-full rounded-full py-3 text-lg text-white opacity-40"
                        >
                            Checkout
                        </button>
                    )}
                </footer>
            </aside>
        </div>
    );
}
