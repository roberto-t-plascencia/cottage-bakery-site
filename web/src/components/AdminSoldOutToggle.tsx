"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type AdminMenuItem = {
  id: string;
  name: string;
  soldOutToday: boolean;
};

/**
 * One row of the admin "Today's menu" list: a switch that marks the item
 * sold out for today. It turns itself back on at midnight (bakery time),
 * and customers can still order it for tomorrow or later.
 */
export function AdminSoldOutToggle({ item }: { item: AdminMenuItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [soldOut, setSoldOut] = useState(item.soldOutToday);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !soldOut;
    setSoldOut(next);
    setError(null);

    const res = await fetch(`/api/admin/products/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldOutToday: next }),
    });

    if (!res.ok) {
      setSoldOut(!next);
      setError("Couldn't update — try again.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="font-medium">{item.name}</p>
        <p className={soldOut ? "text-sm text-red-700 dark:text-red-400" : "text-sm text-black/60 dark:text-white/60"}>
          {soldOut ? "Sold out today" : "Available today"}
        </p>
        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={soldOut}
        aria-label={`${item.name} sold out today`}
        onClick={toggle}
        disabled={isPending}
        className={
          soldOut
            ? "rounded-full border border-black/20 px-4 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
            : "rounded-full bg-red-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
        }
      >
        {soldOut ? "Back in stock" : "Mark sold out"}
      </button>
    </li>
  );
}
