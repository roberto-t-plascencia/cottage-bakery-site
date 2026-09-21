"use client";

import { useState } from "react";
import { useCart } from "@/lib/CartContext";
import { formatCents } from "@/lib/cart";

export type ProductCardData = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  allergens: string;
  ingredients: string;
  netWeight: string;
  imageUrl?: string | null;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const { add } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  function handleAdd() {
    add(
      {
        productId: product.id,
        name: product.name,
        unitPriceCents: product.priceCents,
      },
      1
    );
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  const allergenList = product.allergens
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-black/10 p-6 dark:border-white/10">
      <div>
        {product.imageUrl && (
          // A plain <img>, not next/image: the image lives in a Supabase
          // Storage bucket whose hostname includes this project's ref
          // (SUPABASE_URL), which next/image's remotePatterns would need
          // configured at build time. For a handful of product photos on
          // a small menu, that's not worth the config surface — worth
          // revisiting (a wildcard `*.supabase.co` remote pattern) if
          // image-heavy pages make Next's optimization/lazy-loading
          // worth it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="mb-4 aspect-[4/3] w-full rounded-xl object-cover"
            loading="lazy"
          />
        )}
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-semibold">{product.name}</h3>
          <span className="whitespace-nowrap font-medium">
            {formatCents(product.priceCents)}
          </span>
        </div>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">
          {product.description}
        </p>
        {allergenList.length > 0 && (
          <p className="mt-3 text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
            Contains: {allergenList.join(", ")}
          </p>
        )}
        {product.ingredients && (
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            Ingredients: {product.ingredients}
          </p>
        )}
        {product.netWeight && (
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            Net Wt. {product.netWeight}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleAdd}
        className="mt-4 rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800"
      >
        {justAdded ? "Added ✓" : "Add to order"}
      </button>
    </div>
  );
}
