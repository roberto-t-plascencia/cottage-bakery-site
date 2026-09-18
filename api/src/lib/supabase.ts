import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

/**
 * The Supabase client, using the service_role key — this service is the
 * only thing in the whole system that holds it (never `web/`, never the
 * browser). service_role bypasses Row Level Security entirely, which is
 * fine here: every request into this service is already authorized by
 * this service's own route handlers (public reads, or admin routes behind
 * `requireAdmin`), so RLS would be redundant authorization, not missing
 * authorization. RLS is still enabled on every table (see
 * supabase/migrations/0001_init.sql) as defense-in-depth for a
 * hypothetical future feature that talks to Supabase directly from a
 * client — not something this service's current request flow depends on.
 *
 * A plain module-level singleton is enough here — unlike the Next.js
 * version of this file (see docs/adr/0001-tech-stack.md), this process
 * doesn't hot-reload individual modules; `tsx watch` restarts the whole
 * process on a file change, so there's no HMR-survival global-cache trick
 * to work around.
 */
export const supabase = createClient(
  getEnv("SUPABASE_URL"),
  getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);
