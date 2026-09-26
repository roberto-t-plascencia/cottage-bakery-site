import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiClient, ApiError } from "@/lib/apiClient";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth";

// The admin "Add product" form posts here. api/ validates every field and
// does the real auth check; this only relays the cookie as a bearer token.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ errors: ["Unauthorized"] }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  try {
    const product = await apiClient.createProduct(body, token);
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ errors: err.errors }, { status: err.status });
    }
    throw err;
  }
}
