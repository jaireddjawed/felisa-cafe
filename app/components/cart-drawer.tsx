"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/menu";
import { Sprig } from "./marks";

export function CartDrawer() {
  const { lines, subtotal, isOpen, close, setQty, remove } = useCart();

  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        tabIndex={isOpen ? 0 : -1}
        onClick={close}
        aria-label="Close cart"
        className={`absolute inset-0 bg-plum-800/25 transition-opacity duration-500 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-label="Your order"
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l border-paper-300 bg-paper-50 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center border-b border-paper-200 px-6 py-5">
          <h2 className="label-fine">Your order</h2>
          <button
            type="button"
            onClick={close}
            tabIndex={isOpen ? 0 : -1}
            className="ml-auto text-sm text-quiet transition-colors hover:text-plum-600"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {lines.length === 0 ? (
            <div className="grid place-items-center gap-4 py-24 text-center">
              <Sprig size={30} className="sway text-sage" />
              <p className="text-sm text-quiet">Your basket is empty.</p>
              <Link
                href="/menu"
                onClick={close}
                tabIndex={isOpen ? 0 : -1}
                className="rounded-sm border border-plum-500 px-6 py-2.5 text-sm text-plum-600 hover:bg-plum-600 hover:text-paper-50"
              >
                Browse the menu
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-paper-200">
              {lines.map((line) => (
                <li key={line.id} className="flex gap-4 py-5 first:pt-0">
                  <div className="flex-1">
                    <p className="font-display text-lg text-plum-800">
                      {line.name}
                    </p>
                    {line.options.length > 0 && (
                      <p className="mt-1 text-xs leading-relaxed text-quiet">
                        {line.options.join(" · ")}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-4">
                      <div className="flex items-center border border-paper-300">
                        <button
                          type="button"
                          tabIndex={isOpen ? 0 : -1}
                          onClick={() => setQty(line.id, line.qty - 1)}
                          aria-label={`One fewer ${line.name}`}
                          className="px-3 py-1 text-quiet hover:text-plum-600"
                        >
                          −
                        </button>
                        <span className="min-w-5 text-center text-sm">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          tabIndex={isOpen ? 0 : -1}
                          onClick={() => setQty(line.id, line.qty + 1)}
                          aria-label={`One more ${line.name}`}
                          className="px-3 py-1 text-quiet hover:text-plum-600"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        tabIndex={isOpen ? 0 : -1}
                        onClick={() => remove(line.id)}
                        className="text-xs text-quiet underline-offset-4 hover:text-plum-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-plum-800">
                    {money(line.unitPrice * line.qty)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-paper-200 px-6 py-6">
          <div className="flex items-baseline">
            <span className="label-fine">Subtotal</span>
            <span className="font-display ml-auto text-2xl text-plum-800">
              {money(subtotal)}
            </span>
          </div>
          <p className="mt-2 text-xs text-quiet">
            Pickup only for now — tax added at checkout.
          </p>
          <button
            type="button"
            tabIndex={isOpen ? 0 : -1}
            disabled={lines.length === 0}
            className="mt-5 w-full rounded-sm bg-plum-600 py-3.5 text-sm text-paper-50 transition-colors hover:bg-plum-800 disabled:opacity-35"
          >
            Checkout
          </button>
        </footer>
      </aside>
    </div>
  );
}
