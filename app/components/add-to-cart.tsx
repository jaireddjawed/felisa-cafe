"use client";

import { useState } from "react";
import { ADD_ONS, MILKS, money, type Product } from "@/lib/menu";
import { useCart } from "@/lib/cart";
import { Sparkle } from "./doodles";

export function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();
  const isDrink = product.category === "signature";

  const [base, setBase] = useState(product.bases?.[0] ?? "");
  const [milk, setMilk] = useState(MILKS[1].id);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [qty, setQty] = useState(1);

  const addOnTotal = ADD_ONS.filter((a) => addOns.includes(a.id)).reduce(
    (n, a) => n + a.price,
    0,
  );
  const unitPrice = product.price + addOnTotal;

  function toggleAddOn(id: string) {
    setAddOns((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  }

  function submit() {
    const options: string[] = [];
    if (base) options.push(base);
    if (isDrink && product.ingredients.some((i) => i.includes("milk"))) {
      options.push(MILKS.find((m) => m.id === milk)!.label);
    }
    for (const a of ADD_ONS) {
      if (addOns.includes(a.id)) options.push(a.label);
    }
    add({ slug: product.slug, name: product.name, unitPrice, options }, qty);
  }

  const takesMilk =
    isDrink && product.ingredients.some((i) => i.includes("milk"));

  return (
    <div className="sticker rounded-3xl bg-lav-100 p-6">
      {product.bases && (
        <fieldset className="mb-5">
          <legend className="font-marker text-base text-lav-800">
            Pick your base
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.bases.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setBase(option)}
                className={`rounded-full border-2 px-4 py-1.5 font-hand text-lg transition ${
                  base === option
                    ? "border-lav-700 bg-lav-600 text-white"
                    : "border-dashed border-lav-400 text-lav-700 hover:bg-lav-300"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {takesMilk && (
        <fieldset className="mb-5">
          <legend className="font-marker text-base text-lav-800">
            Choice of milk{" "}
            <span className="font-hand text-lav-600">— always free</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {MILKS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMilk(option.id)}
                className={`rounded-full border-2 px-4 py-1.5 font-hand text-lg transition ${
                  milk === option.id
                    ? "border-lav-700 bg-lav-600 text-white"
                    : "border-dashed border-lav-400 text-lav-700 hover:bg-lav-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {isDrink && (
        <fieldset className="mb-5">
          <legend className="font-marker text-base text-lav-800">
            Make it extra
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ADD_ONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleAddOn(option.id)}
                className={`flex items-center gap-2 rounded-full border-2 px-4 py-1.5 font-hand text-lg transition ${
                  addOns.includes(option.id)
                    ? "border-lav-700 bg-lav-600 text-white"
                    : "border-dashed border-lav-400 text-lav-700 hover:bg-lav-300"
                }`}
              >
                {addOns.includes(option.id) && <Sparkle size={12} />}
                {option.label}
                <span className="opacity-70">+{money(option.price)}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border-2 border-lav-400 bg-white">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="One fewer"
            className="px-4 py-2 font-hand text-xl text-lav-700"
          >
            −
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
          className="sticker flex-1 rounded-full bg-lav-600 px-6 py-3 font-marker text-base text-white transition hover:-rotate-1 hover:bg-lav-700"
        >
          Add to cart · {money(unitPrice * qty)}
        </button>
      </div>
    </div>
  );
}
