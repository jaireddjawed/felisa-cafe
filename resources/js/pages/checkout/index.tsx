import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useMemo, useRef, useState } from 'react';
import { CatFace, Sparkle, SquiggleRule } from '@/components/doodles';
import Skeleton from '@/components/skeleton';
import { useSquareCard } from '@/hooks/use-square-card';
import { menu, settings } from '@/routes';
import { store } from '@/routes/checkout';
import type { Cart, Money, SavedCard, SharedProps } from '@/types';

const CARD_CONTAINER_ID = 'square-card';
const GOOGLE_PAY_CONTAINER_ID = 'square-google-pay';
const TIP_SECTION_ID = 'checkout-tip';

/**
 * A tip above this, and above the order itself, is checked with the customer
 * before it is charged. It is not a limit: it is there to catch a slip like
 * $500 for $5, and any amount can be confirmed.
 */
const LARGE_TIP_FLOOR_CENTS = 5_000;

type Props = {
    cart: Cart;
    pricingPreview: {
        tax: Money;
        total: Money;
    } | null;
    square: {
        applicationId: string | null;
        locationId: string;
        sdkUrl: string;
        countryCode: string;
        currencyCode: string;
        configured: boolean;
    };
    allowTipping: boolean;
    /** Empty for guests: a card on file needs an account to belong to. */
    savedCards: SavedCard[];
    canSaveCard: boolean;
    /** Where a signed-in customer's receipt goes; null for guests. */
    receiptEmail: string | null;
    /** False while the account's newest email is still unconfirmed. */
    emailConfirmed: boolean;
};

/** The fields that say what this attempt is paying with. */
type PaymentFields = {
    source_id: string;
    saved_card_id: string | null;
    save_card: boolean;
    verification_token: string | null;
};

function formatCents(cents: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
    }).format(cents / 100);
}

function customTipCents(
    value: string,
    subtotalCents: number,
    mode: 'dollars' | 'percent',
): number {
    const trimmed = value.trim();

    if (trimmed === '') {
        return 0;
    }

    const numeric = Number(trimmed.replace(/[$,]/g, ''));

    if (!Number.isFinite(numeric) || numeric < 0) {
        return 0;
    }

    if (mode === 'percent') {
        return Math.round(subtotalCents * (numeric / 100));
    }

    return Math.round(numeric * 100);
}

