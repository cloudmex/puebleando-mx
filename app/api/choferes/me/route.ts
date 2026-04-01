import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/** GET /api/choferes/me — Get my own chofer profile (all fields, any status) */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const pool = getPool();
    if (pool) {
      const { rows } = await pool.query(
        `SELECT c.*,
          json_build_object(
            'id', v.id, 'marca', v.marca, 'modelo', v.modelo, 'anio', v.anio,
            'color', v.color, 'capacidad_pasajeros', v.capacidad_pasajeros,
            'foto_frente_url', v.foto_frente_url, 'foto_lateral_url', v.foto_lateral_url,
            'foto_interior_url', v.foto_interior_url,
            'tarjeta_circulacion_url', v.tarjeta_circulacion_url,
            'seguro_url', v.seguro_url, 'seguro_vigencia', v.seguro_vigencia
          ) AS vehiculo
        FROM choferes c
        LEFT JOIN vehiculos v ON v.chofer_id = c.id AND v.activo = true
        WHERE c.user_id = $1`,
        [auth.userId]
      );

      if (rows.length === 0) {
        return NextResponse.json({ chofer: null });
      }

      // Also get commission summary
      const { rows: comRows } = await pool.query(
        `SELECT
          COALESCE(SUM(CASE WHEN status = 'pendiente' THEN monto ELSE 0 END), 0) as total_pendiente,
          COALESCE(SUM(CASE WHEN status = 'pagada' THEN monto ELSE 0 END), 0) as total_pagado
        FROM comisiones WHERE chofer_id = $1`,
        [rows[0].id]
      );

      // Count pending bookings
      const { rows: pendingRows } = await pool.query(
        `SELECT COUNT(*) as count FROM reservas
         WHERE chofer_id = $1 AND status IN ('pendiente', 'contraoferta', 'aceptada')`,
        [rows[0].id]
      );

      return NextResponse.json({
        chofer: rows[0],
        comisiones_resumen: comRows[0],
        reservas_pendientes: Number(pendingRows[0].count),
      });
    }

    const supabase = getSupabaseServerClient(true);
    if (supabase) {
      const { data } = await supabase
        .from("choferes")
        .select("*, vehiculos(*)")
        .eq("user_id", auth.userId)
        .single();

      return NextResponse.json({ chofer: data, comisiones_resumen: { total_pendiente: 0, total_pagado: 0 }, reservas_pendientes: 0 });
    }

    return NextResponse.json({ chofer: null });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
