import { Head, Link } from '@inertiajs/react';
import { CatFace, Sparkle, SquiggleRule } from '@/components/doodles';
import OrderStatusBadge from '@/components/order-status-badge';
import { menu } from '@/routes';
import { show } from '@/routes/orders';
import type { Order } from '@/types';

type Props = {
    orders: Order[];
};

function formatDate(iso: string | null): string {
    if (!iso) {
        return '';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(iso));
}

export default function OrdersIndex({ orders }: Props) {
    return (
        <div className="mx-auto max-w-4xl px-5 py-12">
            <Head title="Order history" />

            <div className="flex items-center gap-3">
                <CatFace size={40} className="text-lav-600" />
                <h1 className="font-marker text-lav-800 text-4xl sm:text-5xl">
                    Order history
                </h1>
            </div>
            <p className="font-hand text-lav-600 mt-2 text-2xl">
                All your past sips and treats from Felisa Cafe.
            </p>

            <SquiggleRule className="text-lav-400 my-6 h-5 w-full" />

            {orders.length === 0 ? (
                <div className="grid place-items-center gap-4 py-16 text-center">
                    <Sparkle size={36} className="twinkle text-lav-400" />
                    <p className="font-hand text-lav-800 text-3xl">
                        No orders placed yet!
                    </p>
                    <p className="font-hand text-lav-600 max-w-md text-xl">
                        Your drinks and housemade syrups will show up right here
                        once you order.
                    </p>
                    <Link
                        href={menu()}
                        className="sticker bg-lav-600 font-marker hover:bg-lav-700 mt-2 rounded-full px-6 py-3 text-lg text-white transition"
                    >
                        Explore the menu
                    </Link>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {orders.map((order) => (
                        <div
                            key={order.id}
                            className="sticker rounded-3xl bg-white/90 p-6"
                        >
                            <div className="border-lav-200 flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed pb-4">
                                <div>
                                    <span className="font-marker text-lav-800 text-xl">
                                        Order #{order.reference}
                                    </span>
                                    <p className="font-hand text-lav-600 text-lg">
                                        {formatDate(order.placedAt)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <OrderStatusBadge
                                        status={order.status}
                                        label={order.statusLabel}
                                    />
                                    <Link
                                        href={show(order.id)}
                                        className="bg-lav-100 font-hand text-lav-800 hover:bg-lav-200 rounded-full px-4 py-1.5 text-lg"
                                    >
                                        View details
                                    </Link>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3">
                                {order.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="font-hand flex items-baseline justify-between gap-4 text-lg"
                                    >
                                        <div>
                                            <span className="text-lav-800 font-semibold">
                                                {item.quantity}×{' '}
                                                {item.productName}
                                            </span>
                                            {item.options && (
                                                <p className="text-lav-500 text-sm">
                                                    {item.options}
                                                </p>
                                            )}
                                        </div>
                                        <span className="font-marker text-lav-700">
                                            {item.total.formatted}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="border-lav-200 mt-4 flex items-center justify-between border-t-2 border-dashed pt-4">
                                <span className="font-hand text-lav-700 text-xl">
                                    Total
                                </span>
                                <span className="font-marker text-lav-800 text-2xl">
                                    {order.total.formatted}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
