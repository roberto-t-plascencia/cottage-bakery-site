import { NextResponse } from "next/server";
import { apiClient } from "@/lib/apiClient";

/**
 * Thin proxy to api/'s GET /config — the only server-held value web/
 * needs that isn't already known here: PayPal's Client ID (see
 * docs/adr/0006-online-payment-paypal.md for why it lives in api/'s env
 * rather than being duplicated into web/'s own). Not secret, but kept
 * server-side so api/'s env var stays the one place it's defined and
 * rotated.
 */
export async function GET() {
  const config = await apiClient.getConfig();
  return NextResponse.json(config);
}
