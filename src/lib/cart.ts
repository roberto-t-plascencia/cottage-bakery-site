/**
 * Cart math, kept as pure functions with no framework or storage
 * dependencies. That's what makes cart.test.ts able to test real business
 * logic (rounding, empty carts, quantity edge cases) without spinning up
 * React or a database — the cheapest tests catch the most common bugs.
 */

export type CartLine = {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
};

export const MIN_LEAD_TIME_DAYS = 2;

export function addToCart(
  cart: CartLine[],
  line: Omit<CartLine, "quantity">,
  quantity: number
): CartLine[] {
  if (quantity <= 0) {
    throw new Error("Quantity must be a positive integer");
  }

  const existing = cart.find((c) => c.productId === line.productId);
  if (existing) {
    return cart.map((c) =>
      c.productId === line.productId
        ? { ...c, quantity: c.quantity + quantity }
        : c
    );
  }

  return [...cart, { ...line, quantity }];
}

export function removeFromCart(cart: CartLine[], productId: string): CartLine[] {
  return cart.filter((c) => c.productId !== productId);
}

export function updateQuantity(
  cart: CartLine[],
  productId: string,
  quantity: number
): CartLine[] {
  if (quantity <= 0) {
    return removeFromCart(cart, productId);
  }
  return cart.map((c) => (c.productId === productId ? { ...c, quantity } : c));
}

export function cartSubtotalCents(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
}

export function cartItemCount(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/**
 * Earliest date a new order could be ready, given baking lead time.
 * Exported so the checkout form and server-side validation share one
 * definition instead of drifting apart.
 */
export function earliestReadyDate(from: Date = new Date()): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + MIN_LEAD_TIME_DAYS);
  return result;
}
