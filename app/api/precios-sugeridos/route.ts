import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/** GET /api/precios-sugeridos — Get suggested price ranges */
export async function GET() {
  try {
    const pool = getPool();
    if (pool) {
      const { rows } = await pool.query(
        "SELECT * FROM precios_sugeridos WHERE activo = true ORDER BY zona, duracion_horas"
      );
      return NextResponse.json({ precios: rows });
    }

    const supabase = getSupabaseServerClient(true);
    if (supabase) {
      const { data } = await supabase
        .from("precios_sugeridos")
        .select("*")
        .eq("activo", true)
        .order("zona")
        .order("duracion_horas");
      return NextResponse.json({ precios: data ?? [] });
    }

    return NextResponse.json({ precios: [] });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