export default function Checkout({
    cart,
    pricingPreview,
    square,
    allowTipping,
    savedCards,
    canSaveCard,
    receiptEmail,
    emailConfirmed,
}: Props) {
    // `checkout` is a page-level error bag thrown by CheckoutController,
    // not a field on this form, so it comes from the page rather than useForm.
    const { auth, errors } = usePage<SharedProps>().props;

    const form = useForm({
        name: auth.user?.name ?? '',
        email: auth.user?.email ?? '',
        notes: '',
        source_id: '',
        saved_card_id: null as string | null,
        save_card: false,
        verification_token: null as string | null,
        tip_cents: 0,
        // Generated once per visit and reused on every retry, so a declined
        // card followed by a second attempt resumes one order rather than
        // creating another.
        idempotency_key: crypto.randomUUID(),
    });

    const [tipCents, setTipCents] = useState(0);
    const [tipChoice, setTipChoice] = useState('No tip');
    const [customTip, setCustomTip] = useState('');
    const [customTipMode, setCustomTipMode] = useState<'percent' | 'dollars'>(
        'percent',
    );
    const [cardError, setCardError] = useState<string | null>(null);

    // The tip amount the customer has said is right, and the payment waiting on
    // that answer. Confirming a different amount asks again.
    const [confirmedTipCents, setConfirmedTipCents] = useState<number | null>(
        null,
    );
    const [confirmingTip, setConfirmingTip] = useState(false);
    const pendingPayment = useRef<(() => Promise<PaymentFields>) | null>(null);

    // An expired card cannot be charged, so it is never the one offered first.
    const [chosenCardId, setChosenCardId] = useState<string | null>(
        savedCards.find((card) => !card.expired)?.id ?? null,
    );
    const [saveCard, setSaveCard] = useState(false);

    // Looked up rather than held, so removing the chosen card falls back to
    // the new-card form on the very next render.
    const chosenCard =
        savedCards.find((card) => card.id === chosenCardId) ?? null;
    const usingNewCard = chosenCard === null;

    // Tokenizing is async and happens before the request starts, so
    // `form.processing` alone leaves a window where a second click could
    // start another payment. The ref closes that window synchronously.
    const submitting = useRef(false);
    const [tokenizing, setTokenizing] = useState(false);
    const locked = form.processing || tokenizing;

    const currency = pricingPreview?.total.currency ?? cart.subtotal.currency;

    const tipOptions = useMemo(
        () => [
            { label: 'No tip', cents: 0 },
            { label: '15%', cents: Math.round(cart.subtotal.cents * 0.15) },
            { label: '20%', cents: Math.round(cart.subtotal.cents * 0.2) },
        ],
        [cart.subtotal.cents],
    );

    const orderTotalCents = pricingPreview?.total.cents ?? cart.subtotal.cents;
    const paymentTotalCents = orderTotalCents + tipCents;
    const paymentTotal = formatCents(paymentTotalCents, currency);

    const isLargeTip =
        tipCents > Math.max(LARGE_TIP_FLOOR_CENTS, orderTotalCents);
    const showTipConfirmation =
        confirmingTip && isLargeTip && confirmedTipCents !== tipCents;

    const paymentRequest = useMemo(
        () => ({
            countryCode: square.countryCode,
            currencyCode: square.currencyCode,
            total: {
                amount: (paymentTotalCents / 100).toFixed(2),
                label: 'Felisa Cafe',
            },
        }),
        [paymentTotalCents, square.countryCode, square.currencyCode],
    );

    const paymentMethods = useSquareCard({
        applicationId: square.applicationId ?? '',
        locationId: square.locationId,
        sdkUrl: square.sdkUrl,
        cardSelector: `#${CARD_CONTAINER_ID}`,
        googlePaySelector: `#${GOOGLE_PAY_CONTAINER_ID}`,
        paymentRequest,
        enabled: square.configured && cart.valid && cart.lines.length > 0,
    });

    // Show the placeholder only while the form can still arrive: not when
    // Square is unconfigured, the cart cannot be paid, or loading has failed
    // (each of those already says so on its own).
    const cardLoading =
        square.configured &&
        cart.valid &&
        !paymentMethods.cardReady &&
        !paymentMethods.error;

    // Same conditions as the card, plus wallet detection not having finished.
    // A card-form failure means the wallets never start, so it ends this too.
    const walletsLoading =
        square.configured &&
        cart.valid &&
        !paymentMethods.walletsSettled &&
        !paymentMethods.error;

    async function pay(
        prepare: () => Promise<PaymentFields>,
        { tipConfirmed = false }: { tipConfirmed?: boolean } = {},
    ) {
        if (submitting.current || form.processing || !cart.valid) {
            return;
        }

        // Ask before anything is tokenized, so a "no" costs the customer
        // nothing and spends no card token.
        if (!tipConfirmed && isLargeTip && confirmedTipCents !== tipCents) {
            pendingPayment.current = prepare;
            setConfirmingTip(true);

            return;
        }

        setConfirmingTip(false);

        submitting.current = true;
        setTokenizing(true);
        setCardError(null);

        // Unlock once the attempt settles, so a declined card can be retried.
        const unlock = () => {
            submitting.current = false;
            setTokenizing(false);
        };

        try {
            const payment = await prepare();

            form.transform((data) => ({
                ...data,
                ...payment,
                tip_cents: tipCents,
            }));
            form.post(store().url, { preserveScroll: true, onFinish: unlock });
        } catch (caught) {
            unlock();
            setCardError(
                caught instanceof Error
                    ? caught.message
                    : 'That payment method could not be read.',
            );
        }
    }

    const confirmTip = () => {
        const prepare = pendingPayment.current;

        pendingPayment.current = null;
        setConfirmingTip(false);
        setConfirmedTipCents(tipCents);

        if (prepare) {
            void pay(prepare, { tipConfirmed: true });
        }
    };

    const reviewTip = () => {
        pendingPayment.current = null;
        setConfirmingTip(false);

        document
            .getElementById(TIP_SECTION_ID)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    /** Wallets are one-off: there is no card of ours to keep. */
    const payWithWallet = (tokenize: () => Promise<string>) =>
        pay(async () => ({
            source_id: await tokenize(),
            saved_card_id: null,
            save_card: false,
            verification_token: null,
        }));

    const payWithNewCard = () =>
        pay(async () => {
            const token = await paymentMethods.tokenizeCard();

            return {
                source_id: token,
                saved_card_id: null,
                save_card: saveCard,
                // Keeping a card is what can need the cardholder challenged;
                // a one-off charge is sent exactly as it always was.
                verification_token: saveCard
                    ? await paymentMethods.verifyBuyer({
                          sourceId: token,
                          intent: 'STORE',
                          name: form.data.name,
                          email: form.data.email,
                      })
                    : null,
            };
        });

    /**
     * Only the row ID goes back to Laravel, which charges the card Square
     * holds for it. Nothing chargeable is ever handed to the browser.
     */
    const payWithSavedCard = (card: SavedCard) =>
        pay(async () => ({
            source_id: '',
            saved_card_id: card.id,
            save_card: false,
            verification_token: null,
        }));

    if (cart.lines.length === 0) {
        return (
            <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-5 sm:py-12">
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

    // A pill shape looks wrong once the field grows to several lines.
    const textareaClasses = `${fieldClasses.replace('rounded-full', 'rounded-2xl')} resize-y`;

    return (
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-5 sm:py-12">
            <Head title="Checkout" />

            <h1 className="font-marker text-lav-800 mt-4 text-4xl sm:text-5xl">
                Checkout
            </h1>
            <SquiggleRule className="text-lav-400 my-5 h-5 w-full" />

            {!cart.valid && (
                <p className="sticker font-hand mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-lg text-amber-900">
                    Some items are no longer available. Please review your cart
                    before paying.
                </p>
            )}

            <div className="grid gap-6">
                {/* ── 1. The order ───────────────────────────────────────── */}
                <section className="sticker bg-lav-100 w-full max-w-full rounded-3xl p-5 sm:p-6">
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
                                <div className="flex min-w-0 items-baseline justify-between gap-3">
                                    <p className="font-marker text-lav-800 min-w-0 text-lg">
                                        <span className="font-hand text-lav-700 mr-2 text-xl font-bold">
                                            {line.quantity}×
                                        </span>
                                        {line.productName}
                                    </p>
                                    <p className="font-hand text-lav-700 shrink-0 text-xl">
                                        {line.total.formatted}
                                    </p>
                                </div>
                                <p className="font-hand text-lav-600 mt-0.5 text-base wrap-break-word">
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
                        {tipCents > 0 && (
                            <div className="font-hand text-lav-700 mt-1 flex text-xl">
                                <span>Tip</span>
                                <span className="ml-auto">
                                    {formatCents(tipCents, currency)}
                                </span>
                            </div>
                        )}
                        {pricingPreview ? (
                            <div className="font-hand text-lav-700 mt-1 flex text-xl">
                                <span>Tax</span>
                                <span className="ml-auto">
                                    {pricingPreview.tax.formatted}
                                </span>
                            </div>
                        ) : (
                            <p className="font-hand text-lav-500 mt-1 text-base">
                                Tax will be included in your final receipt.
                            </p>
                        )}
                        <div className="border-lav-300 mt-3 flex items-baseline border-t-2 border-dashed pt-3">
                            <span className="font-hand text-lav-700 text-2xl">
                                Total
                            </span>
                            <span className="font-marker text-lav-800 ml-auto text-3xl">
                                {formatCents(paymentTotalCents, currency)}
                            </span>
                        </div>
                    </div>
                </section>

                {/* Everything the customer can change is locked while paying.
                    A fieldset disables native controls; pointer-events covers
                    Square's iframes and the Google Pay button. */}
                <fieldset
                    disabled={locked}
                    aria-busy={locked}
                    className={`m-0 grid min-w-0 gap-6 border-0 p-0 ${
                        locked ? 'pointer-events-none opacity-70' : ''
                    }`}
                >
                    {/* ── 2. Contact details ─────────────────────────────────── */}
                    <section className="sticker bg-lav-100 w-full max-w-full rounded-3xl p-5 sm:p-6">
                        <div className="border-lav-300 flex items-center justify-between border-b-2 border-dashed pb-3">
                            <h2 className="font-marker text-lav-800 text-2xl">
                                Contact details
                            </h2>
                        </div>

                        {auth.user ? (
                            // The account already says who this is, and the
                            // server uses it, so there is nothing to type.
                            <div className="mt-4">
                                <p className="font-hand text-lav-700 text-xl">
                                    Ordering as{' '}
                                    <span className="font-marker text-lav-800">
                                        {auth.user.name}
                                    </span>
                                </p>
                                <p className="font-hand text-lav-600 text-lg wrap-break-word">
                                    Your receipt will go to{' '}
                                    {receiptEmail ?? auth.user.email}
                                    {!emailConfirmed &&
                                    receiptEmail &&
                                    receiptEmail !== auth.user.email
                                        ? `, because ${auth.user.email} isn't confirmed yet.`
                                        : '.'}
                                </p>
                            </div>
                        ) : (
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <label className="font-hand text-lav-700 grid gap-1 text-xl">
                                    Name
                                    <input
                                        value={form.data.name}
                                        onChange={(event) =>
                                            form.setData(
                                                'name',
                                                event.target.value,
                                            )
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
                                            form.setData(
                                                'email',
                                                event.target.value,
                                            )
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
                        )}

                        <label className="font-hand text-lav-700 mt-4 grid gap-1 text-xl">
                            Anything we should know?
                            <textarea
                                value={form.data.notes}
                                onChange={(event) =>
                                    form.setData('notes', event.target.value)
                                }
                                rows={3}
                                maxLength={500}
                                placeholder="Extra hot, light ice…"
                                className={textareaClasses}
                            />
                            {form.errors.notes && (
                                <span className="font-hand text-base text-rose-700">
                                    {form.errors.notes}
                                </span>
                            )}
                        </label>
                    </section>

                    {/* ── 3. Payment details ─────────────────────────────────── */}
                    <section className="sticker bg-lav-100 w-full max-w-full rounded-3xl p-5 sm:p-6">
                        <div className="border-lav-300 border-b-2 border-dashed pb-3">
                            <h2 className="font-marker text-lav-800 text-2xl">
                                Payment details
                            </h2>
                        </div>

                        <div className="mt-4 grid gap-5">
                            {allowTipping && (
                                <div id={TIP_SECTION_ID}>
                                    <h3 className="font-marker text-lav-800 text-xl">
                                        Add a tip
                                    </h3>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {tipOptions.map((option) => (
                                            <button
                                                key={option.label}
                                                type="button"
                                                onClick={() => {
                                                    setTipChoice(option.label);
                                                    setTipCents(option.cents);
                                                    setCustomTip('');
                                                }}
                                                className={`font-hand rounded-full border-2 px-4 py-2 text-lg transition ${
                                                    tipChoice === option.label
                                                        ? 'border-lav-700 bg-lav-600 text-white'
                                                        : 'border-lav-400 text-lav-700 hover:bg-lav-300 border-dashed'
                                                }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTipChoice('Custom');
                                                setTipCents(
                                                    customTipCents(
                                                        customTip,
                                                        cart.subtotal.cents,
                                                        customTipMode,
                                                    ),
                                                );
                                            }}
                                            className={`font-hand rounded-full border-2 px-4 py-2 text-lg transition ${
                                                tipChoice === 'Custom'
                                                    ? 'border-lav-700 bg-lav-600 text-white'
                                                    : 'border-lav-400 text-lav-700 hover:bg-lav-300 border-dashed'
                                            }`}
                                        >
                                            Custom
                                        </button>

                                        {tipChoice === 'Custom' && (
                                            <div className="mt-3 grid w-full gap-2 sm:grid-cols-[auto_1fr]">
                                                <div
                                                    className="border-lav-400 flex rounded-full border-2 bg-white p-1"
                                                    role="group"
                                                    aria-label="Custom tip type"
                                                >
                                                    {[
                                                        {
                                                            label: '%',
                                                            mode: 'percent' as const,
                                                        },
                                                        {
                                                            label: '$',
                                                            mode: 'dollars' as const,
                                                        },
                                                    ].map((option) => (
                                                        <button
                                                            key={option.mode}
                                                            type="button"
                                                            aria-pressed={
                                                                customTipMode ===
                                                                option.mode
                                                            }
                                                            onClick={() => {
                                                                setTipChoice(
                                                                    'Custom',
                                                                );
                                                                setCustomTipMode(
                                                                    option.mode,
                                                                );
                                                                setTipCents(
                                                                    customTipCents(
                                                                        customTip,
                                                                        cart
                                                                            .subtotal
                                                                            .cents,
                                                                        option.mode,
                                                                    ),
                                                                );
                                                            }}
                                                            className={`font-hand grid size-10 place-items-center rounded-full text-lg transition ${
                                                                customTipMode ===
                                                                option.mode
                                                                    ? 'bg-lav-600 text-white'
                                                                    : 'text-lav-700 hover:bg-lav-200'
                                                            }`}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <input
                                                    inputMode="decimal"
                                                    value={customTip}
                                                    onChange={(event) => {
                                                        const value =
                                                            event.target.value;

                                                        setCustomTip(value);
                                                        setTipCents(
                                                            customTipCents(
                                                                value,
                                                                cart.subtotal
                                                                    .cents,
                                                                customTipMode,
                                                            ),
                                                        );
                                                    }}
                                                    aria-label={
                                                        customTipMode ===
                                                        'percent'
                                                            ? 'Custom tip percentage'
                                                            : 'Custom tip amount in dollars'
                                                    }
                                                    className="border-lav-300 font-hand text-lav-800 focus:border-lav-600 w-full rounded-full border-2 bg-white px-4 py-2 text-lg outline-none"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Wallet buttons are only known to exist once
                                detection finishes, and they render off-screen
                                until then. This holds their place, and simply
                                goes away when no wallet is available. */}
                            {walletsLoading && (
                                <div
                                    role="status"
                                    aria-label="Checking for Apple Pay and Google Pay"
                                >
                                    <Skeleton className="h-12 w-full rounded-xl" />
                                </div>
                            )}

                            <div
                                className={
                                    paymentMethods.applePayReady ||
                                    paymentMethods.googlePayReady
                                        ? ''
                                        : 'pointer-events-none absolute top-0 -left-[100vw] w-full opacity-0'
                                }
                            >
                                <div className="grid w-full gap-3">
                                    {paymentMethods.applePayReady && (
                                        <button
                                            type="button"
                                            aria-label={`Pay ${paymentTotal} with Apple Pay`}
                                            onClick={() =>
                                                payWithWallet(
                                                    paymentMethods.tokenizeApplePay,
                                                )
                                            }
                                            disabled={locked || !cart.valid}
                                            className="apple-pay-button wallet-pay-button h-12 rounded-xl disabled:opacity-40"
                                        />
                                    )}
                                    <div
                                        id={GOOGLE_PAY_CONTAINER_ID}
                                        className={
                                            paymentMethods.googlePayReady
                                                ? 'wallet-pay-button min-h-12 w-full'
                                                : 'wallet-pay-button h-12 w-full'
                                        }
                                        onClick={() =>
                                            void payWithWallet(
                                                paymentMethods.tokenizeGooglePay,
                                            )
                                        }
                                    />
                                </div>
                            </div>

                            {savedCards.length > 0 && (
                                <div>
                                    <h3 className="font-marker text-lav-800 mb-2 text-xl">
                                        Your cards
                                    </h3>
                                    <ul className="grid gap-2">
                                        {savedCards.map((card) => (
                                            <li
                                                key={card.id}
                                                className="border-lav-300 rounded-2xl border-2 bg-white px-4 py-2.5"
                                            >
                                                <label className="font-hand text-lav-800 flex min-w-0 items-center gap-3 text-lg">
                                                    <input
                                                        type="radio"
                                                        name="payment-method"
                                                        className="accent-lav-600 size-4 shrink-0"
                                                        checked={
                                                            chosenCardId ===
                                                            card.id
                                                        }
                                                        disabled={card.expired}
                                                        onChange={() =>
                                                            setChosenCardId(
                                                                card.id,
                                                            )
                                                        }
                                                    />
                                                    <span className="min-w-0 truncate">
                                                        {card.brand} ••••{' '}
                                                        {card.last4}
                                                        <span className="text-lav-600 ml-2 text-base">
                                                            {card.expired
                                                                ? 'expired'
                                                                : `exp ${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`}
                                                        </span>
                                                    </span>
                                                </label>
                                            </li>
                                        ))}
                                        <li className="border-lav-300 flex items-center rounded-2xl border-2 border-dashed px-4 py-2.5">
                                            <label className="font-hand text-lav-800 flex flex-1 items-center gap-3 text-lg">
                                                <input
                                                    type="radio"
                                                    name="payment-method"
                                                    className="accent-lav-600 size-4 shrink-0"
                                                    checked={usingNewCard}
                                                    onChange={() =>
                                                        setChosenCardId(null)
                                                    }
                                                />
                                                Use a new card
                                            </label>
                                        </li>
                                    </ul>
                                    <Link
                                        href={settings()}
                                        className="font-hand text-lav-600 hover:text-lav-800 mt-2 inline-block text-base underline"
                                    >
                                        Manage your cards in settings
                                    </Link>
                                </div>
                            )}

                            {/* The card form stays attached even while a saved
                                card is chosen: Square's iframes do not survive
                                being mounted inside a hidden element. */}
                            <div
                                className={
                                    usingNewCard
                                        ? ''
                                        : 'pointer-events-none absolute top-0 -left-[100vw] w-full opacity-0'
                                }
                            >
                                <h3 className="font-marker text-lav-800 mb-2 text-xl">
                                    Card
                                </h3>
                                <div className="relative">
                                    <div
                                        id={CARD_CONTAINER_ID}
                                        className="border-lav-200 min-h-[90px] rounded-2xl border-2 bg-white p-3"
                                    >
                                        {!square.configured && (
                                            <p className="font-hand text-lav-500 py-6 text-center text-lg">
                                                Card payments are not configured
                                                yet.
                                            </p>
                                        )}
                                    </div>

                                    {/* Square fills the container above with its
                                        own iframes, so the placeholder sits over
                                        it instead of inside it, and goes away
                                        the moment the real form is ready. */}
                                    {cardLoading && (
                                        <div
                                            role="status"
                                            aria-label="Loading the card form"
                                            className="border-lav-200 absolute inset-0 grid content-start gap-3 rounded-2xl border-2 bg-white p-3"
                                        >
                                            <div className="border-lav-200 flex items-center gap-4 rounded-lg border px-4 py-4">
                                                <Skeleton className="h-6 w-9 shrink-0" />
                                                <Skeleton className="h-5 flex-1" />
                                                <Skeleton className="hidden h-5 w-16 sm:block" />
                                                <Skeleton className="hidden h-5 w-12 sm:block" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {paymentMethods.error && (
                                    <p className="font-hand mt-2 text-base text-rose-700">
                                        {paymentMethods.error}
                                    </p>
                                )}

                                {canSaveCard && square.configured && (
                                    <label className="font-hand text-lav-700 mt-3 flex items-center gap-3 text-lg">
                                        <input
                                            type="checkbox"
                                            className="accent-lav-600 size-4"
                                            checked={saveCard}
                                            onChange={(event) =>
                                                setSaveCard(
                                                    event.target.checked,
                                                )
                                            }
                                        />
                                        Save this card for next time
                                    </label>
                                )}
                            </div>

                            {showTipConfirmation && (
                                <div
                                    role="alert"
                                    className="sticker rounded-2xl border-2 border-amber-300 bg-amber-50 p-4"
                                >
                                    <p className="font-hand text-xl text-amber-900">
                                        Your tip is{' '}
                                        <span className="font-marker">
                                            {formatCents(tipCents, currency)}
                                        </span>
                                        , which is a lot more than the{' '}
                                        {formatCents(orderTotalCents, currency)}{' '}
                                        order. Is that right?
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={confirmTip}
                                            className="sticker bg-lav-600 font-marker hover:bg-lav-700 rounded-full px-5 py-2 text-lg text-white transition"
                                        >
                                            Yes, tip{' '}
                                            {formatCents(tipCents, currency)}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={reviewTip}
                                            className="font-hand text-lav-700 hover:bg-lav-200 border-lav-400 rounded-full border-2 border-dashed px-5 py-2 text-lg transition"
                                        >
                                            Change my tip
                                        </button>
                                    </div>
                                </div>
                            )}

                            {(errors.checkout || cardError) && (
                                <p
                                    className="sticker font-hand rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 text-lg text-rose-800"
                                    role="alert"
                                >
                                    {errors.checkout ?? cardError}
                                </p>
                            )}

                            <button
                                type="button"
                                onClick={() =>
                                    chosenCard
                                        ? payWithSavedCard(chosenCard)
                                        : payWithNewCard()
                                }
                                disabled={
                                    locked ||
                                    (usingNewCard &&
                                        !paymentMethods.cardReady) ||
                                    !cart.valid
                                }
                                className="sticker bg-lav-600 font-marker hover:bg-lav-700 mt-2 w-full rounded-full py-3 text-lg text-white transition disabled:opacity-40"
                            >
                                {locked ? 'Processing…' : `Pay ${paymentTotal}`}
                            </button>
                        </div>
                    </section>
                </fieldset>
            </div>
        </div>
    );
}
