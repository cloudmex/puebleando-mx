import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPool } from "@/lib/db";

/** GET /api/notificaciones — Get my notifications */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const pool = getPool();
    if (!pool) return NextResponse.json({ notificaciones: [] });

    const { rows } = await pool.query(
      `SELECT * FROM notificaciones
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [auth.userId]
    );

    const { rows: unreadCount } = await pool.query(
      "SELECT COUNT(*) as count FROM notificaciones WHERE user_id = $1 AND leida = false",
      [auth.userId]
    );

    return NextResponse.json({
      notificaciones: rows,
      no_leidas: Number(unreadCount[0].count),
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** PATCH /api/notificaciones — Mark all as read */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const pool = getPool();
    if (!pool) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    await pool.query(
      "UPDATE notificaciones SET leida = true WHERE user_id = $1 AND leida = false",
      [auth.userId]
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
