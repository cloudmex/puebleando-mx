import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client for server-side use (API routes, Server Components).
 * Uses the service role key to bypass RLS when needed, or anon key for user-scoped ops.
 * Pass useServiceRole=true only for admin operations.
 */
export function getSupabaseServerClient(useServiceRole = false): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) return null;

  const key = useServiceRole && serviceKey ? serviceKey : anonKey;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

/**
 * Extracts the Bearer token from an Authorization header or cookie string.
 * Returns null if not found.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7);
  return null;
}

/**
 * Creates a Supabase client authenticated as a specific user via their JWT token.
 * Used in API routes to validate the calling user's identity.
 */
export function getSupabaseClientWithToken(token: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}
