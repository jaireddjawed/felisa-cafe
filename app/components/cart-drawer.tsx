"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/menu";
import { CatSign } from "./marks";

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
        className={`absolute inset-0 bg-night-950/70 backdrop-blur-sm transition-opacity duration-400 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-label="Your order"
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l border-glow-500/30 bg-night-900 transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
          <h2 className="overline">Your order</h2>
          <button
            type="button"
            onClick={close}
            tabIndex={isOpen ? 0 : -1}
            className="ml-auto text-sm text-haze transition-colors hover:text-glow-300"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {lines.length === 0 ? (
            <div className="grid place-items-center gap-4 py-24 text-center">
              <CatSign size={48} className="text-glow-600" />
              <p className="text-sm text-haze">Nothing poured yet.</p>
              <Link
                href="/menu"
                onClick={close}
                tabIndex={isOpen ? 0 : -1}
                className="rounded-full border border-glow-500/60 bg-glow-600/25 px-6 py-2.5 text-sm text-glow-300 hover:bg-glow-600/45"
              >
                Browse the menu
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {lines.map((line) => (
                <li key={line.id} className="panel px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <p className="font-display font-bold text-white">
                      {line.name}
                    </p>
                    <p className="ml-auto text-sm text-glow-300">
                      {money(line.unitPrice * line.qty)}
                    </p>
                  </div>
                  {line.options.length > 0 && (
                    <p className="mt-1.5 text-xs leading-relaxed text-haze">
                      {line.options.join(" · ")}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center rounded-full border border-white/15">
                      <button
                        type="button"
                        tabIndex={isOpen ? 0 : -1}
                        onClick={() => setQty(line.id, line.qty - 1)}
                        aria-label={`One fewer ${line.name}`}
                        className="px-3 py-1 text-haze hover:text-glow-300"
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
                        className="px-3 py-1 text-haze hover:text-glow-300"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      tabIndex={isOpen ? 0 : -1}
                      onClick={() => remove(line.id)}
                      className="ml-auto text-xs text-haze underline-offset-4 hover:text-glow-300 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-white/10 px-6 py-6">
          <div className="flex items-baseline">
            <span className="overline">Subtotal</span>
            <span className="neon ml-auto font-display text-2xl font-extrabold">
              {money(subtotal)}
            </span>
          </div>
          <p className="mt-2 text-xs text-haze">
            Pickup only for now — tax added at checkout.
          </p>
          <button
            type="button"
            tabIndex={isOpen ? 0 : -1}
            disabled={lines.length === 0}
            className="mt-5 w-full rounded-full border border-glow-400 bg-glow-600/40 py-3.5 text-sm font-medium text-white transition-all hover:bg-glow-600/70 hover:shadow-[0_0_34px_-6px_rgba(168,108,245,0.95)] disabled:opacity-30 disabled:shadow-none"
          >
            Checkout
          </button>
        </footer>
      </aside>
    </div>
  );
}
