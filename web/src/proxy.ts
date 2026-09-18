import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * Gatekeeper for /admin/*. This was already documented as an
 * "optimistic" check before the microservices split — Proxy shouldn't
 * be the sole authorization mechanism — and the split made that literal:
 * web/ has no way to verify the admin JWT's signature (only api/ holds
 * JWT_SECRET — see docs/adr/0004-service-boundary.md), so this can only
 * check "is there a token cookie at all," not "is it valid." A missing
 * cookie redirects to login before rendering anything; a present-but-
 * expired-or-forged token still reaches the page, but every data fetch
 * that page makes calls api/ with that token and gets a 401 from
 * `requireAdmin` there — see src/app/admin/page.tsx, which turns that
 * 401 into its own redirect to /admin/login. Real authorization happens
 * exactly once, in api/, not twice.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const hasToken = Boolean(request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value);
  if (!hasToken) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
