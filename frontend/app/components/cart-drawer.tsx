"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { CatFace, Sparkle } from "./doodles";

export function CartDrawer() {
  const {
    lines,
    subtotal,
    isOpen,
    loading,
    error,
    valid,
    close,
    setQty,
    remove,
  } = useCart();

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
        className={`absolute inset-0 bg-lav-900/40 transition-opacity ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-label="Your order"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l-4 border-dashed border-lav-400 bg-lav-100 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center gap-3 border-b-4 border-dashed border-lav-300 px-5 py-4">
          <CatFace size={34} className="text-lav-600" />
          <h2 className="font-marker text-2xl text-lav-800">Your order</h2>
          <button
            type="button"
            onClick={close}
            tabIndex={isOpen ? 0 : -1}
            className="ml-auto rounded-full px-3 py-1 font-hand text-xl text-lav-700 hover:bg-lav-300"
          >
            close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {lines.length === 0 ? (
            <div className="grid place-items-center gap-3 py-20 text-center">
              <Sparkle size={28} className="twinkle text-lav-400" />
              <p className="font-hand text-2xl text-lav-700">
                Nothing in here yet.
              </p>
              <Link
                href="/menu"
                onClick={close}
                tabIndex={isOpen ? 0 : -1}
                className="sticker rounded-full bg-lav-600 px-5 py-2 font-hand text-xl text-white"
              >
                See the menu
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {lines.map((line) => (
                <li
                  key={line.lineId}
                  className="sticker rounded-2xl bg-white/80 px-4 py-3"
                >
                  <div className="flex items-baseline gap-2">
                    <p className="font-marker text-lg text-lav-800">
                      {line.productName}
                    </p>
                    <p className="ml-auto font-hand text-xl text-lav-700">
                      {line.total.formatted}
                    </p>
                  </div>
                  <p className="mt-1 font-hand text-lg text-lav-600">
                    {[line.variationName, ...line.modifiers.map((m) => m.name)]
                      .filter(Boolean)
                      .join(" - ")}
                  </p>
                  {line.problem && (
                    <p className="mt-1 font-hand text-base text-lav-800">
                      {line.problem}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center rounded-full border-2 border-lav-400">
                      <button
                        type="button"
                        tabIndex={isOpen ? 0 : -1}
                        onClick={() => void setQty(line.lineId, line.quantity - 1)}
                        aria-label={`One fewer ${line.productName}`}
                        className="px-3 py-0.5 font-hand text-xl text-lav-700"
                      >
                        -
                      </button>
                      <span className="min-w-6 text-center font-hand text-xl">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        tabIndex={isOpen ? 0 : -1}
                        onClick={() => void setQty(line.lineId, line.quantity + 1)}
                        aria-label={`One more ${line.productName}`}
                        className="px-3 py-0.5 font-hand text-xl text-lav-700"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      tabIndex={isOpen ? 0 : -1}
                      onClick={() => void remove(line.lineId)}
                      className="ml-auto font-hand text-lg text-lav-500 underline decoration-dashed hover:text-lav-800"
                    >
                      remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t-4 border-dashed border-lav-300 px-5 py-4">
          <div className="flex items-baseline">
            <span className="font-hand text-xl text-lav-700">Subtotal</span>
            <span className="ml-auto font-marker text-2xl text-lav-800">
              {subtotal.formatted}
            </span>
          </div>
          <p className="mt-1 font-hand text-lg text-lav-600">
            Pickup only for now - tax added at checkout.
          </p>
          {error && (
            <p className="mt-2 font-hand text-lg text-lav-800" role="alert">
              {error}
            </p>
          )}
          {lines.length > 0 && (
            <Link
              href="/checkout"
              onClick={close}
              tabIndex={isOpen ? 0 : -1}
              className={`sticker mt-3 block w-full rounded-full bg-lav-600 py-3 text-center font-marker text-lg text-white transition hover:bg-lav-700 ${
                loading || !valid ? "pointer-events-none opacity-40" : ""
              }`}
            >
              Checkout
            </Link>
          )}
          {lines.length === 0 && (
            <button
              type="button"
                tabIndex={isOpen ? 0 : -1}
              disabled
              className="sticker mt-3 w-full rounded-full bg-lav-600 py-3 font-marker text-lg text-white opacity-40"
            >
              Checkout
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}
