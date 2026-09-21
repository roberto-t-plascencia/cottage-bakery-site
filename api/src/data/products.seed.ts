/**
 * Mission Valley Home Bakers' actual menu. Ingredients/allergens/net
 * weight here match the product labels required by California's Cottage
 * Food Program (see docs/adr/0002-order-fulfillment-model.md and
 * api/supabase/migrations/0002_add_product_label_fields.sql) — this is
 * real label content, not filler, so keep it in sync with what's
 * actually printed on the product if either changes.
 *
 * Prices are in cents to avoid floating-point rounding bugs in totals
 * (classic "why is my subtotal $19.999999999998" class of bug, avoided
 * by never storing money as a float).
 */
export const productSeed = [
  {
    slug: "artisan-sourdough-baguette",
    name: "Artisan Sourdough Baguette",
    description:
      "Naturally leavened with our own masa madre starter — no commercial yeast, 24-hour cold ferment.",
    priceCents: 599,
    category: "Bread",
    allergens: "wheat",
    ingredients:
      "Enriched Wheat Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sea Salt, Yeast.",
    netWeight: "8 oz (226 g)",
    isActive: true,
  },
  {
    slug: "pan-de-masa-madre",
    name: "Pan de Masa Madre",
    description:
      "Traditional sourdough loaf, same natural masa madre starter as our baguette, in a classic round shape.",
    priceCents: 599,
    category: "Bread",
    allergens: "wheat",
    ingredients:
      "Enriched Wheat Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sea Salt, Yeast.",
    netWeight: "8 oz (226 g)",
    isActive: true,
  },
  {
    slug: "garlic-herb-focaccia",
    name: "Garlic & Herb Focaccia",
    description:
      "Olive oil focaccia topped with fresh garlic and rosemary, baked in a home kitchen to order.",
    priceCents: 599,
    category: "Bread",
    allergens: "wheat",
    ingredients:
      "Enriched Wheat Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Extra Virgin Olive Oil, Fresh Garlic, Sea Salt, Fresh Rosemary, Yeast.",
    netWeight: "12 oz (340 g)",
    isActive: true,
  },
] as const;
