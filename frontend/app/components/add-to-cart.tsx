"use client";

import { useMemo, useState } from "react";
import type { ModifierListView, ProductView } from "@/lib/api-types";
import { useCart } from "@/lib/cart";
import { Sparkle } from "./doodles";

function initialModifiers(lists: ModifierListView[]) {
  return lists.flatMap((list) =>
    list.minSelected > 0 && list.modifiers[0] ? [list.modifiers[0].id] : [],
  );
}

function modifierLabel(list: ModifierListView) {
  const name = list.name.toLowerCase();
  if (name.includes("milk")) return "Choice of milk";
  if (name.includes("extra") || name.includes("add")) return "Make it extra";
  return list.name;
}

function toggleSelection(
  selected: string[],
  list: ModifierListView,
  modifierId: string,
) {
  const ids = new Set(list.modifiers.map((m) => m.id));
  const inList = selected.filter((id) => ids.has(id));
  const outsideList = selected.filter((id) => !ids.has(id));

  if (inList.includes(modifierId)) {
    if (inList.length <= list.minSelected) return selected;
    return [...outsideList, ...inList.filter((id) => id !== modifierId)];
  }

  const max = list.maxSelected || list.modifiers.length;
  const next = max <= 1 ? [modifierId] : [...inList, modifierId].slice(-max);
  return [...outsideList, ...next];
}

export function AddToCart({ product }: { product: ProductView }) {
  const { add, loading, error, clearError } = useCart();
  const availableVariations = product.variations.filter((v) => v.available);

  const [variationId, setVariationId] = useState(
    availableVariations[0]?.id ?? "",
  );
  const [modifierIds, setModifierIds] = useState(() =>
    initialModifiers(product.modifierLists),
  );
  const [qty, setQty] = useState(1);

  const variation = availableVariations.find((v) => v.id === variationId);
  const selectedModifiers = useMemo(
    () =>
      product.modifierLists
        .flatMap((list) => list.modifiers)
        .filter((modifier) => modifierIds.includes(modifier.id)),
    [modifierIds, product.modifierLists],
  );
  const selectedModifierTotal = selectedModifiers.reduce(
    (sum, modifier) => sum + modifier.price.amount,
    0,
  );
  const unitAmount = (variation?.price.amount ?? 0) + selectedModifierTotal;

  function submit() {
    if (!variation) return;
    void add({
      variationId: variation.id,
      modifierIds,
      quantity: qty,
    });
  }

  if (!availableVariations.length) {
    return (
      <div className="sticker rounded-3xl bg-lav-100 p-6 font-hand text-2xl text-lav-700">
        This item is not available online right now.
      </div>
    );
  }

  return (
    <div className="sticker rounded-3xl bg-lav-100 p-6">
      {availableVariations.length > 1 && (
        <fieldset className="mb-5">
          <legend className="font-marker text-base text-lav-800">
            Pick your base
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableVariations.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setVariationId(option.id)}
                className={`rounded-full border-2 px-4 py-1.5 font-hand text-lg transition ${
                  variationId === option.id
                    ? "border-lav-700 bg-lav-600 text-white"
                    : "border-dashed border-lav-400 text-lav-700 hover:bg-lav-300"
                }`}
              >
                {option.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {product.modifierLists.map((list) => (
        <fieldset key={list.id} className="mb-5">
          <legend className="font-marker text-base text-lav-800">
            {modifierLabel(list)}
            {list.name.toLowerCase().includes("milk") && (
              <span className="font-hand text-lav-600"> - always free</span>
            )}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {list.modifiers.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  clearError();
                  setModifierIds((prev) =>
                    toggleSelection(prev, list, option.id),
                  );
                }}
                className={`flex items-center gap-2 rounded-full border-2 px-4 py-1.5 font-hand text-lg transition ${
                  modifierIds.includes(option.id)
                    ? "border-lav-700 bg-lav-600 text-white"
                    : "border-dashed border-lav-400 text-lav-700 hover:bg-lav-300"
                }`}
              >
                {modifierIds.includes(option.id) && <Sparkle size={12} />}
                {option.name}
                {option.price.amount !== 0 && (
                  <span className="opacity-70">+{option.price.formatted}</span>
                )}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      {error && (
        <p className="mb-3 font-hand text-lg text-lav-800" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border-2 border-lav-400 bg-white">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="One fewer"
            className="px-4 py-2 font-hand text-xl text-lav-700"
          >
            -
          </button>
          <span className="min-w-6 text-center font-hand text-xl">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            aria-label="One more"
            className="px-4 py-2 font-hand text-xl text-lav-700"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={loading || !variation}
          className="sticker flex-1 rounded-full bg-lav-600 px-6 py-3 font-marker text-base text-white transition hover:-rotate-1 hover:bg-lav-700 disabled:opacity-50"
        >
          {loading ? "Adding..." : `Add to cart - $${((unitAmount * qty) / 100).toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
