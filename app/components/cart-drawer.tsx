"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/menu";
import { CatSticker, Star } from "./marks";

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
        className={`absolute inset-0 bg-grape-900/45 transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-label="Your order"
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l-4 border-grape-900 bg-lilac-100 transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center gap-3 border-b-4 border-grape-900 bg-butter px-4 py-3">
          <CatSticker size={32} className="text-grape-900" />
          <h2 className="font-bubble text-2xl text-grape-900">your order</h2>
          <button
            type="button"
            onClick={close}
            tabIndex={isOpen ? 0 : -1}
            className="pop-sm pop-press ml-auto bg-white px-3 py-1 font-bubble text-base text-grape-900"
          >
            close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {lines.length === 0 ? (
            <div className="grid place-items-center gap-3 py-20 text-center">
              <Star size={30} className="wiggle text-bubblegum" />
              <p className="font-bubble text-xl text-grape-600">
                nothing in here yet!
              </p>
              <Link
                href="/menu"
                onClick={close}
                tabIndex={isOpen ? 0 : -1}
                className="pop-sm pop-press bg-mint px-5 py-2 font-bubble text-lg text-grape-900"
              >
                see the menu
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {lines.map((line) => (
                <li key={line.id} className="pop bg-white px-4 py-3">
                  <div className="flex items-baseline gap-2">
                    <p className="font-bubble text-lg text-grape-900">
                      {line.name}
                    </p>
                    <p className="ml-auto font-bubble text-lg text-grape-600">
                      {money(line.unitPrice * line.qty)}
                    </p>
                  </div>
                  {line.options.length > 0 && (
                    <p className="font-note mt-1 text-xl leading-snug text-grape-600">
                      {line.options.join(" + ")}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center rounded-full border-3 border-grape-900 bg-lilac-100">
                      <button
                        type="button"
                        tabIndex={isOpen ? 0 : -1}
                        onClick={() => setQty(line.id, line.qty - 1)}
                        aria-label={`One fewer ${line.name}`}
                        className="px-3 font-bubble text-lg text-grape-900"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center font-bubble">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        tabIndex={isOpen ? 0 : -1}
                        onClick={() => setQty(line.id, line.qty + 1)}
                        aria-label={`One more ${line.name}`}
                        className="px-3 font-bubble text-lg text-grape-900"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      tabIndex={isOpen ? 0 : -1}
                      onClick={() => remove(line.id)}
                      className="font-note ml-auto text-xl text-grape-500 hover:text-bubblegum"
                    >
                      remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t-4 border-grape-900 bg-lilac-200 px-4 py-4">
          <div className="flex items-baseline">
            <span className="font-bubble text-lg text-grape-600">subtotal</span>
            <span className="font-bubble ml-auto text-3xl text-grape-900">
              {money(subtotal)}
            </span>
          </div>
          <p className="font-note mt-1 text-xl text-grape-600">
            pickup only for now — tax added at checkout
          </p>
          <button
            type="button"
            tabIndex={isOpen ? 0 : -1}
            disabled={lines.length === 0}
            className="pop pop-press mt-3 w-full bg-bubblegum py-3 font-bubble text-xl text-white disabled:opacity-40"
          >
            checkout
          </button>
        </footer>
      </aside>
    </div>
  );
}
