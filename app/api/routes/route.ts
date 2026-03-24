import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPool } from "@/lib/db";

/** GET /api/routes — lista las rutas del usuario autenticado */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pool = getPool();
  if (!pool) return NextResponse.json({ routes: [] });

  try {
    const { rows } = await pool.query(
      `SELECT id, name, description, stops, created_at
       FROM routes WHERE user_id = $1 ORDER BY created_at DESC`,
      [auth.userId]
    );
    return NextResponse.json({ routes: rows });
  } catch (err) {
    console.error("[api/routes GET]", err);
    return NextResponse.json({ routes: [] });
  }
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

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 });

  try {
    const { rows } = await pool.query(
      `INSERT INTO routes (id, name, description, stops, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name, description = EXCLUDED.description,
             stops = EXCLUDED.stops
       RETURNING id, name, description, stops, created_at`,
      [
        id ?? undefined,
        name.trim(),
        description,
        JSON.stringify(stops),
        auth.userId,
        created_at ?? new Date().toISOString(),
      ]
    );
    return NextResponse.json({ route: rows[0] });
  } catch (err) {
    console.error("[api/routes POST]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
