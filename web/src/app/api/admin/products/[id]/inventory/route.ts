import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiClient, ApiError } from "@/lib/apiClient";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth";

// The day-inventory editor on /admin posts here. Same cookie-to-bearer
// relay as the sibling routes — a thin proxy with no business logic of
// its own, which is why it has no route-level test (see
// ../../../../../../../specs/ENGINEERING_RULES.md "Testing bar"). api/
// does the real auth and validation; the only check here is the shape
// the proxy itself depends on.
export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/admin/products/[id]/inventory">
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ errors: ["Unauthorized"] }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const { date, startQuantity } = body ?? {};

  if (typeof date !== "string") {
    return NextResponse.json({ errors: ["date is required."] }, { status: 400 });
  }
  // null is meaningful here (clear the cap), so this deliberately
  // accepts it and rejects only the shapes api/ couldn't interpret.
  if (startQuantity !== null && typeof startQuantity !== "number") {
    return NextResponse.json(
      { errors: ["startQuantity must be a number or null."] },
      { status: 400 }
    );
  }

  try {
    const inventory = await apiClient.setDayInventory(id, date, startQuantity, token);
    return NextResponse.json({ inventory });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ errors: err.errors }, { status: err.status });
    }
    throw err;
  }
}
