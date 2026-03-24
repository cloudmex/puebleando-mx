import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * GET /api/dashboard/data
 * Returns the authenticated user's owned places, submissions, and claims.
 * Works with local PostgreSQL and Supabase production.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = auth.userId;

  // ── Local PostgreSQL ─────────────────────────────────────────
  const pool = getPool();
  if (pool) {
    async function safeQuery(sql: string, params: unknown[]) {
      try {
        const res = await pool!.query(sql, params);
        return res.rows;
      } catch {
        return [];
      }
    }

    const [places, events, submissions, claims] = await Promise.all([
      safeQuery(
        `SELECT id, name, description, category, latitude, longitude,
                photos, town, state, tags, created_at
         FROM places WHERE submitted_by = $1 ORDER BY created_at DESC`,
        [userId]
      ),
      safeQuery(
        `SELECT id, title, slug, category, latitude, longitude,
                created_at, start_date, image_url, city, state, venue_name
         FROM events WHERE submitted_by = $1 ORDER BY created_at DESC`,
        [userId]
      ),
      safeQuery(
        `SELECT id, user_id, content_type, status, payload, reviewer_note, published_id, created_at
         FROM content_submissions WHERE user_id = $1 ORDER BY created_at ASC`,
        [userId]
      ),
      safeQuery(
        `SELECT id, user_id, content_type, content_id, status, reason, admin_note, created_at
         FROM claims WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      ),
    ]);

    return NextResponse.json({ places, events, submissions, claims });
  }

  // ── Supabase (production) ────────────────────────────────────
  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const [placesRes, eventsRes, subsRes, claimsRes] = await Promise.all([
      supabase.from("places").select("*").eq("submitted_by", userId).order("created_at", { ascending: false }),
      supabase.from("events").select("*").eq("submitted_by", userId).order("created_at", { ascending: false }),
      supabase.from("content_submissions").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("claims").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);

    return NextResponse.json({
      places: placesRes.data ?? [],
      events: eventsRes.data ?? [],
      submissions: subsRes.data ?? [],
      claims: claimsRes.data ?? [],
    });
  }

  return NextResponse.json({ places: [], events: [], submissions: [], claims: [] });
}
