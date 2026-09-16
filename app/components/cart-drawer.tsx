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
        className={`absolute inset-0 bg-void/60 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-label="Your order"
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l-4 border-void bg-paper transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center border-b-4 border-void bg-void px-5 py-4 text-paper">
          <h2 className="poster text-xl">Your order</h2>
          <button
            type="button"
            onClick={close}
            tabIndex={isOpen ? 0 : -1}
            className="kicker ml-auto text-neon hover:text-paper"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {lines.length === 0 ? (
            <div className="grid place-items-center gap-4 py-24 text-center">
              <CatMark size={48} className="text-paper-dim" />
              <p className="poster text-xl text-grape">Nothing here yet</p>
              <Link
                href="/menu"
                onClick={close}
                tabIndex={isOpen ? 0 : -1}
                className="kicker bg-void px-6 py-3 text-paper hover:bg-violet"
              >
                See the menu
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col">
              {lines.map((line) => (
                <li key={line.id} className="hairline py-4 text-void first:border-t-0">
                  <div className="flex items-baseline gap-3">
                    <p className="poster text-lg">{line.name}</p>
                    <p className="poster ml-auto text-lg text-violet">
                      {money(line.unitPrice * line.qty)}
                    </p>
                  </div>
                  {line.options.length > 0 && (
                    <p className="mt-1 text-xs leading-relaxed text-grape">
                      {line.options.join(" / ")}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center border-2 border-void">
                      <button
                        type="button"
                        tabIndex={isOpen ? 0 : -1}
                        onClick={() => setQty(line.id, line.qty - 1)}
                        aria-label={`One fewer ${line.name}`}
                        className="px-3 py-1 hover:bg-void hover:text-paper"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center text-sm">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        tabIndex={isOpen ? 0 : -1}
                        onClick={() => setQty(line.id, line.qty + 1)}
                        aria-label={`One more ${line.name}`}
                        className="px-3 py-1 hover:bg-void hover:text-paper"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      tabIndex={isOpen ? 0 : -1}
                      onClick={() => remove(line.id)}
                      className="kicker ml-auto text-grape hover:text-violet"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t-4 border-void px-5 py-5">
          <div className="flex items-baseline">
            <span className="kicker text-grape">Subtotal</span>
            <span className="poster ml-auto text-3xl text-void">
              {money(subtotal)}
            </span>
          </div>
          <p className="mt-2 text-xs text-grape">
            Pickup only for now — tax added at checkout.
          </p>
          <button
            type="button"
            tabIndex={isOpen ? 0 : -1}
            disabled={lines.length === 0}
            className="kicker mt-4 w-full bg-void py-4 text-paper transition-colors hover:bg-violet disabled:opacity-30"
          >
            Checkout
          </button>
        </footer>
      </aside>
    </div>
  );
}
