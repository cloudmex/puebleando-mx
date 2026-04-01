import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPool } from "@/lib/db";

/** GET /api/admin/codigos-invitacion — List invitation codes */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const pool = getPool();
    if (!pool) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { rows } = await pool.query(
      `SELECT ci.*,
        c.nombre_completo as usado_por_nombre
       FROM codigos_invitacion ci
       LEFT JOIN choferes c ON c.user_id = ci.usado_por
       ORDER BY ci.created_at DESC`
    );

    return NextResponse.json({ codigos: rows });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST /api/admin/codigos-invitacion — Create invitation code(s) */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { cantidad } = await request.json();
    const count = Math.min(Number(cantidad) || 1, 20);

    const pool = getPool();
    if (!pool) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const codigos: string[] = [];
    for (let i = 0; i < count; i++) {
      const codigo = `PBL-${randomCode(6)}`;
      await pool.query(
        "INSERT INTO codigos_invitacion (codigo, creado_por) VALUES ($1, $2)",
        [codigo, auth.userId]
      );
      codigos.push(codigo);
    }

    return NextResponse.json({ codigos }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function randomCode(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
