import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiClient, ApiError } from "@/lib/apiClient";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth";

// The admin "Sold out today" switch posts here; same cookie-to-bearer
// relay as ../orders/[id]/route.ts. api/ does the real auth check.
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/products/[id]">
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ errors: ["Unauthorized"] }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.soldOutToday !== "boolean") {
    return NextResponse.json({ errors: ["soldOutToday must be true or false."] }, { status: 400 });
  }

  try {
    const product = await apiClient.setProductSoldOut(id, body.soldOutToday, token);
    return NextResponse.json({ product });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ errors: err.errors }, { status: err.status });
    }
    throw err;
  }
}
