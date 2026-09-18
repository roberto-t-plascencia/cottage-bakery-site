"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents, formatDateOnly } from "@/lib/cart";

type OrderStatus = "PENDING" | "CONFIRMED" | "READY" | "COMPLETED" | "CANCELLED";

export type AdminOrderRowData = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentMethod: string;
  fulfillmentAddress: string | null;
  requestedDate: string;
  notes: string | null;
  status: OrderStatus;
  subtotalCents: number;
  items: { name: string; quantity: number }[];
};

const STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

export function AdminOrderRow({ order }: { order: AdminOrderRowData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [error, setError] = useState<string | null>(null);

  async function handleStatusChange(next: OrderStatus) {
    setStatus(next);
    setError(null);

    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });

    if (!res.ok) {
      setStatus(order.status);
      setError("Couldn't update status — try again.");
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <tr className="border-b border-black/10 align-top dark:border-white/10">
      <td className="py-4 pr-4">
        <p className="font-medium">{order.customerName}</p>
        <p className="text-black/60 dark:text-white/60">{order.customerEmail}</p>
        <p className="text-black/60 dark:text-white/60">{order.customerPhone}</p>
      </td>
      <td className="py-4 pr-4">
        <ul>
          {order.items.map((item, i) => (
            <li key={i}>
              {item.quantity} × {item.name}
            </li>
          ))}
        </ul>
        <p className="mt-1 font-medium">{formatCents(order.subtotalCents)}</p>
      </td>
      <td className="py-4 pr-4">
        <p>{order.fulfillmentMethod.replace("_", " ")}</p>
        {order.fulfillmentAddress && (
          <p className="text-black/60 dark:text-white/60">
            {order.fulfillmentAddress}
          </p>
        )}
        <p className="text-black/60 dark:text-white/60">
          Ready: {formatDateOnly(order.requestedDate)}
        </p>
        {order.notes && <p className="mt-1 italic">&ldquo;{order.notes}&rdquo;</p>}
      </td>
      <td className="py-4">
        <select
          value={status}
          disabled={isPending}
          onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
          className="input"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      </td>
    </tr>
  );
}
