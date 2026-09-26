import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiClient, ApiError } from "@/lib/apiClient";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth";

// The admin "Sold out today" switch and "Show on menu / Hide" button post
// here; same cookie-to-bearer relay as ../orders/[id]/route.ts. api/
// does the real auth check.
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
  const soldOut = typeof body.soldOutToday === "boolean";
  const active = typeof body.isActive === "boolean";
  if (soldOut === active) {
    return NextResponse.json(
      { errors: ["Send either soldOutToday or isActive, true or false."] },
      { status: 400 }
    );
  }

  try {
    const product = soldOut
      ? await apiClient.setProductSoldOut(id, body.soldOutToday, token)
      : await apiClient.setProductActive(id, body.isActive, token);
    return NextResponse.json({ product });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ errors: err.errors }, { status: err.status });
    }
    throw err;
  }
}
