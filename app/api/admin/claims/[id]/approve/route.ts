import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPool } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query("SELECT * FROM claims WHERE id = $1", [id]);
      const claim = rows[0];
      if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });

      await pool.query(
        "UPDATE claims SET status='approved', reviewed_by=$1, reviewed_at=NOW() WHERE id=$2",
        [auth.userId, id]
      );

      const table = claim.content_type === "place" ? "places" : "events";
      await pool.query(
        `UPDATE ${table} SET submitted_by=$1 WHERE id=$2`,
        [claim.user_id, claim.content_id]
      );

      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("[admin/claims/approve] pg error", err);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  const supabase = getSupabaseServerClient(true);
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { data: claim, error: fetchErr } = await supabase
    .from("claims").select("*").eq("id", id).single();
  if (fetchErr || !claim) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await supabase.from("claims").update({
    status: "approved",
    reviewed_by: auth.userId,
    reviewed_at: new Date().toISOString(),
  }).eq("id", id);

  const table = claim.content_type === "place" ? "places" : "events";
  await (supabase.from(table as "places") as ReturnType<typeof supabase.from>)
    .update({ submitted_by: claim.user_id })
    .eq("id", claim.content_id);

  return NextResponse.json({ ok: true });
}
