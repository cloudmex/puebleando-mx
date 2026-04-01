import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getChoferByUserId } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { notificarNuevaSolicitud } from "@/lib/notificaciones";

/** GET /api/pueblear — List my bookings (as user or chofer) */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const rol = request.nextUrl.searchParams.get("rol") || "usuario";

    const pool = getPool();
    if (pool) {
      let query: string;
      let queryParams: unknown[];

      if (rol === "chofer") {
        const chofer = await getChoferByUserId(auth.userId);
        if (!chofer) return NextResponse.json({ reservas: [] });
        query = `
          SELECT r.*, up.display_name as usuario_nombre
          FROM reservas r
          JOIN user_profiles up ON up.id = r.usuario_id
          WHERE r.chofer_id = $1
          ORDER BY r.created_at DESC`;
        queryParams = [chofer.id];
      } else {
        query = `
          SELECT r.*,
            c.nombre_completo as chofer_nombre,
            c.foto_url as chofer_foto,
            c.calificacion_promedio as chofer_calificacion
          FROM reservas r
          JOIN choferes c ON c.id = r.chofer_id
          WHERE r.usuario_id = $1
          ORDER BY r.created_at DESC`;
        queryParams = [auth.userId];
      }

      const { rows } = await pool.query(query, queryParams);
      return NextResponse.json({ reservas: rows });
    }

    return NextResponse.json({ reservas: [] });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST /api/pueblear — Create a new booking request */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const {
      chofer_id, fecha, hora_inicio, duracion_horas,
      num_pasajeros, punto_recogida, punto_entrega,
      destinos, notas, precio_propuesto,
      usuario_foto_url, usuario_ine_url,
    } = body;

    if (!chofer_id || !fecha || !hora_inicio || !duracion_horas || !precio_propuesto) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    if (!punto_recogida) {
      return NextResponse.json({ error: "Debes indicar el punto de recogida" }, { status: 400 });
    }

    if (!usuario_foto_url || !usuario_ine_url) {
      return NextResponse.json({ error: "Debes subir tu foto y verificar tu identidad" }, { status: 400 });
    }

    // Validate date is at least 24h in the future
    const bookingDate = new Date(`${fecha}T${hora_inicio}`);
    const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (bookingDate < minDate) {
      return NextResponse.json({ error: "La reserva debe ser con al menos 24 horas de anticipación" }, { status: 400 });
    }

    const pool = getPool();
    if (pool) {
      // Verify chofer is active and available, check vehicle capacity
      const { rows: choferCheck } = await pool.query(
        `SELECT c.id, c.disponible, v.capacidad_pasajeros
         FROM choferes c
         LEFT JOIN vehiculos v ON v.chofer_id = c.id AND v.activo = true
         WHERE c.id = $1 AND c.status = 'activo'`,
        [chofer_id]
      );
      if (choferCheck.length === 0) {
        return NextResponse.json({ error: "Chofer no disponible" }, { status: 400 });
      }

      const pasajeros = num_pasajeros || 1;
      const capacidad = choferCheck[0].capacidad_pasajeros || 4;
      if (pasajeros > capacidad) {
        return NextResponse.json({
          error: `El vehículo tiene capacidad para ${capacidad} pasajeros, solicitaste ${pasajeros}`,
        }, { status: 400 });
      }

      const { rows } = await pool.query(
        `INSERT INTO reservas (
          usuario_id, chofer_id, fecha, hora_inicio, duracion_horas,
          num_pasajeros, punto_recogida, punto_entrega,
          destinos, notas, precio_propuesto,
          usuario_foto_url, usuario_ine_url, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pendiente')
        RETURNING *`,
        [
          auth.userId, chofer_id, fecha, hora_inicio, duracion_horas,
          pasajeros, punto_recogida, punto_entrega || null,
          destinos || [], notas || null, precio_propuesto,
          usuario_foto_url, usuario_ine_url,
        ]
      );

      // Notify chofer
      const { rows: choferInfo } = await pool.query(
        "SELECT user_id FROM choferes WHERE id = $1", [chofer_id]
      );
      if (choferInfo[0]) {
        notificarNuevaSolicitud(
          choferInfo[0].user_id,
          rows[0].id,
          auth.profile.display_name || "Un viajero"
        );
      }

      return NextResponse.json({ reserva: rows[0] }, { status: 201 });
    }

    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
