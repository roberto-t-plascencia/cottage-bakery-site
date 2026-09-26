"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resizeForUpload } from "@/lib/resizeImage";

/**
 * A menu item's photo in the admin list, with buttons to add, change or
 * remove it. Photos are shrunk in the browser first (lib/resizeImage.ts),
 * so a picture straight off a phone uploads in a second or two.
 */
export function AdminProductPhoto({
  productId,
  productName,
  imageUrl,
}: {
  productId: string;
  productName: string;
  imageUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const photo = await resizeForUpload(file);
      const res = await fetch(`/api/admin/products/${productId}/image`, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: photo,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.errors?.[0] ?? "Upload failed.");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/products/${productId}/image`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Couldn't remove the photo — try again.");
      return;
    }
    startTransition(() => router.refresh());
  }

  const working = busy || isPending;

  return (
    <div className="flex w-28 shrink-0 flex-col items-center gap-1">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={productName}
          className="aspect-[4/3] w-28 rounded-lg object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] w-28 items-center justify-center rounded-lg border border-dashed border-black/20 text-xs text-black/40 dark:border-white/20 dark:text-white/40">
          No photo
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={`Photo for ${productName}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={working}
          className="font-medium text-amber-800 hover:underline disabled:opacity-50 dark:text-amber-400"
        >
          {working ? "Saving…" : imageUrl ? "Change" : "Add photo"}
        </button>
        {imageUrl && !working && (
          <button
            type="button"
            onClick={remove}
            className="text-black/50 hover:underline dark:text-white/50"
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="text-center text-xs text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
