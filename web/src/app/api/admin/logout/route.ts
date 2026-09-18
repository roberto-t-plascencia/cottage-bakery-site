import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * "Logout" is just deleting web/'s cookie — there's no server-side
 * session to invalidate anymore. The JWT api/ issued stays valid until
 * it expires on its own (see api/src/lib/auth.ts's comment on
 * ADMIN_TOKEN_TTL_SECONDS for why there's no revocation list). That's a
 * real, accepted gap for this app's scale, not an oversight — see
 * docs/adr/0004-service-boundary.md.
 */
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
