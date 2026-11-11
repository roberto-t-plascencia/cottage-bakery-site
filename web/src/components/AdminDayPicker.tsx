"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { addDays, adminHref } from "@/lib/adminOrders";
import { formatDateOnly } from "@/lib/cart";

/**
 * Picks which day the catalog tab is planning. Navigation, not local
 * state: the chosen day lives in the URL (see adminHref), so the page
 * stays a Server Component that re-reads real remaining counts on every
 * change instead of holding a stale copy in the browser.
 */
export function AdminDayPicker({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function go(nextDate: string) {
    startTransition(() => router.push(adminHref({ tab: "catalog", date: nextDate })));
  }

  const step = (days: number) => () => go(addDays(date, days));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={step(-1)}
        disabled={isPending}
        aria-label="Previous day"
        className="rounded-full border border-black/20 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
      >
        ←
      </button>

      <label className="flex items-center gap-2">
        <span className="sr-only">Day to plan</span>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="rounded-lg border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent"
        />
      </label>

      <button
        type="button"
        onClick={step(1)}
        disabled={isPending}
        aria-label="Next day"
        className="rounded-full border border-black/20 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
      >
        →
      </button>

      <p className="text-sm text-black/60 dark:text-white/60">
        {date === today ? "Today" : formatDateOnly(date)}
      </p>

      {date !== today && (
        <button
          type="button"
          onClick={() => go(today)}
          disabled={isPending}
          className="text-sm font-medium text-amber-800 hover:underline disabled:opacity-40 dark:text-amber-400"
        >
          Back to today
        </button>
      )}
    </div>
  );
}
