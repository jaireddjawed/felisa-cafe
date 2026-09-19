"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { orderApi } from "@/lib/pocketbase";
import { useCart } from "@/lib/cart";
import type { CheckoutView } from "@/lib/api-types";
import { CatFace, Sparkle, SquiggleRule } from "./doodles";

const CART_TOKEN_KEY = "felisa-cart-token";
const ORDER_TOKEN_KEY = "felisa-order-token";

type Contact = {
  name: string;
  email: string;
};

type SquareCard = {
  attach(selector: string): Promise<void>;
  tokenize(): Promise<{ status: string; token?: string; errors?: { message?: string }[] }>;
};

declare global {
  interface Window {
    Square?: {
      payments(appId: string, locationId: string): {
        card(): Promise<SquareCard>;
      };
    };
  }
}

function money(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

function sdkURL(environment = "sandbox") {
  return environment === "production"
    ? "https://web.squarecdn.com/v1/square.js"
    : "https://sandbox.web.squarecdn.com/v1/square.js";
}

export function CheckoutClient({ contact }: { contact?: Contact }) {
  const router = useRouter();
  const { lines, subtotal } = useCart();
  const [name, setName] = useState(contact?.name ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [checkout, setCheckout] = useState<CheckoutView | null>(null);
  const [tipAmount, setTipAmount] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const cardRef = useRef<SquareCard | null>(null);

  const tipOptions = useMemo(() => {
    const base = checkout?.total.amount ?? subtotal.amount ?? 0;
    return [
      { label: "No tip", amount: 0 },
      { label: "15%", amount: Math.round(base * 0.15) },
      { label: "20%", amount: Math.round(base * 0.2) },
    ];
  }, [checkout, subtotal]);

  const totalWithTip =
    (checkout?.total.amount ?? subtotal.amount ?? 0) + tipAmount;

  async function startCheckout(): Promise<CheckoutView | null> {
    if (!name.trim() || !email.trim()) return null;
    setBusy(true);
    setMessage(null);
    try {
      const cartToken =
        window.localStorage.getItem(CART_TOKEN_KEY) ?? undefined;
      const result = await orderApi.checkout(
        { cartToken },
        { customerName: name.trim(), customerEmail: email.trim() },
        window.crypto.randomUUID(),
      );
      if (result.orderToken) {
        window.localStorage.setItem(ORDER_TOKEN_KEY, result.orderToken);
      }
      setCheckout(result);
      return result;
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not start checkout.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  // Auto-start checkout when contact details are present (logged in or guest entered)
  useEffect(() => {
    if (checkout || busy) return;
    if (name.trim() && email.trim() && email.includes("@")) {
      const id = window.setTimeout(() => {
        void startCheckout();
      }, 400);
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, name, email]);

  // Attach Square Card form when checkout and script are ready
  useEffect(() => {
    if (!scriptReady || !checkout || cardRef.current) return;
    if (!checkout.square.applicationId || !checkout.square.locationId) {
      const id = window.setTimeout(
        () => setMessage("Square Web Payments is not configured yet."),
        0,
      );
      return () => window.clearTimeout(id);
    }
    const current = checkout;
    let cancelled = false;
    async function attachCard() {
      try {
        const payments = window.Square?.payments(
          current.square.applicationId,
          current.square.locationId,
        );
        if (!payments) throw new Error("Square Web Payments did not load.");
        const card = await payments.card();
        if (cancelled) return;
        await card.attach("#square-card-container");
        cardRef.current = card;
        setCardReady(true);
      } catch (err) {
        setMessage(
          err instanceof Error ? err.message : "Could not load card form.",
        );
      }
    }
    void attachCard();
    return () => {
      cancelled = true;
    };
  }, [checkout, scriptReady]);

  async function handlePay() {
    if (!name.trim() || !email.trim()) {
      setMessage("Please fill in your name and email above.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      let activeCheckout = checkout;
      if (!activeCheckout) {
        activeCheckout = await startCheckout();
        if (!activeCheckout) {
          throw new Error("Could not initialize order. Please try again.");
        }
      }

      if (!cardRef.current) {
        throw new Error("Card form is loading. Please wait a moment.");
      }

      const token = await cardRef.current.tokenize();
      if (token.status !== "OK" || !token.token) {
        throw new Error(
          token.errors?.[0]?.message ?? "Card could not be tokenized.",
        );
      }

      const orderToken =
        window.localStorage.getItem(ORDER_TOKEN_KEY) ?? undefined;
      const order = await orderApi.pay(
        { orderToken },
        { orderId: activeCheckout.orderId, sourceId: token.token, tipAmount },
        window.crypto.randomUUID(),
      );
      router.push(`/orders/${order.id}`);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not complete payment.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (lines.length === 0 && !checkout) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Link
          href="/menu"
          className="font-hand text-xl text-lav-600 underline decoration-dashed hover:text-lav-800"
        >
          back to the menu
        </Link>
        <h1 className="mt-4 font-marker text-4xl text-lav-800 sm:text-5xl">
          Checkout
        </h1>
        <SquiggleRule className="my-5 h-5 w-full text-lav-400" />
        <div className="grid place-items-center gap-3 py-16 text-center">
          <Sparkle size={32} className="twinkle text-lav-400" />
          <p className="font-hand text-2xl text-lav-700">Your cart is empty.</p>
          <Link
            href="/menu"
            className="sticker mt-2 rounded-full bg-lav-600 px-6 py-2.5 font-hand text-xl text-white"
          >
            See the menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Script
        src={sdkURL(checkout?.square.environment)}
        onLoad={() => setScriptReady(true)}
      />

      <Link
        href="/menu"
        className="font-hand text-xl text-lav-600 underline decoration-dashed hover:text-lav-800"
      >
        back to the menu
      </Link>
      <h1 className="mt-4 font-marker text-4xl text-lav-800 sm:text-5xl">
        Checkout
      </h1>
      <SquiggleRule className="my-5 h-5 w-full text-lav-400" />

      {message && (
        <p
          className="sticker mb-6 rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 font-hand text-lg text-rose-800"
          role="alert"
        >
          {message}
        </p>
      )}

      <div className="grid gap-6">
        {/* 1. Full Order Breakdown Section */}
        <section className="sticker rounded-3xl bg-lav-100 p-6">
          <div className="flex items-center gap-2 border-b-2 border-dashed border-lav-300 pb-3">
            <CatFace size={24} className="text-lav-600" />
            <h2 className="font-marker text-2xl text-lav-800">Your order</h2>
          </div>

          {lines.length > 0 && (
            <ul className="mt-4 flex flex-col divide-y-2 divide-dashed divide-lav-200">
              {lines.map((line) => (
                <li key={line.lineId} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-marker text-lg text-lav-800">
                      <span className="mr-2 font-hand text-xl font-bold text-lav-700">
                        {line.quantity}×
                      </span>
                      {line.productName}
                    </p>
                    <p className="font-hand text-xl text-lav-700">
                      {line.total.formatted}
                    </p>
                  </div>
                  <p className="mt-0.5 font-hand text-base text-lav-600">
                    {[line.variationName, ...line.modifiers.map((m) => m.name)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {line.note && (
                    <p className="mt-0.5 font-hand text-sm italic text-lav-500">
                      Note: {line.note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 border-t-2 border-dashed border-lav-300 pt-4">
            <div className="flex font-hand text-xl text-lav-700">
              <span>Subtotal</span>
              <span className="ml-auto">
                {checkout ? checkout.subtotal.formatted : subtotal.formatted}
              </span>
            </div>
            <div className="mt-1 flex font-hand text-xl text-lav-700">
              <span>Tax</span>
              <span className="ml-auto">
                {checkout ? checkout.tax.formatted : "$0.00"}
              </span>
            </div>
            {tipAmount > 0 && (
              <div className="mt-1 flex font-hand text-xl text-lav-700">
                <span>Tip</span>
                <span className="ml-auto">
                  {money(
                    tipAmount,
                    checkout?.total.currency ?? subtotal.currency ?? "USD",
                  )}
                </span>
              </div>
            )}
            <div className="mt-3 flex items-baseline border-t-2 border-dashed border-lav-300 pt-3">
              <span className="font-hand text-2xl text-lav-700">Total</span>
              <span className="ml-auto font-marker text-3xl text-lav-800">
                {money(
                  totalWithTip,
                  checkout?.total.currency ?? subtotal.currency ?? "USD",
                )}
              </span>
            </div>
          </div>
        </section>

        {/* 2. Contact Details Section */}
        <section className="sticker rounded-3xl bg-lav-100 p-6">
          <div className="flex items-center justify-between border-b-2 border-dashed border-lav-300 pb-3">
            <h2 className="font-marker text-2xl text-lav-800">Contact details</h2>
            {contact && (
              <span className="rounded-full bg-lav-200 px-3 py-1 font-hand text-sm text-lav-700">
                Signed in
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 font-hand text-xl text-lav-700">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your name"
                className="rounded-full border-2 border-lav-300 bg-white px-4 py-2 font-hand text-lg text-lav-800 outline-none focus:border-lav-600"
              />
            </label>
            <label className="grid gap-1 font-hand text-xl text-lav-700">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@example.com"
                className="rounded-full border-2 border-lav-300 bg-white px-4 py-2 font-hand text-lg text-lav-800 outline-none focus:border-lav-600"
              />
            </label>
          </div>
        </section>

        {/* 3. Payment Details Section (Always its own separate section) */}
        <section className="sticker rounded-3xl bg-lav-100 p-6">
          <div className="flex items-center gap-2 border-b-2 border-dashed border-lav-300 pb-3">
            <h2 className="font-marker text-2xl text-lav-800">Payment details</h2>
          </div>

          <div className="mt-4 grid gap-5">
            {/* Tip Selection */}
            <div>
              <h3 className="font-marker text-xl text-lav-800">Add a tip</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {tipOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => {
                      setTipAmount(option.amount);
                      setCustomTip("");
                    }}
                    className={`rounded-full border-2 px-4 py-2 font-hand text-lg transition ${
                      tipAmount === option.amount && customTip === ""
                        ? "border-lav-700 bg-lav-600 text-white"
                        : "border-dashed border-lav-400 text-lav-700 hover:bg-lav-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                <input
                  inputMode="decimal"
                  value={customTip}
                  onChange={(e) => {
                    setCustomTip(e.target.value);
                    setTipAmount(
                      Math.max(
                        0,
                        Math.round(Number(e.target.value || 0) * 100),
                      ),
                    );
                  }}
                  placeholder="Custom"
                  className="w-28 rounded-full border-2 border-lav-300 bg-white px-4 py-2 font-hand text-lg text-lav-800 outline-none focus:border-lav-600"
                />
              </div>
            </div>

            {/* Card Information */}
            <div>
              <h3 className="mb-2 font-marker text-xl text-lav-800">Card information</h3>
              <div
                id="square-card-container"
                className="min-h-[90px] rounded-2xl bg-white p-3 border-2 border-lav-200"
              >
                {!checkout && (
                  <p className="py-6 text-center font-hand text-lg text-lav-500">
                    Enter your name and email above to load secure card input.
                  </p>
                )}
              </div>
            </div>

            {/* Pay Button */}
            <button
              type="button"
              onClick={handlePay}
              disabled={busy || (checkout ? !cardReady : !name.trim() || !email.trim())}
              className="sticker mt-2 w-full rounded-full bg-lav-600 py-3 font-marker text-lg text-white transition hover:bg-lav-700 disabled:opacity-40"
            >
              {busy
                ? "Processing..."
                : `Pay ${money(
                    totalWithTip,
                    checkout?.total.currency ?? subtotal.currency ?? "USD",
                  )}`}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
