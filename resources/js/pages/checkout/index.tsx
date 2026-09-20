import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { CatFace, Sparkle, SquiggleRule } from '@/components/doodles';
import { useSquareCard } from '@/hooks/use-square-card';
import { menu } from '@/routes';
import { store } from '@/routes/checkout';
import type { Cart, SharedProps } from '@/types';

const CARD_CONTAINER_ID = 'square-card';

type Props = {
    cart: Cart;
    estimatedReadyAt: string | null;
    square: {
        applicationId: string | null;
        locationId: string;
        sdkUrl: string;
        configured: boolean;
    };
    allowTipping: boolean;
};

function formatCents(cents: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
    }).format(cents / 100);
}

function formatTime(iso: string | null): string | null {
    if (!iso) {
        return null;
    }

    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(iso));
}

export default function Checkout({
    cart,
    estimatedReadyAt,
    square,
    allowTipping,
}: Props) {
    // `checkout` is a page-level error bag thrown by CheckoutController,
    // not a field on this form, so it comes from the page rather than useForm.
    const { auth, errors } = usePage<SharedProps>().props;

    const form = useForm({
        name: auth.user?.name ?? '',
        email: auth.user?.email ?? '',
        notes: '',
        source_id: '',
        tip_cents: 0,
        // Generated once per visit and reused on every retry, so a declined
        // card followed by a second attempt resumes one order rather than
        // creating another.
        idempotency_key: crypto.randomUUID(),
    });

    const [tipCents, setTipCents] = useState(0);
    const [customTip, setCustomTip] = useState('');
    const [cardError, setCardError] = useState<string | null>(null);

    const card = useSquareCard({
        applicationId: square.applicationId ?? '',
        locationId: square.locationId,
        sdkUrl: square.sdkUrl,
        selector: `#${CARD_CONTAINER_ID}`,
        enabled: square.configured && cart.valid && cart.lines.length > 0,
    });

    const currency = cart.subtotal.currency;

    const tipOptions = useMemo(
        () => [
            { label: 'No tip', cents: 0 },
            { label: '15%', cents: Math.round(cart.subtotal.cents * 0.15) },
            { label: '20%', cents: Math.round(cart.subtotal.cents * 0.2) },
        ],
        [cart.subtotal.cents],
    );

    const readyTime = formatTime(estimatedReadyAt);

    async function pay() {
        setCardError(null);

        try {
            const token = await card.tokenize();

            form.transform((data) => ({
                ...data,
                source_id: token,
                tip_cents: tipCents,
            }));
            form.post(store().url, { preserveScroll: true });
        } catch (caught) {
            setCardError(
                caught instanceof Error
                    ? caught.message
                    : 'That card could not be read.',
            );
        }
    }

    if (cart.lines.length === 0) {
        return (
            <div className="mx-auto max-w-3xl px-5 py-12">
                <Head title="Checkout" />
                <h1 className="font-marker text-lav-800 text-4xl sm:text-5xl">
                    Checkout
                </h1>
                <SquiggleRule className="text-lav-400 my-5 h-5 w-full" />
                <div className="grid place-items-center gap-3 py-16 text-center">
                    <Sparkle size={32} className="twinkle text-lav-400" />
                    <p className="font-hand text-lav-700 text-2xl">
                        Your cart is empty.
                    </p>
                    <Link
                        href={menu()}
                        className="sticker bg-lav-600 font-hand mt-2 rounded-full px-6 py-2.5 text-xl text-white"
                    >
                        See the menu
                    </Link>
                </div>
            </div>
        );
    }

    const fieldClasses =
        'rounded-full border-2 border-lav-300 bg-white px-4 py-2 font-hand text-lg text-lav-800 outline-none focus:border-lav-600';

    return (
        <div className="mx-auto max-w-3xl px-5 py-12">
            <Head title="Checkout" />

            <Link
                href={menu()}
                className="font-hand text-lav-600 hover:text-lav-800 text-xl underline decoration-dashed"
            >
                ← back to the menu
            </Link>
            <h1 className="font-marker text-lav-800 mt-4 text-4xl sm:text-5xl">
                Checkout
            </h1>
            <SquiggleRule className="text-lav-400 my-5 h-5 w-full" />

            {(errors.checkout || cardError) && (
                <p
                    className="sticker font-hand mb-6 rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 text-lg text-rose-800"
                    role="alert"
                >
                    {errors.checkout ?? cardError}
                </p>
            )}

            {!cart.valid && (
                <p className="sticker font-hand mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-lg text-amber-900">
                    Some items are no longer available. Please review your cart
                    before paying.
                </p>
            )}

            <div className="grid gap-6">
                {/* ── 1. The order ───────────────────────────────────────── */}
                <section className="sticker bg-lav-100 rounded-3xl p-6">
                    <div className="border-lav-300 flex items-center gap-2 border-b-2 border-dashed pb-3">
                        <CatFace size={24} className="text-lav-600" />
                        <h2 className="font-marker text-lav-800 text-2xl">
                            Your order
                        </h2>
                    </div>

                    <ul className="divide-lav-200 mt-4 flex flex-col divide-y-2 divide-dashed">
                        {cart.lines.map((line) => (
                            <li
                                key={line.id}
                                className="py-3 first:pt-0 last:pb-0"
                            >
                                <div className="flex items-baseline justify-between gap-3">
                                    <p className="font-marker text-lav-800 text-lg">
                                        <span className="font-hand text-lav-700 mr-2 text-xl font-bold">
                                            {line.quantity}×
                                        </span>
                                        {line.productName}
                                    </p>
                                    <p className="font-hand text-lav-700 text-xl">
                                        {line.total.formatted}
                                    </p>
                                </div>
                                <p className="font-hand text-lav-600 mt-0.5 text-base">
                                    {[
                                        line.variationName,
                                        ...line.modifiers.map(
                                            (modifier) => modifier.name,
                                        ),
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                            </li>
                        ))}
                    </ul>

                    <div className="border-lav-300 mt-4 border-t-2 border-dashed pt-4">
                        <div className="font-hand text-lav-700 flex text-xl">
                            <span>Subtotal</span>
                            <span className="ml-auto">
                                {cart.subtotal.formatted}
                            </span>
                        </div>
                        <p className="font-hand text-lav-500 mt-1 text-base">
                            Tax is calculated by Square when your order is
                            placed.
                        </p>
                        {tipCents > 0 && (
                            <div className="font-hand text-lav-700 mt-1 flex text-xl">
                                <span>Tip</span>
                                <span className="ml-auto">
                                    {formatCents(tipCents, currency)}
                                </span>
                            </div>
                        )}
                        <div className="border-lav-300 mt-3 flex items-baseline border-t-2 border-dashed pt-3">
                            <span className="font-hand text-lav-700 text-2xl">
                                Total
                            </span>
                            <span className="font-marker text-lav-800 ml-auto text-3xl">
                                {formatCents(
                                    cart.subtotal.cents + tipCents,
                                    currency,
                                )}
                            </span>
                        </div>
                        {readyTime && (
                            <p className="font-hand text-lav-600 mt-3 text-lg">
                                Ready for pickup around{' '}
                                <strong>{readyTime}</strong>.
                            </p>
                        )}
                    </div>
                </section>

                {/* ── 2. Contact details ─────────────────────────────────── */}
                <section className="sticker bg-lav-100 rounded-3xl p-6">
                    <div className="border-lav-300 flex items-center justify-between border-b-2 border-dashed pb-3">
                        <h2 className="font-marker text-lav-800 text-2xl">
                            Contact details
                        </h2>
                        {auth.user && (
                            <span className="bg-lav-200 font-hand text-lav-700 rounded-full px-3 py-1 text-sm">
                                Signed in
                            </span>
                        )}
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="font-hand text-lav-700 grid gap-1 text-xl">
                            Name
                            <input
                                value={form.data.name}
                                onChange={(event) =>
                                    form.setData('name', event.target.value)
                                }
                                required
                                autoComplete="name"
                                placeholder="Your name"
                                className={fieldClasses}
                            />
                            {form.errors.name && (
                                <span className="font-hand text-base text-rose-700">
                                    {form.errors.name}
                                </span>
                            )}
                        </label>

                        <label className="font-hand text-lav-700 grid gap-1 text-xl">
                            Email
                            <input
                                type="email"
                                value={form.data.email}
                                onChange={(event) =>
                                    form.setData('email', event.target.value)
                                }
                                required
                                autoComplete="email"
                                placeholder="name@example.com"
                                className={fieldClasses}
                            />
                            {form.errors.email && (
                                <span className="font-hand text-base text-rose-700">
                                    {form.errors.email}
                                </span>
                            )}
                        </label>
                    </div>

                    <label className="font-hand text-lav-700 mt-4 grid gap-1 text-xl">
                        Anything we should know?
                        <input
                            value={form.data.notes}
                            onChange={(event) =>
                                form.setData('notes', event.target.value)
                            }
                            placeholder="Extra hot, light ice…"
                            className={fieldClasses}
                        />
                    </label>
                </section>

                {/* ── 3. Payment details ─────────────────────────────────── */}
                <section className="sticker bg-lav-100 rounded-3xl p-6">
                    <div className="border-lav-300 border-b-2 border-dashed pb-3">
                        <h2 className="font-marker text-lav-800 text-2xl">
                            Payment details
                        </h2>
                    </div>

                    <div className="mt-4 grid gap-5">
                        {allowTipping && (
                            <div>
                                <h3 className="font-marker text-lav-800 text-xl">
                                    Add a tip
                                </h3>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {tipOptions.map((option) => (
                                        <button
                                            key={option.label}
                                            type="button"
                                            onClick={() => {
                                                setTipCents(option.cents);
                                                setCustomTip('');
                                            }}
                                            className={`font-hand rounded-full border-2 px-4 py-2 text-lg transition ${
                                                tipCents === option.cents &&
                                                customTip === ''
                                                    ? 'border-lav-700 bg-lav-600 text-white'
                                                    : 'border-lav-400 text-lav-700 hover:bg-lav-300 border-dashed'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                    <input
                                        inputMode="decimal"
                                        value={customTip}
                                        onChange={(event) => {
                                            setCustomTip(event.target.value);
                                            setTipCents(
                                                Math.max(
                                                    0,
                                                    Math.round(
                                                        Number(
                                                            event.target
                                                                .value || 0,
                                                        ) * 100,
                                                    ),
                                                ),
                                            );
                                        }}
                                        placeholder="Custom"
                                        aria-label="Custom tip in dollars"
                                        className="border-lav-300 font-hand text-lav-800 focus:border-lav-600 w-28 rounded-full border-2 bg-white px-4 py-2 text-lg outline-none"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="font-marker text-lav-800 mb-2 text-xl">
                                Card
                            </h3>
                            <div
                                id={CARD_CONTAINER_ID}
                                className="border-lav-200 min-h-[90px] rounded-2xl border-2 bg-white p-3"
                            >
                                {!square.configured && (
                                    <p className="font-hand text-lav-500 py-6 text-center text-lg">
                                        Card payments are not configured yet.
                                    </p>
                                )}
                            </div>
                            {card.error && (
                                <p className="font-hand mt-2 text-base text-rose-700">
                                    {card.error}
                                </p>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={pay}
                            disabled={
                                form.processing || !card.ready || !cart.valid
                            }
                            className="sticker bg-lav-600 font-marker hover:bg-lav-700 mt-2 w-full rounded-full py-3 text-lg text-white transition disabled:opacity-40"
                        >
                            {form.processing
                                ? 'Processing…'
                                : `Pay ${formatCents(cart.subtotal.cents + tipCents, currency)}`}
                        </button>

                        <p className="font-hand text-lav-500 text-center text-base">
                            Card details go straight to Square. We never see
                            them.
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}
