"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/menu";
import { CatMark } from "./marks";

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
        className={`absolute inset-0 bg-plum-900/25 backdrop-blur-[2px] transition-opacity duration-500 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-label="Your order"
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col bg-mist-50 shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center border-b border-mist-200 px-6 py-5">
          <h2 className="eyebrow">Your order</h2>
          <button
            type="button"
            onClick={close}
            tabIndex={isOpen ? 0 : -1}
            className="ml-auto text-sm text-muted transition-colors hover:text-plum-900"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {lines.length === 0 ? (
            <div className="grid place-items-center gap-4 py-24 text-center">
              <CatMark size={44} className="text-mist-400" />
              <p className="text-sm text-muted">Your cart is empty.</p>
              <Link
                href="/menu"
                onClick={close}
                tabIndex={isOpen ? 0 : -1}
                className="rounded-full bg-plum-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-plum-700"
              >
                Browse the menu
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-mist-200">
              {lines.map((line) => (
                <li key={line.id} className="flex gap-4 py-5 first:pt-0">
                  <div className="flex-1">
                    <p className="font-medium text-plum-900">{line.name}</p>
                    {line.options.length > 0 && (
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        {line.options.join(" · ")}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-4">
                      <div className="flex items-center rounded-full border border-mist-300">
                        <button
                          type="button"
                          tabIndex={isOpen ? 0 : -1}
                          onClick={() => setQty(line.id, line.qty - 1)}
                          aria-label={`One fewer ${line.name}`}
                          className="px-3 py-1 text-muted hover:text-plum-900"
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
                          className="px-3 py-1 text-muted hover:text-plum-900"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        tabIndex={isOpen ? 0 : -1}
                        onClick={() => remove(line.id)}
                        className="text-xs text-muted underline-offset-4 hover:text-plum-700 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-plum-900">
                    {money(line.unitPrice * line.qty)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-mist-200 px-6 py-6">
          <div className="flex items-baseline">
            <span className="text-sm text-muted">Subtotal</span>
            <span className="ml-auto text-xl font-light text-plum-900">
              {money(subtotal)}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Pickup only for now — tax added at checkout.
          </p>
          <button
            type="button"
            tabIndex={isOpen ? 0 : -1}
            disabled={lines.length === 0}
            className="mt-5 w-full rounded-full bg-plum-600 py-3.5 text-sm font-medium text-white transition-colors hover:bg-plum-700 disabled:opacity-35"
          >
            Checkout
          </button>
        </footer>
      </aside>
    </div>
  );
}
