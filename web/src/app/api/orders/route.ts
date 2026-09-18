import { NextResponse } from "next/server";
import { apiClient, ApiError } from "@/lib/apiClient";

/**
 * Thin proxy to api/'s POST /orders — parse the request, forward it,
 * relay the response. No business logic lives here anymore (it moved to
 * api/src/routes/orders.ts and api/src/lib/orders.ts); this route exists
 * only because the browser needs *something* same-origin to submit the
 * checkout form to. See specs/ENGINEERING_RULES.md "Testing bar" for why
 * this route has no test of its own.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errors: ["Request body must be valid JSON."] }, { status: 400 });
  }

  try {
    const order = await apiClient.createOrder(body as Parameters<typeof apiClient.createOrder>[0]);
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ errors: err.errors }, { status: err.status });
    }
    throw err;
  }
}
