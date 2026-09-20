import { useForm, usePage } from '@inertiajs/react';
import { useMemo } from 'react';
import { Sparkle } from '@/components/doodles';
import { store } from '@/routes/cart';
import type { ModifierList, ProductDetail, SharedProps } from '@/types';

/**
 * Picks a variation and options, then posts the selection to Laravel.
 *
 * The running total shown on the button is a convenience only: the server
 * re-prices everything from Product records and its answer is the one that
 * lands in the cart.
 */

/** Lists with a minimum start with their first option already chosen. */
function initialModifiers(lists: ModifierList[]): string[] {
    return lists.flatMap((list) =>
        list.minSelected > 0 && list.modifiers[0] ? [list.modifiers[0].id] : [],
    );
}

/** "Milk" reads better as "Choice of milk" above the buttons. */
function listHeading(list: ModifierList): string {
    const name = list.name.toLowerCase();

    if (name.includes('milk')) {
        return 'Choice of milk';
    }

    if (name.includes('add') || name.includes('extra')) {
        return 'Make it extra';
    }

    return list.name;
}

/**
 * Toggles one option within its own list, respecting that list's limits:
 * a "pick one" list swaps the selection, and a list at its maximum drops its
 * oldest choice rather than refusing the click.
 */
function toggleSelection(
    selected: string[],
    list: ModifierList,
    modifierId: string,
): string[] {
    const idsInList = new Set(list.modifiers.map((modifier) => modifier.id));
    const inList = selected.filter((id) => idsInList.has(id));
    const outsideList = selected.filter((id) => !idsInList.has(id));

    if (inList.includes(modifierId)) {
        // Never drop below the minimum, e.g. you must have some milk.
        if (inList.length <= list.minSelected) {
            return selected;
        }

        return [...outsideList, ...inList.filter((id) => id !== modifierId)];
    }

    const max = list.maxSelected || list.modifiers.length;
    const next = max <= 1 ? [modifierId] : [...inList, modifierId].slice(-max);

    return [...outsideList, ...next];
}

type Props = {
    product: ProductDetail;
};

export default function AddToCart({ product }: Props) {
    const { errors } = usePage<SharedProps>().props;
    const available = product.variations.filter(
        (variation) => variation.available,
    );

    // The form is the single source of truth for the selection, so what is
    // shown and what is submitted cannot drift apart.
    const form = useForm({
        variation_id: available[0]?.id ?? '',
        modifier_ids: initialModifiers(product.modifierLists),
        quantity: 1,
    });

    const {
        variation_id: variationId,
        modifier_ids: modifierIds,
        quantity,
    } = form.data;

    const variation = available.find((option) => option.id === variationId);

    const unitCents = useMemo(() => {
        const modifierCents = product.modifierLists
            .flatMap((list) => list.modifiers)
            .filter((modifier) => modifierIds.includes(modifier.id))
            .reduce((sum, modifier) => sum + modifier.price.cents, 0);

        return (variation?.price.cents ?? 0) + modifierCents;
    }, [modifierIds, product.modifierLists, variation]);

    function submit() {
        if (!variation) {
            return;
        }

        form.post(store().url, { preserveScroll: true });
    }

    if (available.length === 0) {
        return (
            <div className="sticker bg-lav-100 font-hand text-lav-700 rounded-3xl p-6 text-2xl">
                This one isn&apos;t available online right now.
            </div>
        );
    }

    const optionClasses = (selected: boolean) =>
        `flex items-center gap-2 rounded-full border-2 px-4 py-1.5 font-hand text-lg transition ${
            selected
                ? 'border-lav-700 bg-lav-600 text-white'
                : 'border-dashed border-lav-400 text-lav-700 hover:bg-lav-300'
        }`;

    return (
        <div className="sticker bg-lav-100 rounded-3xl p-6">
            {available.length > 1 && (
                <fieldset className="mb-5">
                    <legend className="font-marker text-lav-800 text-base">
                        Pick your base
                    </legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {available.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() =>
                                    form.setData('variation_id', option.id)
                                }
                                aria-pressed={variationId === option.id}
                                className={optionClasses(
                                    variationId === option.id,
                                )}
                            >
                                {option.name}
                            </button>
                        ))}
                    </div>
                </fieldset>
            )}

            {product.modifierLists.map((list) => (
                <fieldset key={list.id} className="mb-5">
                    <legend className="font-marker text-lav-800 text-base">
                        {listHeading(list)}
                        {list.name.toLowerCase().includes('milk') && (
                            <span className="font-hand text-lav-600">
                                {' '}
                                — always free
                            </span>
                        )}
                    </legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {list.modifiers.map((modifier) => {
                            const selected = modifierIds.includes(modifier.id);

                            return (
                                <button
                                    key={modifier.id}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() =>
                                        form.setData(
                                            'modifier_ids',
                                            toggleSelection(
                                                modifierIds,
                                                list,
                                                modifier.id,
                                            ),
                                        )
                                    }
                                    className={optionClasses(selected)}
                                >
                                    {selected && <Sparkle size={12} />}
                                    {modifier.name}
                                    {modifier.price.cents !== 0 && (
                                        <span className="opacity-70">
                                            +{modifier.price.formatted}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </fieldset>
            ))}

            {errors.cart && (
                <p
                    className="font-hand mb-3 text-lg text-rose-700"
                    role="alert"
                >
                    {errors.cart}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <div className="border-lav-400 flex items-center rounded-full border-2 bg-white">
                    <button
                        type="button"
                        onClick={() =>
                            form.setData('quantity', Math.max(1, quantity - 1))
                        }
                        aria-label="One fewer"
                        className="font-hand text-lav-700 px-4 py-2 text-xl"
                    >
                        −
                    </button>
                    <span className="font-hand min-w-6 text-center text-xl">
                        {quantity}
                    </span>
                    <button
                        type="button"
                        onClick={() => form.setData('quantity', quantity + 1)}
                        aria-label="One more"
                        className="font-hand text-lav-700 px-4 py-2 text-xl"
                    >
                        +
                    </button>
                </div>

                <button
                    type="button"
                    onClick={submit}
                    disabled={form.processing || !variation}
                    className="sticker bg-lav-600 font-marker hover:bg-lav-700 flex-1 rounded-full px-6 py-3 text-base text-white transition hover:-rotate-1 disabled:opacity-50"
                >
                    {form.processing
                        ? 'Adding…'
                        : `Add to cart — $${((unitCents * quantity) / 100).toFixed(2)}`}
                </button>
            </div>
        </div>
    );
}
