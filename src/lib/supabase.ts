import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client, using the service_role key.
 *
 * The `server-only` import above makes it a build error to import this
 * module from client component code — the service_role key bypasses Row
 * Level Security entirely, so it must never reach the browser. Every
 * repository function in src/lib/repositories/ runs on the server (Server
 * Components, Route Handlers) and is the only code that imports this.
 *
 * This app never uses the anon/public key: there's no direct client-side
 * Supabase access anywhere (see docs/ARCHITECTURE.md) — the browser only
 * ever talks to this app's own API routes, which then talk to Supabase.
 * That means the RLS policies in supabase/migrations/0001_init.sql are
 * defense-in-depth for a future client-side feature, not something this
 * app's current request flow depends on.
 */
function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill in your Supabase project's values (see README.md "Supabase setup").`
    );
  }
  return value;
}

function createServerClient() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

// Inferred from createServerClient's own return type rather than a bare
// `ReturnType<typeof createClient>` — createClient's generics don't
// default the same way when annotated from outside the call, which
// otherwise trips a spurious type mismatch between this cached value and
// the client createServerClient() actually returns.
const globalForSupabase = globalThis as unknown as {
  supabase: ReturnType<typeof createServerClient> | undefined;
};

// Same HMR-survival reasoning as the earlier node:sqlite singleton had:
// avoid re-creating the client (and its underlying HTTP connection pool)
// on every module reload in `next dev`.
export const supabase = globalForSupabase.supabase ?? createServerClient();

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.supabase = supabase;
}
