import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getChoferByUserId } from "@/lib/auth";
import { getPool } from "@/lib/db";

/** POST /api/pueblear/[id]/calificar — Rate after completed trip */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { puntuacion, comentario } = await request.json();
    if (!puntuacion || puntuacion < 1 || puntuacion > 5) {
      return NextResponse.json({ error: "Puntuación debe ser entre 1 y 5" }, { status: 400 });
    }

    const pool = getPool();
    if (!pool) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { rows } = await pool.query("SELECT * FROM reservas WHERE id = $1", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    const reserva = rows[0];
    if (reserva.status !== "completada") {
      return NextResponse.json({ error: "Solo puedes calificar viajes completados" }, { status: 400 });
    }

    const chofer = await getChoferByUserId(auth.userId);
    const isChofer = chofer && String(chofer.id) === String(reserva.chofer_id);
    const isUsuario = reserva.usuario_id === auth.userId;

    if (!isChofer && !isUsuario) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    let tipo: string;
    let destinatarioId: string;

    if (isUsuario) {
      tipo = "usuario_a_chofer";
      // Get chofer's user_id
      const { rows: choferRows } = await pool.query(
        "SELECT user_id FROM choferes WHERE id = $1", [reserva.chofer_id]
      );
      destinatarioId = choferRows[0].user_id;
    } else {
      tipo = "chofer_a_usuario";
      destinatarioId = reserva.usuario_id;
    }

    // Check if already rated
    const { rows: existing } = await pool.query(
      "SELECT id FROM calificaciones WHERE reserva_id = $1 AND tipo = $2",
      [id, tipo]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: "Ya calificaste este viaje" }, { status: 409 });
    }

    const { rows: calificacion } = await pool.query(
      `INSERT INTO calificaciones (reserva_id, autor_id, destinatario_id, tipo, puntuacion, comentario)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, auth.userId, destinatarioId, tipo, puntuacion, comentario || null]
    );

    return NextResponse.json({ calificacion: calificacion[0] }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
