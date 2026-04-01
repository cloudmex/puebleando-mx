import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPool } from "@/lib/db";

/** POST /api/admin/choferes/[id]/rechazar — Reject a chofer */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAdmin(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { motivo } = await request.json();

    const pool = getPool();
    if (!pool) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { rows } = await pool.query(
      `UPDATE choferes SET
        status = 'rechazado',
        admin_nota = $1,
        revisado_por = $2,
        revisado_en = now(),
        updated_at = now()
       WHERE id = $3 AND status = 'en_revision'
       RETURNING *`,
      [motivo || "Documentación insuficiente", auth.userId, id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Chofer no encontrado o no está en revisión" }, { status: 404 });
    }

    return NextResponse.json({ chofer: rows[0] });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
