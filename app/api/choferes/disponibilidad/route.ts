import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getChoferByUserId } from "@/lib/auth";
import { getPool } from "@/lib/db";

/** POST /api/choferes/disponibilidad — Toggle chofer availability */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const chofer = await getChoferByUserId(auth.userId);
    if (!chofer || chofer.status !== "activo") {
      return NextResponse.json({ error: "No eres chofer activo" }, { status: 403 });
    }

    const { disponible, notas } = await request.json();

    const pool = getPool();
    if (pool) {
      await pool.query(
        "UPDATE choferes SET disponible = $1, disponibilidad_notas = $2, updated_at = now() WHERE id = $3",
        [disponible, notas || null, chofer.id]
      );
      return NextResponse.json({ ok: true, disponible });
    }

    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
