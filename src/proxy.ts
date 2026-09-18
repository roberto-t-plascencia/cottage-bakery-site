import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, isValidSessionCookieValue } from "@/lib/auth";

/**
 * Gatekeeper for /admin/*. This is an "optimistic" check per Next's own
 * guidance (Proxy shouldn't be the sole authorization mechanism) — the
 * admin API routes re-verify the session themselves rather than trusting
 * that a request reaching them already passed this check. Defense in
 * depth, not redundancy for its own sake.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const session = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!isValidSessionCookieValue(session)) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
