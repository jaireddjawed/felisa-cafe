"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { orderApi } from "@/lib/pocketbase";
import type { CheckoutView } from "@/lib/api-types";
import { SquiggleRule } from "./doodles";

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

function sdkURL(environment: string) {
  return environment === "production"
    ? "https://web.squarecdn.com/v1/square.js"
    : "https://sandbox.web.squarecdn.com/v1/square.js";
}

export function CheckoutClient({ contact }: { contact?: Contact }) {
  const router = useRouter();
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
    const base = checkout?.total.amount ?? 0;
    return [
      { label: "No tip", amount: 0 },
      { label: "15%", amount: Math.round(base * 0.15) },
      { label: "20%", amount: Math.round(base * 0.2) },
    ];
  }, [checkout]);

  const totalWithTip = (checkout?.total.amount ?? 0) + tipAmount;

  async function startCheckout() {
    setBusy(true);
    setMessage(null);
    try {
      const cartToken = window.localStorage.getItem(CART_TOKEN_KEY) ?? undefined;
      const result = await orderApi.checkout(
        { cartToken },
        { customerName: name, customerEmail: email },
        window.crypto.randomUUID(),
      );
      if (result.orderToken) {
        window.localStorage.setItem(ORDER_TOKEN_KEY, result.orderToken);
      }
      setCheckout(result);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  async function start(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await startCheckout();
  }

  useEffect(() => {
    if (!contact || checkout || busy) return;
    const id = window.setTimeout(() => void startCheckout(), 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact]);

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
        setMessage(err instanceof Error ? err.message : "Could not load card form.");
      }
    }
    void attachCard();
    return () => {
      cancelled = true;
    };
  }, [checkout, scriptReady]);

  async function pay() {
    if (!checkout || !cardRef.current) return;
    setBusy(true);
    setMessage(null);
    try {
      const token = await cardRef.current.tokenize();
      if (token.status !== "OK" || !token.token) {
        throw new Error(token.errors?.[0]?.message ?? "Card could not be tokenized.");
      }
      const orderToken = window.localStorage.getItem(ORDER_TOKEN_KEY) ?? undefined;
      const order = await orderApi.pay(
        { orderToken },
        { orderId: checkout.orderId, sourceId: token.token, tipAmount },
        window.crypto.randomUUID(),
      );
      router.push(`/orders/${order.id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not complete payment.");
    } finally {
      setBusy(false);
    }
  }

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

      {!checkout && (
        <form onSubmit={start} className="sticker grid gap-4 rounded-3xl bg-lav-100 p-6">
          {!contact && (
            <>
              <label className="grid gap-1 font-hand text-xl text-lav-700">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
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
                  className="rounded-full border-2 border-lav-300 bg-white px-4 py-2 font-hand text-lg text-lav-800 outline-none focus:border-lav-600"
                />
              </label>
            </>
          )}
          <button
            type="submit"
            disabled={busy}
            className="sticker rounded-full bg-lav-600 py-3 font-marker text-lg text-white transition hover:bg-lav-700 disabled:opacity-40"
          >
            {busy ? "Starting..." : contact ? "Continue to payment" : "Continue"}
          </button>
        </form>
      )}

      {checkout && (
        <div className="grid gap-5">
          <Script src={sdkURL(checkout.square.environment)} onLoad={() => setScriptReady(true)} />

          <section className="sticker rounded-3xl bg-lav-100 p-6">
            <div className="flex font-hand text-xl text-lav-700">
              <span>Subtotal</span>
              <span className="ml-auto">{checkout.subtotal.formatted}</span>
            </div>
            <div className="mt-1 flex font-hand text-xl text-lav-700">
              <span>Tax</span>
              <span className="ml-auto">{checkout.tax.formatted}</span>
            </div>
            {tipAmount > 0 && (
              <div className="mt-1 flex font-hand text-xl text-lav-700">
                <span>Tip</span>
                <span className="ml-auto">{money(tipAmount, checkout.total.currency)}</span>
              </div>
            )}
            <div className="mt-3 flex items-baseline border-t-2 border-dashed border-lav-300 pt-3">
              <span className="font-hand text-2xl text-lav-700">Total</span>
              <span className="ml-auto font-marker text-3xl text-lav-800">
                {money(totalWithTip, checkout.total.currency)}
              </span>
            </div>
          </section>

          {checkout.allowTipping && (
            <section className="sticker rounded-3xl bg-lav-100 p-6">
              <h2 className="font-marker text-xl text-lav-800">Add a tip</h2>
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
                    setTipAmount(Math.max(0, Math.round(Number(e.target.value || 0) * 100)));
                  }}
                  placeholder="Custom"
                  className="w-28 rounded-full border-2 border-lav-300 bg-white px-4 py-2 font-hand text-lg text-lav-800 outline-none focus:border-lav-600"
                />
              </div>
            </section>
          )}

          <section className="sticker rounded-3xl bg-lav-100 p-6">
            <div id="square-card-container" className="rounded-2xl bg-white p-3" />
            <button
              type="button"
              onClick={pay}
              disabled={busy || !cardReady}
              className="sticker mt-4 w-full rounded-full bg-lav-600 py-3 font-marker text-lg text-white transition hover:bg-lav-700 disabled:opacity-40"
            >
              {busy ? "Paying..." : `Pay ${money(totalWithTip, checkout.total.currency)}`}
            </button>
          </section>
        </div>
      )}

      {message && (
        <p className="mt-4 font-hand text-xl text-lav-800" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
