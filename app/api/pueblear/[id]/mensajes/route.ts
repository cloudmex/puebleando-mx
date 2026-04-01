import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getChoferByUserId } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { notificarNuevoMensaje } from "@/lib/notificaciones";

/** GET /api/pueblear/[id]/mensajes — Get messages for a booking */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const pool = getPool();
    if (!pool) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    // Verify participant
    const { rows: reservaRows } = await pool.query("SELECT * FROM reservas WHERE id = $1", [id]);
    if (reservaRows.length === 0) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    const reserva = reservaRows[0];
    const chofer = await getChoferByUserId(auth.userId);
    const isParticipant = reserva.usuario_id === auth.userId ||
      (chofer && String(chofer.id) === String(reserva.chofer_id));

    if (!isParticipant) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    // Chat only available after booking is accepted
    const chatStatuses = ["aceptada", "confirmada", "en_curso", "completada"];
    if (!chatStatuses.includes(reserva.status)) {
      return NextResponse.json({ mensajes: [], chat_habilitado: false });
    }

    const { rows: mensajes } = await pool.query(
      `SELECT m.*, up.display_name as sender_nombre
       FROM mensajes m
       JOIN user_profiles up ON up.id = m.sender_id
       WHERE m.reserva_id = $1
       ORDER BY m.created_at ASC`,
      [id]
    );

    // Mark unread messages as read
    await pool.query(
      "UPDATE mensajes SET leido = true WHERE reserva_id = $1 AND sender_id != $2 AND leido = false",
      [id, auth.userId]
    );

    return NextResponse.json({ mensajes, chat_habilitado: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST /api/pueblear/[id]/mensajes — Send a message */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { contenido } = await request.json();
    if (!contenido?.trim()) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    const pool = getPool();
    if (!pool) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { rows: reservaRows } = await pool.query("SELECT * FROM reservas WHERE id = $1", [id]);
    if (reservaRows.length === 0) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    const reserva = reservaRows[0];
    const chofer = await getChoferByUserId(auth.userId);
    const isParticipant = reserva.usuario_id === auth.userId ||
      (chofer && String(chofer.id) === String(reserva.chofer_id));

    if (!isParticipant) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const chatStatuses = ["aceptada", "confirmada", "en_curso", "completada"];
    if (!chatStatuses.includes(reserva.status)) {
      return NextResponse.json({ error: "El chat no está disponible en este estado" }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO mensajes (reserva_id, sender_id, contenido)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, auth.userId, contenido.trim()]
    );

    // Notify the other participant
    const senderName = auth.profile?.display_name || "Alguien";
    if (reserva.usuario_id === auth.userId) {
      // User sent message → notify chofer
      const { rows: choferInfo } = await pool.query(
        "SELECT user_id FROM choferes WHERE id = $1", [reserva.chofer_id]
      );
      if (choferInfo[0]) notificarNuevoMensaje(choferInfo[0].user_id, id, senderName);
    } else {
      // Chofer sent message → notify user
      notificarNuevoMensaje(reserva.usuario_id, id, senderName);
    }

    return NextResponse.json({ mensaje: rows[0] }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
