import { NextResponse } from "next/server";
import { apiClient, ApiError } from "@/lib/apiClient";

/**
 * Thin proxy to api/'s POST /orders/:id/capture-payment — called by
 * PayPalCheckoutButton.tsx's `onApprove` callback, once the buyer has
 * approved in the PayPal popup. The actual capture (and the decision to
 * trust it) happens in api/, server-side — this route does nothing but
 * relay the request and response. See
 * docs/adr/0006-online-payment-paypal.md.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/orders/[id]/capture-payment">
) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const paypalOrderId = body.paypalOrderId as string | undefined;

  if (!paypalOrderId) {
    return NextResponse.json({ errors: ["paypalOrderId is required."] }, { status: 400 });
  }

  try {
    const order = await apiClient.capturePayment(id, paypalOrderId);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ errors: err.errors }, { status: err.status });
    }
    throw err;
  }
}
