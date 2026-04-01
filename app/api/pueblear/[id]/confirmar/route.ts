import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getChoferByUserId } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { notificarConfirmada } from "@/lib/notificaciones";

/** POST /api/pueblear/[id]/confirmar — Chofer confirms booking (24h before) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const chofer = await getChoferByUserId(auth.userId);
    if (!chofer) return NextResponse.json({ error: "No eres chofer" }, { status: 403 });

    const pool = getPool();
    if (!pool) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { rows } = await pool.query("SELECT * FROM reservas WHERE id = $1", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    const reserva = rows[0];
    if (String(chofer.id) !== String(reserva.chofer_id)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (reserva.status !== "aceptada") {
      return NextResponse.json({ error: "La reserva debe estar aceptada para confirmar" }, { status: 400 });
    }

    await pool.query(
      "UPDATE reservas SET status = 'confirmada', confirmada_en = now(), updated_at = now() WHERE id = $1",
      [id]
    );

    notificarConfirmada(reserva.usuario_id, id);
    return NextResponse.json({ ok: true, status: "confirmada" });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
