import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPool } from "@/lib/db";
import { TrustLevel } from "@/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const trustLevel = body.trust_level as TrustLevel;

  if (!["new", "verified", "admin"].includes(trustLevel)) {
    return NextResponse.json({ error: "Invalid trust_level" }, { status: 400 });
  }

  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        "UPDATE user_profiles SET trust_level=$1, updated_at=NOW() WHERE id=$2",
        [trustLevel, id]
      );
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("[admin/users/trust] pg error", err);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  const supabase = getSupabaseServerClient(true);
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  await supabase.from("user_profiles").update({
    trust_level: trustLevel,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  return NextResponse.json({ ok: true });
}
