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
        SELECT c.*, up.display_name as user_name
        FROM claims c
        JOIN user_profiles up ON c.user_id = up.id
        WHERE c.status = 'pending'
        ORDER BY c.created_at ASC
      `);
      return NextResponse.json({ claims: rows });
    } catch (err) {
      console.error("[admin/claims] pg error", err);
    }
  }

  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const { data, error } = await supabase
      .from("claims")
      .select("*, user_profiles(display_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (!error && data) return NextResponse.json({ claims: data });
  }

  return NextResponse.json({ claims: [] });
}
