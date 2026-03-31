"use client";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

/**
 * Returns the Authorization header value for client-side API calls.
 * Checks mock_token first (local dev), then real Supabase JWT.
 */
export async function getApiAuthHeader(): Promise<Record<string, string>> {
  // Always check mock_token first — even when Supabase is configured,
  // mock users won't have a real JWT session.
  const mockToken =
    typeof window !== "undefined"
      ? localStorage.getItem("puebleando_mock_token")
      : null;
  if (mockToken) {
    return { Authorization: `Bearer ${mockToken}` };
  }

  if (!isSupabaseConfigured()) return {};

  const supabase = getSupabaseClient();
  if (!supabase) return {};

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}
