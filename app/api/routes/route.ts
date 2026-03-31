import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/** GET /api/routes — lista las rutas del usuario autenticado */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Local PostgreSQL ──
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, description, stops, created_at
         FROM routes WHERE user_id = $1 ORDER BY created_at DESC`,
        [auth.userId]
      );
      return NextResponse.json({ routes: rows });
    } catch (err) {
      console.error("[api/routes GET pg]", err);
      return NextResponse.json({ routes: [] });
    }
  }

  // ── Supabase fallback ──
  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const { data, error } = await supabase
      .from("routes")
      .select("id, name, description, stops, created_at")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api/routes GET supabase]", error);
      return NextResponse.json({ routes: [] });
    }
    return NextResponse.json({ routes: data ?? [] });
  }

  return NextResponse.json({ routes: [] });
}

/** POST /api/routes — crea una nueva ruta */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { id, name, description = "", stops = [], created_at } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const routeId = id ?? `r_${Date.now()}`;
  const routeCreatedAt = created_at ?? new Date().toISOString();

  // ── Local PostgreSQL ──
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO routes (id, name, description, stops, user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name, description = EXCLUDED.description,
               stops = EXCLUDED.stops
         RETURNING id, name, description, stops, created_at`,
        [routeId, name.trim(), description, JSON.stringify(stops), auth.userId, routeCreatedAt]
      );
      return NextResponse.json({ route: rows[0] });
    } catch (err) {
      console.error("[api/routes POST pg]", err);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  // ── Supabase fallback ──
  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const { data, error } = await supabase
      .from("routes")
      .upsert({
        id: routeId,
        name: name.trim(),
        description,
        stops,
        user_id: auth.userId,
        created_at: routeCreatedAt,
      }, { onConflict: "id" })
      .select("id, name, description, stops, created_at")
      .single();

    if (error) {
      console.error("[api/routes POST supabase]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ route: data });
  }

  return NextResponse.json({ error: "No database configured" }, { status: 503 });
}
