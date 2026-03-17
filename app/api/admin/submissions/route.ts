import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPool } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(`
        SELECT cs.*, up.display_name as user_name, up.trust_level
        FROM content_submissions cs
        JOIN user_profiles up ON cs.user_id = up.id
        WHERE cs.status = 'pendiente_revision'
        ORDER BY cs.created_at ASC
      `);
      return NextResponse.json({ submissions: rows });
    } catch (err) {
      console.error("[admin/submissions] pg error", err);
    }
  }

  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const { data, error } = await supabase
      .from("content_submissions")
      .select("*, user_profiles(display_name, trust_level)")
      .eq("status", "pendiente_revision")
      .order("created_at", { ascending: true });
    if (!error && data) return NextResponse.json({ submissions: data });
  }

  return NextResponse.json({ submissions: [] });
}
