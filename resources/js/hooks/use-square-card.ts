import { useEffect, useRef, useState } from 'react';
import type { SquareCard } from '@/types/square';

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
    selector: string;
    /** False when Square is not configured, so nothing is loaded. */
    enabled: boolean;
};

type SquareCardState = {
    ready: boolean;
    error: string | null;
    tokenize: () => Promise<string>;
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
    selector,
    enabled,
}: Options): SquareCardState {
    const card = useRef<SquareCard | null>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let cancelled = false;

        const attach = async () => {
            try {
                await loadSdk(sdkUrl);

                const payments = window.Square?.payments(
                    applicationId,
                    locationId,
                );

                if (!payments) {
                    throw new Error('Square Web Payments did not load.');
                }

                const attached = await payments.card();

                // The component unmounted while we were waiting.
                if (cancelled) {
                    await attached.destroy();

                    return;
                }

                await attached.attach(selector);
                card.current = attached;
                setReady(true);
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
            card.current = null;
            setReady(false);
        };
    }, [applicationId, enabled, locationId, sdkUrl, selector]);

    const tokenize = async (): Promise<string> => {
        if (!card.current) {
            throw new Error(
                'The card form is still loading. Please try again in a moment.',
            );
        }

        const result = await card.current.tokenize();

        if (result.status !== 'OK' || !result.token) {
            throw new Error(
                result.errors?.[0]?.message ?? 'That card could not be read.',
            );
        }

        return result.token;
    };

    return { ready, error, tokenize };
}
