import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Returns a Supabase client if env vars are configured, otherwise null.
 * Works in both Server Components and Client Components (using public anon key).
 */
export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  // Singleton to avoid creating multiple clients
  if (!_client) {
    _client = createClient(url, key);
  }
  return _client;
}
