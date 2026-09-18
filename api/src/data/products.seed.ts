/**
 * Starter menu. Edit freely — this is sample data, not fixture code the
 * app depends on. Prices are in cents to avoid floating-point rounding
 * bugs in totals (classic "why is my subtotal $19.999999999998" class of
 * bug, avoided by never storing money as a float).
 */
export const productSeed = [
  {
    slug: "classic-chocolate-chip-cookies",
    name: "Classic Chocolate Chip Cookies (dozen)",
    description:
      "Brown-butter chocolate chip cookies, baked to order. A dozen per box.",
    priceCents: 2200,
    category: "Cookies",
    allergens: "wheat,dairy,egg",
    isActive: true,
  },
  {
    slug: "sourdough-loaf",
    name: "Country Sourdough Loaf",
    description: "Naturally leavened sourdough, 24-hour cold ferment.",
    priceCents: 900,
    category: "Bread",
    allergens: "wheat",
    isActive: true,
  },
  {
    slug: "lemon-blueberry-loaf-cake",
    name: "Lemon Blueberry Loaf Cake",
    description: "Glazed lemon loaf cake studded with fresh blueberries.",
    priceCents: 1800,
    category: "Cakes",
    allergens: "wheat,dairy,egg",
    isActive: true,
  },
  {
    slug: "cinnamon-rolls",
    name: "Cinnamon Rolls (box of 6)",
    description: "Soft brioche cinnamon rolls with cream cheese icing.",
    priceCents: 2600,
    category: "Pastries",
    allergens: "wheat,dairy,egg",
    isActive: true,
  },
  {
    slug: "custom-birthday-cake",
    name: "Custom Birthday Cake (6-inch, serves 8–10)",
    description:
      "Made-to-order layer cake — message us with flavor and design requests.",
    priceCents: 5500,
    category: "Cakes",
    allergens: "wheat,dairy,egg",
    isActive: true,
  },
] as const;
