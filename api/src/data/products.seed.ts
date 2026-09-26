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
  {
    slug: "palermo-pizza",
    name: "Palermo Pizza",
    description:
      "12-inch Sicilian-style pan pizza, cut into 6 pieces: a thick, airy crust topped with tomato, slow-cooked onions, oregano and toasted breadcrumbs. Our cheese-free take on Palermo's sfincione.",
    priceCents: 1199,
    category: "Savory",
    allergens: "wheat",
    ingredients:
      "Enriched Wheat Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Tomatoes, Onions, Extra Virgin Olive Oil, Breadcrumbs (Enriched Wheat Flour, Yeast, Salt), Sea Salt, Oregano, Yeast.",
    netWeight: "36 oz (2 lb 4 oz) 1.02 kg",
    // Hidden until San Diego County confirms a baked tomato topping is
    // allowed for a cottage food operation.
    isActive: false,
  },
  {
    slug: "tomato-basil-flatbread",
    name: "Tomato Basil Flatbread",
    description:
      "Crisp-edged flatbread topped with tomato, fresh basil, garlic and olive oil. No cheese.",
    priceCents: 799,
    category: "Savory",
    allergens: "wheat",
    ingredients:
      "Enriched Wheat Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Tomatoes, Extra Virgin Olive Oil, Fresh Basil, Fresh Garlic, Sea Salt, Yeast.",
    netWeight: "24 oz (1 lb 8 oz) 680 g",
    // Hidden until San Diego County confirms a baked tomato topping is
    // allowed for a cottage food operation.
    isActive: false,
  },
  {
    slug: "swedish-cinnamon-bunz",
    name: "Swedish Cinnamon Bunz",
    description:
      "One big, cardamom-scented Swedish cinnamon bun, finished with a simple sugar glaze.",
    priceCents: 599,
    category: "Sweet",
    allergens: "wheat, milk, eggs",
    ingredients:
      "Enriched Wheat Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Whole Milk, Butter, Sugar, Eggs, Cinnamon, Cardamom, Yeast, Salt. Glaze: Powdered Sugar (Sugar, Corn Starch), Water.",
    netWeight: "12 oz (340 g)",
    isActive: true,
  },
  {
    slug: "prague-trdelnik",
    name: "Prague Trdelník",
    description:
      "Czech chimney cake: sweet dough wrapped around a spit, baked until golden and rolled in cinnamon sugar.",
    priceCents: 899,
    category: "Sweet",
    allergens: "wheat, milk, eggs",
    ingredients:
      "Enriched Wheat Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Whole Milk, Sugar, Butter, Eggs, Yeast, Salt. Coating: Sugar, Cinnamon.",
    netWeight: "12 oz (340 g)",
    isActive: true,
  },
  {
    slug: "prague-trdelnik-walnuts",
    name: "Prague Trdelník with Walnuts",
    description:
      "Our Czech chimney cake rolled in cinnamon sugar and chopped walnuts.",
    priceCents: 899,
    category: "Sweet",
    allergens: "wheat, milk, eggs, walnuts",
    ingredients:
      "Enriched Wheat Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Whole Milk, Sugar, Butter, Eggs, Yeast, Salt. Coating: Sugar, Cinnamon, Walnuts.",
    netWeight: "12 oz (340 g)",
    isActive: true,
  },
] as const;
