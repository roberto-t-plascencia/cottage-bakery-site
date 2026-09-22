import { NextResponse } from "next/server";
import { apiClient, ApiError } from "@/lib/apiClient";

/**
 * Thin proxy to api/'s POST /orders/:id/paypal-order — called by
 * PayPalCheckoutButton.tsx's `createOrder` callback, same pattern as
 * ../../orders/route.ts. See docs/adr/0006-online-payment-paypal.md.
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/orders/[id]/paypal-order">
) {
  const { id } = await ctx.params;
  try {
    const result = await apiClient.createPayPalOrder(id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ errors: err.errors }, { status: err.status });
    }
    throw err;
  }
}
