"use client";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

/**
 * Returns the Authorization header value for client-side API calls.
 * Uses mock_token in local dev, or the real Supabase JWT in production.
 */
export async function getApiAuthHeader(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) {
    const token = typeof window !== "undefined"
      ? localStorage.getItem("puebleando_mock_token")
      : null;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return {};

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}
