import { UserProfile, TrustLevel } from "@/types";
import { getSupabaseClientWithToken, getSupabaseServerClient } from "./supabase-server";
import { getPool } from "./db";

function rowToProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    display_name: String(row.display_name ?? ""),
    trust_level: (row.trust_level as TrustLevel) ?? "new",
    bio: row.bio ? String(row.bio) : undefined,
    avatar_url: row.avatar_url ? String(row.avatar_url) : undefined,
    created_at: String(row.created_at ?? ""),
  };
}

/** Fetches a user profile by user ID. Returns null if not found. */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  // 1. Local PostgreSQL
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM user_profiles WHERE id = $1",
        [userId]
      );
      if (rows[0]) return rowToProfile(rows[0]);
    } catch (err) {
      console.warn("[auth] pg getUserProfile failed.", err);
    }
    return null;
  }

  // 2. Supabase (service role to bypass RLS)
  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (!error && data) return rowToProfile(data);
    console.warn("[auth] Supabase getUserProfile failed.", error?.message);
  }

  return null;
}

/**
 * Validates the Authorization header from a Next.js API route request.
 * Returns { userId, profile } or null if unauthenticated.
 */
export async function requireAuth(
  authHeader: string | null
): Promise<{ userId: string; profile: UserProfile } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  const supabase = getSupabaseClientWithToken(token);
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const profile = await getUserProfile(user.id);
  if (!profile) return null;

  return { userId: user.id, profile };
}

/**
 * Same as requireAuth but also checks that the user is an admin.
 * Returns null if not authenticated or not admin.
 */
export async function requireAdmin(
  authHeader: string | null
): Promise<{ userId: string; profile: UserProfile } | null> {
  const auth = await requireAuth(authHeader);
  if (!auth) return null;
  if (auth.profile.trust_level !== "admin") return null;
  return auth;
}

/** Returns true if the user can auto-publish content (verified or admin). */
export function canAutoPublish(profile: UserProfile): boolean {
  return profile.trust_level === "verified" || profile.trust_level === "admin";
}
