import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { updateOrderStatus } from "@/lib/repositories/orders";
import type { OrderStatus } from "@/lib/types";
import { ADMIN_SESSION_COOKIE_NAME, isValidSessionCookieValue } from "@/lib/auth";

const VALID_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

// Proxy (src/proxy.ts) already blocks unauthenticated requests to /admin/*,
// but that's a UI-level redirect, not an API contract — this route is
// reachable directly (curl, a future mobile client, a bug in the proxy
// matcher), so it re-checks the session itself. Defense in depth.
async function requireAdminSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return isValidSessionCookieValue(session);
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/orders/[id]">
) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const status = body.status as OrderStatus | undefined;

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const order = await updateOrderStatus(id, status);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  return NextResponse.json({ order });
}
