import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key.
 * The browser never receives this key and never talks to Supabase directly:
 * every query runs here, after a role check in lib/auth.
 */
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Throw a readable error for a failed Supabase call. */
export function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}
