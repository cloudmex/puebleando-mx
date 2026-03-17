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
  const reviewerNote = body.reviewer_note ?? null;

  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        `UPDATE content_submissions SET status='rechazado', reviewed_by=$1, reviewed_at=NOW(), reviewer_note=$2 WHERE id=$3`,
        [auth.userId, reviewerNote, id]
      );
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("[admin/submissions/reject] pg error", err);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  const supabase = getSupabaseServerClient(true);
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  await supabase.from("content_submissions").update({
    status: "rechazado",
    reviewed_by: auth.userId,
    reviewed_at: new Date().toISOString(),
    reviewer_note: reviewerNote,
  }).eq("id", id);

  return NextResponse.json({ ok: true });
}
