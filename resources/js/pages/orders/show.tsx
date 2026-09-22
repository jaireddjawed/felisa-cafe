import { Head } from '@inertiajs/react';
import { CatFace, Sparkle, SquiggleRule } from '@/components/doodles';
import OrderStatusBadge from '@/components/order-status-badge';
import type { Order } from '@/types';

type Props = {
    order: Order;
};

const PICKUP_WINDOW_HOURS = 2;

function formatTime(iso: string | null): string | null {
    if (!iso) {
        return null;
    }

    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(iso));
}

/** Fresh orders show a ready time; once the pickup window has likely
 *  passed, the order is just history and the estimate is stale. */
function isWithinPickupWindow(estimatedReadyAt: string | null): boolean {
    if (!estimatedReadyAt) {
        return true;
    }

    const hoursSinceReady =
        (Date.now() - new Date(estimatedReadyAt).getTime()) / (1000 * 60 * 60);

    return hoursSinceReady < PICKUP_WINDOW_HOURS;
}

export default function OrderShow({ order }: Props) {
    const readyTime = formatTime(order.estimatedReadyAt);
    const showPickupStatus =
        order.status !== 'cancelled' &&
        isWithinPickupWindow(order.estimatedReadyAt);

    return (
        <div className="mx-auto max-w-3xl px-5 py-12">
            <Head title={`Order #${order.reference}`} />

            <div className="flex flex-wrap items-center gap-3">
                <CatFace size={40} className="text-lav-600" />
                <h1 className="font-marker text-lav-800 text-4xl sm:text-5xl">
                    {order.isPaid ? 'Order confirmed' : 'Order placed'}
                </h1>
                <span className="ml-auto">
                    <OrderStatusBadge
                        status={order.status}
                        label={order.statusLabel}
                    />
                </span>
            </div>
            <p className="font-hand text-lav-600 mt-2 text-xl">
                Order #{order.reference}
            </p>

            <SquiggleRule className="text-lav-400 my-6 h-5 w-full" />

            <div className="grid gap-5">
                {showPickupStatus && (
                    <section className="sticker bg-lav-100 rounded-3xl p-6">
                        <div className="flex items-center gap-2">
                            <Sparkle
                                size={20}
                                className="twinkle text-lav-500"
                            />
                            <p className="font-hand text-lav-700 text-2xl">
                                {order.status === 'ready'
                                    ? 'Ready for pickup now'
                                    : 'Estimated ready time'}
                            </p>
                        </div>
                        <p className="font-marker text-lav-800 mt-2 text-4xl">
                            {readyTime ?? 'We are working it out.'}
                        </p>
                        <p className="font-hand text-lav-600 mt-3 text-xl">
                            Thanks {order.customerName}!
                        </p>
                    </section>
                )}

                <section className="sticker rounded-3xl bg-white/80 p-6">
                    <ul className="grid gap-3">
                        {order.items.map((item) => (
                            <li
                                key={item.id}
                                className="flex items-baseline justify-between gap-4"
                            >
                                <div>
                                    <p className="font-marker text-lav-800 text-lg">
                                        <span className="font-hand text-lav-700 mr-2 text-xl">
                                            {item.quantity}×
                                        </span>
                                        {item.productName}
                                    </p>
                                    {item.options && (
                                        <p className="font-hand text-lav-600 text-base">
                                            {item.options}
                                        </p>
                                    )}
                                </div>
                                <span className="font-marker text-lav-700">
                                    {item.total.formatted}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <div className="border-lav-200 font-hand text-lav-700 mt-5 border-t-2 border-dashed pt-4 text-xl">
                        <div className="flex">
                            <span>Subtotal</span>
                            <span className="ml-auto">
                                {order.subtotal.formatted}
                            </span>
                        </div>
                        {order.tax.cents > 0 && (
                            <div className="mt-1 flex">
                                <span>Tax</span>
                                <span className="ml-auto">
                                    {order.tax.formatted}
                                </span>
                            </div>
                        )}
                        {order.tip.cents > 0 && (
                            <div className="mt-1 flex">
                                <span>Tip</span>
                                <span className="ml-auto">
                                    {order.tip.formatted}
                                </span>
                            </div>
                        )}
                        <div className="border-lav-200 mt-3 flex items-baseline border-t-2 border-dashed pt-3">
                            <span className="text-2xl">Total</span>
                            <span className="font-marker text-lav-800 ml-auto text-2xl">
                                {order.total.formatted}
                            </span>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
