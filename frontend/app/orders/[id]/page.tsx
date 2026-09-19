import type { Metadata } from "next";
import { OrderConfirmation } from "../../components/order-confirmation";

export const metadata: Metadata = {
  title: "Order confirmation",
};

export default async function OrderPage(props: PageProps<"/orders/[id]">) {
  const { id } = await props.params;
  return <OrderConfirmation orderId={id} />;
}
