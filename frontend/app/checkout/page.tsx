import type { Metadata } from "next";
import { getAuthUser } from "@/lib/pocketbase-server";
import { CheckoutClient } from "../components/checkout-client";

export const metadata: Metadata = {
  title: "Checkout",
};

export default async function CheckoutPage() {
  const user = await getAuthUser();

  return (
    <CheckoutClient
      contact={
        user ? { name: user.name || user.email, email: user.email } : undefined
      }
    />
  );
}
