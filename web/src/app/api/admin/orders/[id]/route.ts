import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiClient, ApiError } from "@/lib/apiClient";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/orders/[id]">
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ errors: ["Unauthorized"] }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const status = body.status as OrderStatus | undefined;

  if (!status) {
    return NextResponse.json({ errors: ["Status is required."] }, { status: 400 });
  }

  try {
    const order = await apiClient.updateOrderStatus(id, status, token);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof ApiError) {
      // api/'s requireAdmin middleware is the real authorization check —
      // if our cookie held a token that's since expired or been forged,
      // this is where that surfaces (as a 401 from api/, relayed as-is).
      return NextResponse.json({ errors: err.errors }, { status: err.status });
    }
    throw err;
  }
}
