import { notFound } from "next/navigation";
import { apiClient, ApiError } from "@/lib/apiClient";
import { formatCents, formatDateOnly } from "@/lib/cart";
import { bakeryConfig } from "@/lib/config";

export const metadata = { title: "Order received" };

export default async function OrderConfirmationPage({
  params,
}: PageProps<"/order/confirmation/[id]">) {
  const { id } = await params;

  let order;
  try {
    order = await apiClient.getOrder(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">
        Thanks, {order.customerName.split(" ")[0]}!
      </h1>
      <p className="mt-4 text-black/70 dark:text-white/70">
        Your order request has been received. {bakeryConfig.ownerName} will
        reach out at {order.customerEmail} or {order.customerPhone} to
        confirm details and arrange payment.
      </p>

      <div className="mt-8 rounded-2xl border border-black/10 p-6 dark:border-white/10">
        <p className="text-sm text-black/50 dark:text-white/50">
          Order #{order.id.slice(-8)}
        </p>
        <ul className="mt-4 divide-y divide-black/10 dark:divide-white/10">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between py-2 text-sm">
              <span>
                {item.quantity} × {item.product.name}
              </span>
              <span>{formatCents(item.unitPriceCents * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 border-t border-black/10 pt-4 text-sm dark:border-white/10">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCents(order.subtotalCents)}</span>
          </div>
          {order.fulfillmentMethod === "LOCAL_DELIVERY" && (
            <div className="flex justify-between">
              <span>Delivery</span>
              <span>
                {order.deliveryFeeCents === 0 ? "Free" : formatCents(order.deliveryFeeCents)}
              </span>
            </div>
          )}
        </div>
        <div className="mt-2 flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatCents(order.totalCents)}</span>
        </div>
        <dl className="mt-6 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-black/60 dark:text-white/60">Fulfillment</dt>
            <dd>{order.fulfillmentMethod.replace("_", " ")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-black/60 dark:text-white/60">Requested date</dt>
            <dd>{formatDateOnly(order.requestedDate)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-black/60 dark:text-white/60">Status</dt>
            <dd>{order.status}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
