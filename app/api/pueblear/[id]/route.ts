import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getChoferByUserId } from "@/lib/auth";
import { getPool } from "@/lib/db";

/** GET /api/pueblear/[id] — Get booking detail */
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

    const { rows } = await pool.query(
      `SELECT r.*,
        c.nombre_completo as chofer_nombre,
        c.foto_url as chofer_foto,
        c.telefono as chofer_telefono,
        c.calificacion_promedio as chofer_calificacion,
        c.user_id as chofer_user_id,
        up.display_name as usuario_nombre,
        v.marca as vehiculo_marca,
        v.modelo as vehiculo_modelo,
        v.anio as vehiculo_anio,
        v.color as vehiculo_color,
        v.capacidad_pasajeros as vehiculo_capacidad
      FROM reservas r
      JOIN choferes c ON c.id = r.chofer_id
      JOIN user_profiles up ON up.id = r.usuario_id
      LEFT JOIN vehiculos v ON v.chofer_id = c.id AND v.activo = true
      WHERE r.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    const reserva = rows[0];
    const chofer = await getChoferByUserId(auth.userId);
    const isParticipant = reserva.usuario_id === auth.userId ||
      (chofer && String(chofer.id) === String(reserva.chofer_id));

    if (!isParticipant && auth.profile.trust_level !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    return NextResponse.json({ reserva });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
