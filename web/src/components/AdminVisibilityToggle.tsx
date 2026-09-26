"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Shows or hides an item on the public menu. Hidden items stay in the
 * admin list (with their photo and label details) and can't be ordered.
 */
export function AdminVisibilityToggle({
  productId,
  productName,
  isActive,
}: {
  productId: string;
  productName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Couldn't update — try again.");
      return;
    }
    startTransition(() => router.refresh());
  }

  const working = busy || isPending;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={working}
        aria-label={isActive ? `Hide ${productName} from the menu` : `Show ${productName} on the menu`}
        className={
          isActive
            ? "text-xs font-medium text-black/50 hover:underline disabled:opacity-50 dark:text-white/50"
            : "rounded-full bg-amber-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
        }
      >
        {working ? "Saving…" : isActive ? "Hide from menu" : "Show on menu"}
      </button>
      {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
