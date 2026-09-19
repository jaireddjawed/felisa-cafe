import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient, getAuthUser } from "@/lib/pocketbase-server";
import type { OrderView } from "@/lib/api-types";
import { CatFace, Sparkle, SquiggleRule } from "../components/doodles";

export const metadata: Metadata = {
  title: "Order History",
};

const PB_URL =
  process.env.PB_URL ?? process.env.NEXT_PUBLIC_PB_URL ?? "http://127.0.0.1:8090";

async function getOrderHistory(token: string): Promise<OrderView[]> {
  try {
    const res = await fetch(`${PB_URL}/api/orders`, {
      headers: {
        Authorization: token,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return [];
    }
    return (await res.json()) as OrderView[];
  } catch {
    return [];
  }
}

function formatDate(dateStr: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "ready":
      return {
        label: "Ready for pickup",
        className: "bg-emerald-100 text-emerald-800 border-emerald-300",
      };
    case "preparing":
      return {
        label: "Preparing",
        className: "bg-amber-100 text-amber-800 border-amber-300",
      };
    case "paid":
      return {
        label: "Confirmed",
        className: "bg-lav-200 text-lav-800 border-lav-400",
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-gray-100 text-gray-700 border-gray-300",
      };
    case "canceled":
      return {
        label: "Canceled",
        className: "bg-rose-100 text-rose-800 border-rose-300",
      };
    default:
      return {
        label: status,
        className: "bg-lav-100 text-lav-700 border-lav-300",
      };
  }
}

export default async function OrdersPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }

  const pb = await createServerClient();
  const orders = await getOrderHistory(pb.authStore.token);

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <div className="flex items-center gap-3">
        <CatFace size={40} className="text-lav-600" />
        <h1 className="font-marker text-4xl text-lav-800 sm:text-5xl">
          Order history
        </h1>
      </div>
      <p className="mt-2 font-hand text-2xl text-lav-600">
        All your past sips and treats from Felisa Cafe.
      </p>

      <SquiggleRule className="my-6 h-5 w-full text-lav-400" />

      {orders.length === 0 ? (
        <div className="grid place-items-center gap-4 py-16 text-center">
          <Sparkle size={36} className="twinkle text-lav-400" />
          <p className="font-hand text-3xl text-lav-800">
            No orders placed yet!
          </p>
          <p className="max-w-md font-hand text-xl text-lav-600">
            Your fresh coffee and housemade pastries will show up right here once you order.
          </p>
          <Link
            href="/menu"
            className="sticker mt-2 rounded-full bg-lav-600 px-6 py-3 font-marker text-lg text-white transition hover:bg-lav-700"
          >
            Explore the menu
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {orders.map((order) => {
            const badge = statusBadge(order.status);
            return (
              <div
                key={order.id}
                className="sticker rounded-3xl bg-white/90 p-6 transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed border-lav-200 pb-4">
                  <div>
                    <span className="font-marker text-xl text-lav-800">
                      Order #{order.id.slice(-6).toUpperCase()}
                    </span>
                    <p className="font-hand text-lg text-lav-600">
                      {formatDate(order.created)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 font-hand text-base font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <Link
                      href={`/orders/${order.id}`}
                      className="rounded-full bg-lav-100 px-4 py-1.5 font-hand text-lg text-lav-800 hover:bg-lav-200"
                    >
                      View details
                    </Link>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {order.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-baseline justify-between gap-4 font-hand text-lg"
                    >
                      <div>
                        <span className="font-semibold text-lav-800">
                          {item.quantity}× {item.productName}
                        </span>
                        {item.variationName && (
                          <span className="text-lav-600"> ({item.variationName})</span>
                        )}
                        {item.modifiers.length > 0 && (
                          <p className="text-sm text-lav-500">
                            + {item.modifiers.map((m) => m.name).join(", ")}
                          </p>
                        )}
                      </div>
                      <span className="font-marker text-lav-700">
                        {item.total.formatted}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t-2 border-dashed border-lav-200 pt-4">
                  <span className="font-hand text-xl text-lav-700">Total</span>
                  <span className="font-marker text-2xl text-lav-800">
                    {order.total.formatted}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
