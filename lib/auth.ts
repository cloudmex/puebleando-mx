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

  // 1.5 Local Admin Mock (if not in PG, dev only)
  if (process.env.NODE_ENV !== "production" && userId === "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee") {
    return {
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      display_name: "Administrador Local",
      trust_level: "admin",
      created_at: new Date().toISOString(),
    };
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

  // Handle mock_token for local development only
  if (process.env.NODE_ENV !== "production" && token === "mock_token") {
    return {
      userId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      profile: {
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        display_name: "Administrador Local",
        trust_level: "admin",
        created_at: new Date().toISOString(),
      },
    };
  }

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

/**
 * Gets the chofer profile for a user. Returns null if the user is not a chofer.
 */
export async function getChoferByUserId(userId: string): Promise<Record<string, unknown> | null> {
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM choferes WHERE user_id = $1",
        [userId]
      );
      return rows[0] ?? null;
    } catch {
      // table may not exist yet
    }
  }

  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const { data } = await supabase
      .from("choferes")
      .select("*")
      .eq("user_id", userId)
      .single();
    return data ?? null;
  }

  return null;
}

/**
 * Validates auth and checks user is an active chofer.
 * Returns { userId, profile, chofer } or null.
 */
export async function requireChofer(
  authHeader: string | null
): Promise<{ userId: string; profile: UserProfile; chofer: Record<string, unknown> } | null> {
  const auth = await requireAuth(authHeader);
  if (!auth) return null;

  const chofer = await getChoferByUserId(auth.userId);
  if (!chofer || chofer.status !== "activo") return null;

  return { ...auth, chofer };
}
