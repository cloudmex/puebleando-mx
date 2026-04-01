import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getChoferByUserId } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { notificarCompletada } from "@/lib/notificaciones";

/** POST /api/pueblear/[id]/completar — Mark booking as completed (chofer only) */
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

    if (reserva.status !== "confirmada" && reserva.status !== "en_curso") {
      return NextResponse.json({ error: "La reserva debe estar confirmada o en curso" }, { status: 400 });
    }

    await pool.query(
      "UPDATE reservas SET status = 'completada', completada_en = now(), updated_at = now() WHERE id = $1",
      [id]
    );

    notificarCompletada(reserva.usuario_id, id);
    notificarCompletada(auth.userId, id);
    return NextResponse.json({ ok: true, status: "completada" });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
