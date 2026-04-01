import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getChoferByUserId } from "@/lib/auth";
import { getPool } from "@/lib/db";

/** GET /api/comisiones — Get my commissions (chofer only) */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const chofer = await getChoferByUserId(auth.userId);
    if (!chofer) return NextResponse.json({ error: "No eres chofer" }, { status: 403 });

    const pool = getPool();
    if (!pool) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { rows: comisiones } = await pool.query(
      `SELECT com.*, r.fecha, r.destinos, r.precio_final,
        up.display_name as usuario_nombre
       FROM comisiones com
       JOIN reservas r ON r.id = com.reserva_id
       JOIN user_profiles up ON up.id = r.usuario_id
       WHERE com.chofer_id = $1
       ORDER BY com.created_at DESC`,
      [chofer.id]
    );

    // Calculate totals
    const { rows: totals } = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'pendiente' THEN monto ELSE 0 END), 0) as total_pendiente,
        COALESCE(SUM(CASE WHEN status = 'pagada' THEN monto ELSE 0 END), 0) as total_pagado,
        COALESCE(SUM(monto), 0) as total_general
       FROM comisiones WHERE chofer_id = $1`,
      [chofer.id]
    );

    return NextResponse.json({
      comisiones,
      resumen: totals[0],
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST /api/comisiones — Mark commission as paid (with reference) */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const chofer = await getChoferByUserId(auth.userId);
    if (!chofer) return NextResponse.json({ error: "No eres chofer" }, { status: 403 });

    const { comision_id, referencia_pago } = await request.json();
    if (!comision_id || !referencia_pago) {
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
    }

    const pool = getPool();
    if (!pool) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { rows } = await pool.query(
      "SELECT * FROM comisiones WHERE id = $1 AND chofer_id = $2 AND status = 'pendiente'",
      [comision_id, chofer.id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Comisión no encontrada o ya pagada" }, { status: 404 });
    }

    await pool.query(
      "UPDATE comisiones SET status = 'pagada', pagada_en = now(), referencia_pago = $1 WHERE id = $2",
      [referencia_pago, comision_id]
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
