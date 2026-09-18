/** Shared "fail loudly at startup, not at request time" env accessor. */
export function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill in your Supabase project's values (see README.md "Supabase setup").`
    );
  }
  return value;
}
