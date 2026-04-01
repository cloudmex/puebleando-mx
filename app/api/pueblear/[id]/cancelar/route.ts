import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getChoferByUserId } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { notificarCancelada } from "@/lib/notificaciones";

/** POST /api/pueblear/[id]/cancelar — Cancel a booking */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { motivo } = await request.json();

    const pool = getPool();
    if (!pool) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { rows } = await pool.query("SELECT * FROM reservas WHERE id = $1", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    const reserva = rows[0];
    const chofer = await getChoferByUserId(auth.userId);
    const isChofer = chofer && String(chofer.id) === String(reserva.chofer_id);
    const isUsuario = reserva.usuario_id === auth.userId;

    if (!isChofer && !isUsuario) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const cancellable = ["pendiente", "contraoferta", "aceptada", "confirmada"];
    if (!cancellable.includes(reserva.status)) {
      return NextResponse.json({ error: "No se puede cancelar en este estado" }, { status: 400 });
    }

    await pool.query(
      `UPDATE reservas SET
        status = 'cancelada',
        cancelado_por = $1,
        motivo_cancelacion = $2,
        cancelada_en = now(),
        updated_at = now()
      WHERE id = $3`,
      [auth.userId, motivo || "Sin motivo", id]
    );

    // Notify the other party
    if (isChofer) {
      notificarCancelada(reserva.usuario_id, id, motivo || "El chofer canceló la reserva");
    } else {
      const { rows: choferInfo } = await pool.query(
        "SELECT user_id FROM choferes WHERE id = $1", [reserva.chofer_id]
      );
      if (choferInfo[0]) {
        notificarCancelada(choferInfo[0].user_id, id, motivo || "El usuario canceló la reserva");
      }
    }

    return NextResponse.json({ ok: true, status: "cancelada" });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
