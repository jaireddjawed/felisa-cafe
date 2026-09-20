import type { OrderStatus } from '@/types';

const STYLES: Record<OrderStatus, string> = {
    pending_payment: 'bg-lav-100 text-lav-700 border-lav-300',
    paid: 'bg-lav-200 text-lav-800 border-lav-400',
    preparing: 'bg-amber-100 text-amber-800 border-amber-300',
    ready: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    completed: 'bg-gray-100 text-gray-700 border-gray-300',
    cancelled: 'bg-rose-100 text-rose-800 border-rose-300',
};

type Props = {
    status: OrderStatus;
    label: string;
};

export default function OrderStatusBadge({ status, label }: Props) {
    return (
        <span
            className={`font-hand rounded-full border px-3 py-1 text-base font-semibold ${STYLES[status]}`}
        >
            {label}
        </span>
    );
}
