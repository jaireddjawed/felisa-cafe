import { useEffect, useRef, useState } from 'react';
import type {
    SquareCard,
    SquarePaymentRequest,
    SquarePaymentRequestOptions,
    SquarePayments,
    SquareWallet,
} from '@/types/square';

/**
 * Loads Square's Web Payments SDK and attaches its card form to `selector`.
 *
 * The form runs in Square's own iframes, so card numbers never reach this
 * application. What comes back from `tokenize()` is a single-use token, which
 * is the only thing sent to Laravel.
 */

type Options = {
    applicationId: string;
    locationId: string;
    sdkUrl: string;
    cardSelector: string;
    googlePaySelector: string;
    paymentRequest: SquarePaymentRequestOptions;
    /** False when Square is not configured, so nothing is loaded. */
    enabled: boolean;
};

type SquareCardState = {
    cardReady: boolean;
    applePayReady: boolean;
    googlePayReady: boolean;
    error: string | null;
    tokenizeCard: () => Promise<string>;
    tokenizeApplePay: () => Promise<string>;
    tokenizeGooglePay: () => Promise<string>;
};

/** Loads the SDK once per page, reusing the tag on later mounts. */
function loadSdk(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (window.Square) {
            resolve();

            return;
        }

        const existing = document.querySelector<HTMLScriptElement>(
            `script[src="${src}"]`,
        );

        if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () =>
                reject(new Error('Square could not be loaded.')),
            );

            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.addEventListener('load', () => resolve());
        script.addEventListener('error', () =>
            reject(new Error('Square could not be loaded.')),
        );
        document.head.appendChild(script);
    });
}

export function useSquareCard({
    applicationId,
    locationId,
    sdkUrl,
    cardSelector,
    googlePaySelector,
    paymentRequest,
    enabled,
}: Options): SquareCardState {
    const payments = useRef<SquarePayments | null>(null);
    const squarePaymentRequest = useRef<SquarePaymentRequest | null>(null);
    const card = useRef<SquareCard | null>(null);
    const applePay = useRef<SquareWallet | null>(null);
    const googlePay = useRef<SquareWallet | null>(null);
    const [cardReady, setCardReady] = useState(false);
    const [applePayReady, setApplePayReady] = useState(false);
    const [googlePayReady, setGooglePayReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let cancelled = false;

        const attach = async () => {
            try {
                await loadSdk(sdkUrl);

                const attachedPayments = window.Square?.payments(
                    applicationId,
                    locationId,
                );

                if (!attachedPayments) {
                    throw new Error('Square Web Payments did not load.');
                }

                payments.current = attachedPayments;

                const attachedCard = await attachedPayments.card();

                // The component unmounted while we were waiting.
                if (cancelled) {
                    await attachedCard.destroy();

                    return;
                }

                await attachedCard.attach(cardSelector);
                card.current = attachedCard;
                setCardReady(true);
            } catch (caught) {
                if (!cancelled) {
                    setError(
                        caught instanceof Error
                            ? caught.message
                            : 'Could not load the card form.',
                    );
                }
            }
        };

        void attach();

        return () => {
            cancelled = true;
            void card.current?.destroy();
            void applePay.current?.destroy?.();
            void googlePay.current?.destroy?.();
            payments.current = null;
            squarePaymentRequest.current = null;
            card.current = null;
            applePay.current = null;
            googlePay.current = null;
            setCardReady(false);
            setApplePayReady(false);
            setGooglePayReady(false);
        };
    }, [
        applicationId,
        cardSelector,
        enabled,
        locationId,
        sdkUrl,
    ]);

    useEffect(() => {
        if (!enabled || !payments.current || !cardReady) {
            return;
        }

        let cancelled = false;
        const request = payments.current.paymentRequest(paymentRequest);
        squarePaymentRequest.current = request;
        setApplePayReady(false);
        setGooglePayReady(false);

        const attachWallets = async () => {
            try {
                const attachedApplePay = await payments.current?.applePay(
                    request,
                );

                if (!cancelled && attachedApplePay) {
                    applePay.current = attachedApplePay;
                    setApplePayReady(true);
                }
            } catch {
                // Apple Pay is device/browser/account dependent. Card and
                // Google Pay should still load when it is unavailable.
            }

            try {
                const attachedGooglePay = await payments.current?.googlePay(
                    request,
                );

                if (!attachedGooglePay) {
                    return;
                }

                if (cancelled) {
                    await attachedGooglePay.destroy?.();

                    return;
                }

                await attachedGooglePay.attach?.(googlePaySelector);
                googlePay.current = attachedGooglePay;
                setGooglePayReady(true);
            } catch {
                // Google Pay is browser/account dependent. Card checkout
                // remains the fallback when it cannot initialize.
            }
        };

        void attachWallets();

        return () => {
            cancelled = true;
            void applePay.current?.destroy?.();
            void googlePay.current?.destroy?.();
            squarePaymentRequest.current = null;
            applePay.current = null;
            googlePay.current = null;
            setApplePayReady(false);
            setGooglePayReady(false);
        };
    }, [cardReady, enabled, googlePaySelector, paymentRequest]);

    const tokenizePaymentMethod = async (
        paymentMethod: SquareCard | SquareWallet | null,
        loadingMessage: string,
    ): Promise<string> => {
        if (!paymentMethod) {
            throw new Error(loadingMessage);
        }

        const result = await paymentMethod.tokenize();

        if (result.status !== 'OK' || !result.token) {
            throw new Error(
                result.errors?.[0]?.message ??
                    'That payment method could not be read.',
            );
        }

        return result.token;
    };

    const tokenizeCard = async (): Promise<string> =>
        tokenizePaymentMethod(
            card.current,
            'The card form is still loading. Please try again in a moment.',
        );

    const tokenizeApplePay = async (): Promise<string> =>
        tokenizePaymentMethod(
            applePay.current,
            'Apple Pay is not available. Please try another payment method.',
        );

    const tokenizeGooglePay = async (): Promise<string> =>
        tokenizePaymentMethod(
            googlePay.current,
            'Google Pay is not available. Please try another payment method.',
        );

    return {
        cardReady,
        applePayReady,
        googlePayReady,
        error,
        tokenizeCard,
        tokenizeApplePay,
        tokenizeGooglePay,
    };
}
