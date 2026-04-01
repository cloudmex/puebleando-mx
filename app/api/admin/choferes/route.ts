import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPool } from "@/lib/db";

/** GET /api/admin/choferes — List all choferes (admin) */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const status = request.nextUrl.searchParams.get("status") || "en_revision";

    const pool = getPool();
    if (!pool) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { rows } = await pool.query(
      `SELECT c.*,
        json_build_object(
          'id', v.id, 'marca', v.marca, 'modelo', v.modelo, 'anio', v.anio,
          'color', v.color, 'capacidad_pasajeros', v.capacidad_pasajeros
        ) AS vehiculo,
        (SELECT COALESCE(SUM(CASE WHEN com.status = 'pendiente' THEN com.monto ELSE 0 END), 0)
         FROM comisiones com WHERE com.chofer_id = c.id) as comisiones_pendientes
       FROM choferes c
       LEFT JOIN vehiculos v ON v.chofer_id = c.id AND v.activo = true
       WHERE c.status = $1
       ORDER BY c.created_at DESC`,
      [status]
    );

    return NextResponse.json({ choferes: rows });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
