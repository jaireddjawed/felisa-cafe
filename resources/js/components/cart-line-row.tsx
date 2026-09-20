import { router } from '@inertiajs/react';
import { destroy, update } from '@/routes/cart';
import type { CartLine } from '@/types';

/**
 * One cart line with its quantity controls. Used by both the drawer and the
 * cart page, so the two can never disagree.
 *
 * Quantity changes go through normal Inertia visits. The cart is a shared
 * prop, so the server's re-priced cart comes back with the page and there is
 * no client-side cart state to keep in sync.
 */

type Props = {
    line: CartLine;
    /** The drawer is hidden from the tab order while it is closed. */
    tabIndex?: number;
};

export default function CartLineRow({ line, tabIndex }: Props) {
    const setQuantity = (quantity: number) => {
        router.patch(
            update(line.id).url,
            { quantity },
            { preserveScroll: true, preserveState: true },
        );
    };

    const remove = () => {
        router.delete(destroy(line.id).url, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const options = [
        line.variationName,
        ...line.modifiers.map((modifier) => modifier.name),
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <li className="sticker rounded-2xl bg-white/80 px-4 py-3">
            <div className="flex items-baseline gap-2">
                <p className="font-marker text-lav-800 text-lg">
                    {line.productName}
                </p>
                <p className="font-hand text-lav-700 ml-auto text-xl">
                    {line.total.formatted}
                </p>
            </div>

            {options && (
                <p className="font-hand text-lav-600 mt-1 text-lg">{options}</p>
            )}

            {line.note && (
                <p className="font-hand text-lav-500 mt-0.5 text-base italic">
                    Note: {line.note}
                </p>
            )}

            {line.problem && (
                <p
                    className="font-hand mt-1 text-base text-rose-700"
                    role="alert"
                >
                    {line.problem}
                </p>
            )}

            <div className="mt-2 flex items-center gap-2">
                <div className="border-lav-400 flex items-center rounded-full border-2">
                    <button
                        type="button"
                        tabIndex={tabIndex}
                        onClick={() => setQuantity(line.quantity - 1)}
                        aria-label={`One fewer ${line.productName}`}
                        className="font-hand text-lav-700 px-3 py-0.5 text-xl"
                    >
                        −
                    </button>
                    <span className="font-hand min-w-6 text-center text-xl">
                        {line.quantity}
                    </span>
                    <button
                        type="button"
                        tabIndex={tabIndex}
                        onClick={() => setQuantity(line.quantity + 1)}
                        aria-label={`One more ${line.productName}`}
                        className="font-hand text-lav-700 px-3 py-0.5 text-xl"
                    >
                        +
                    </button>
                </div>

                <button
                    type="button"
                    tabIndex={tabIndex}
                    onClick={remove}
                    className="font-hand text-lav-500 hover:text-lav-800 ml-auto text-lg underline decoration-dashed"
                >
                    remove
                </button>
            </div>
        </li>
    );
}
