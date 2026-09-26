import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiClient, ApiError } from "@/lib/apiClient";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth";

// Admin photo upload/removal. Same cookie-to-bearer relay as
// ../route.ts; api/ checks the token, the file type and the size.

async function adminToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
}

function relayError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ errors: err.errors }, { status: err.status });
  }
  throw err;
}

export async function PUT(request: Request, ctx: RouteContext<"/api/admin/products/[id]/image">) {
  const token = await adminToken();
  if (!token) return NextResponse.json({ errors: ["Unauthorized"] }, { status: 401 });

  const { id } = await ctx.params;
  const contentType = request.headers.get("content-type") ?? "";
  const data = await request.arrayBuffer();

  try {
    const product = await apiClient.setProductImage(id, data, contentType, token);
    return NextResponse.json({ product });
  } catch (err) {
    return relayError(err);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/products/[id]/image">) {
  const token = await adminToken();
  if (!token) return NextResponse.json({ errors: ["Unauthorized"] }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const product = await apiClient.deleteProductImage(id, token);
    return NextResponse.json({ product });
  } catch (err) {
    return relayError(err);
  }
}
