"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type AdminInventoryItem = {
  productId: string;
  name: string;
  /** The date this row is for, "YYYY-MM-DD". */
  date: string;
  /** null = no limit set for that date. */
  startQuantity: number | null;
  ordered: number;
  /** null when startQuantity is null. */
  remaining: number | null;
};

/**
 * One product's starting quantity for one day. Empty input means "no
 * limit" — the same distinction api/ draws between a null startQuantity
 * (unlimited) and 0 (sold out), surfaced here as "leave it blank" vs
 * "type 0", with the helper text saying so rather than leaving the baker
 * to infer it.
 *
 * The input is left uncontrolled-ish on purpose: it holds whatever's
 * typed, and only a submit sends it. A number input that saved on every
 * keystroke would fire a request for "1" on the way to "10".
 */
export function AdminInventoryRow({ item }: { item: AdminInventoryItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(
    item.startQuantity === null ? "" : String(item.startQuantity)
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = value !== (item.startQuantity === null ? "" : String(item.startQuantity));

  async function save(startQuantity: number | null) {
    setError(null);
    setSaving(true);

    const res = await fetch(`/api/admin/products/${item.productId}/inventory`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: item.date, startQuantity }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ errors: [] }));
      setError(body.errors?.[0] ?? "Couldn't save — try again.");
      return;
    }
    // The server re-reads remaining counts, which depend on live orders
    // and so can't be computed here.
    startTransition(() => router.refresh());
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed === "") {
      save(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError("Enter a whole number, or leave it blank for no limit.");
      return;
    }
    save(parsed);
  }

  const busy = saving || isPending;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-40 flex-1">
        <p className="font-medium">{item.name}</p>
        <p className="text-sm text-black/60 dark:text-white/60">
          {item.startQuantity === null ? (
            <>No limit · {item.ordered} ordered</>
          ) : (
            <>
              {item.ordered} ordered ·{" "}
              <span
                className={
                  item.remaining === 0
                    ? "font-medium text-red-700 dark:text-red-400"
                    : undefined
                }
              >
                {item.remaining} left
              </span>
            </>
          )}
        </p>
        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-black/60 dark:text-white/60">Start with</span>
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="—"
            aria-label={`${item.name} starting quantity`}
            className="w-20 rounded-lg border border-black/20 px-2 py-1 text-right dark:border-white/20 dark:bg-transparent"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !dirty}
          className="rounded-full bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {item.startQuantity !== null && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              save(null);
            }}
            disabled={busy}
            aria-label={`Remove the limit on ${item.name}`}
            className="rounded-full border border-black/20 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
          >
            No limit
          </button>
        )}
      </form>
    </li>
  );
}
