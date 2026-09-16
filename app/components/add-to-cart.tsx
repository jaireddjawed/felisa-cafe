"use client";

import { useState } from "react";
import { ADD_ONS, MILKS, money, type Product } from "@/lib/menu";
import { useCart } from "@/lib/cart";
import { Star } from "./marks";

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`pop-sm pop-press flex items-center gap-1.5 px-4 py-1.5 font-bubble text-base ${
        selected ? "bg-bubblegum text-white" : "bg-white text-grape-900"
      }`}
    >
      {selected && <Star size={12} className="text-butter" />}
      {children}
    </button>
  );
}

export function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();
  const isDrink = product.category === "signature";
  const takesMilk =
    isDrink && product.ingredients.some((i) => i.includes("milk"));

  const [base, setBase] = useState(product.bases?.[0] ?? "");
  const [milk, setMilk] = useState(MILKS[1].id);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [qty, setQty] = useState(1);

  const addOnTotal = ADD_ONS.filter((a) => addOns.includes(a.id)).reduce(
    (n, a) => n + a.price,
    0,
  );
  const unitPrice = product.price + addOnTotal;

  function submit() {
    const options: string[] = [];
    if (base) options.push(base);
    if (takesMilk) options.push(MILKS.find((m) => m.id === milk)!.label);
    for (const a of ADD_ONS) {
      if (addOns.includes(a.id)) options.push(a.label);
    }
    add({ slug: product.slug, name: product.name, unitPrice, options }, qty);
  }

  return (
    <div className="pop bg-white p-5">
      {product.bases && (
        <fieldset className="mb-5">
          <legend className="font-bubble text-lg text-grape-900">
            pick a base
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.bases.map((option) => (
              <Chip
                key={option}
                selected={base === option}
                onClick={() => setBase(option)}
              >
                {option}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      {takesMilk && (
        <fieldset className="mb-5">
          <legend className="font-bubble text-lg text-grape-900">
            choice of milk{" "}
            <span className="font-note text-xl text-grape-600">
              (always free!)
            </span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {MILKS.map((option) => (
              <Chip
                key={option.id}
                selected={milk === option.id}
                onClick={() => setMilk(option.id)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      {isDrink && (
        <fieldset className="mb-6">
          <legend className="font-bubble text-lg text-grape-900">
            make it extra
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ADD_ONS.map((option) => (
              <Chip
                key={option.id}
                selected={addOns.includes(option.id)}
                onClick={() =>
                  setAddOns((prev) =>
                    prev.includes(option.id)
                      ? prev.filter((a) => a !== option.id)
                      : [...prev, option.id],
                  )
                }
              >
                {option.label} +{money(option.price)}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border-3 border-grape-900 bg-lilac-100">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="One fewer"
            className="px-4 py-2 font-bubble text-xl text-grape-900"
          >
            −
          </button>
          <span className="min-w-6 text-center font-bubble text-xl">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            aria-label="One more"
            className="px-4 py-2 font-bubble text-xl text-grape-900"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={submit}
          className="pop pop-press flex-1 bg-bubblegum px-6 py-3 font-bubble text-xl text-white"
        >
          add to cart · {money(unitPrice * qty)}
        </button>
      </div>
    </div>
  );
}
