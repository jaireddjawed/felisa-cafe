"use client";

import { useState } from "react";
import { ADD_ONS, MILKS, money, type Product } from "@/lib/menu";
import { useCart } from "@/lib/cart";

function Option({
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
      className={`rounded-full border px-4 py-2 text-sm transition-all ${
        selected
          ? "border-glow-400 bg-glow-600/40 text-white shadow-[0_0_22px_-6px_rgba(168,108,245,0.9)]"
          : "border-white/15 text-haze hover:border-glow-500/60 hover:text-glow-300"
      }`}
    >
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
    <div className="hairline-glow pt-8">
      {product.bases && (
        <fieldset className="mb-7">
          <legend className="overline">Base</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.bases.map((option) => (
              <Option
                key={option}
                selected={base === option}
                onClick={() => setBase(option)}
              >
                {option}
              </Option>
            ))}
          </div>
        </fieldset>
      )}

      {takesMilk && (
        <fieldset className="mb-7">
          <legend className="overline">Milk — always free</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {MILKS.map((option) => (
              <Option
                key={option.id}
                selected={milk === option.id}
                onClick={() => setMilk(option.id)}
              >
                {option.label}
              </Option>
            ))}
          </div>
        </fieldset>
      )}

      {isDrink && (
        <fieldset className="mb-8">
          <legend className="overline">Add-ons</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {ADD_ONS.map((option) => (
              <Option
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
                {option.label}
                <span className="ml-2 opacity-60">+{money(option.price)}</span>
              </Option>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-full border border-white/15">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="One fewer"
            className="px-4 py-3 text-haze hover:text-glow-300"
          >
            −
          </button>
          <span className="min-w-5 text-center text-sm">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            aria-label="One more"
            className="px-4 py-3 text-haze hover:text-glow-300"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={submit}
          className="flex-1 rounded-full border border-glow-400 bg-glow-600/40 px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-glow-600/70 hover:shadow-[0_0_34px_-6px_rgba(168,108,245,0.95)]"
        >
          Add to cart — {money(unitPrice * qty)}
        </button>
      </div>
    </div>
  );
}
