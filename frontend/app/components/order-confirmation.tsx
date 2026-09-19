"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { OrderView } from "@/lib/api-types";
import { orderApi } from "@/lib/pocketbase";
import { SquiggleRule } from "./doodles";

const ORDER_TOKEN_KEY = "felisa-order-token";

function readyTime(value?: string) {
  if (!value) return "We are calculating it now.";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function OrderConfirmation({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const orderToken = window.localStorage.getItem(ORDER_TOKEN_KEY) ?? undefined;
        setOrder(await orderApi.get(orderId, { orderToken }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load order.");
      }
    }
    void load();
  }, [orderId]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-marker text-4xl text-lav-800 sm:text-5xl">
        Order confirmed
      </h1>
      <SquiggleRule className="my-5 h-5 w-full text-lav-400" />

      {error && <p className="font-hand text-2xl text-lav-700">{error}</p>}
      {!order && !error && (
        <p className="font-hand text-2xl text-lav-700">Loading your order...</p>
      )}
      {order && (
        <div className="grid gap-5">
          <section className="sticker rounded-3xl bg-lav-100 p-6">
            <p className="font-hand text-2xl text-lav-700">
              Estimated ready time
            </p>
            <p className="mt-2 font-marker text-4xl text-lav-800">
              {readyTime(order.estimatedReadyAt)}
            </p>
            <p className="mt-3 font-hand text-xl text-lav-600">
              We will have it ready for pickup at Felisa.
            </p>
          </section>

          <section className="sticker rounded-3xl bg-white/80 p-6">
            <div className="flex items-baseline">
              <span className="font-hand text-xl text-lav-700">Total</span>
              <span className="ml-auto font-marker text-2xl text-lav-800">
                {order.total.formatted}
              </span>
            </div>
            <ul className="mt-4 grid gap-3">
              {order.items.map((item, index) => (
                <li key={`${item.productName}-${index}`} className="font-hand text-xl text-lav-700">
                  {item.quantity} x {item.productName}
                </li>
              ))}
            </ul>
          </section>

          <Link
            href="/menu"
            className="sticker rounded-full bg-lav-600 px-6 py-3 text-center font-marker text-lg text-white transition hover:bg-lav-700"
          >
            Back to menu
          </Link>
        </div>
      )}
    </div>
  );
}
