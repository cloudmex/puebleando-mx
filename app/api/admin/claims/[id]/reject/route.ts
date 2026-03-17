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
  const body = await request.json().catch(() => ({}));
  const adminNote = body.admin_note ?? null;

  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        "UPDATE claims SET status='rejected', reviewed_by=$1, reviewed_at=NOW(), admin_note=$2 WHERE id=$3",
        [auth.userId, adminNote, id]
      );
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("[admin/claims/reject] pg error", err);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  const supabase = getSupabaseServerClient(true);
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  await supabase.from("claims").update({
    status: "rejected",
    reviewed_by: auth.userId,
    reviewed_at: new Date().toISOString(),
    admin_note: adminNote,
  }).eq("id", id);

  return NextResponse.json({ ok: true });
}
