import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPool } from "@/lib/db";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.content_type || !body.content_id) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  if (!["place", "event"].includes(body.content_type)) {
    return NextResponse.json({ error: "content_type inválido" }, { status: 400 });
  }

  const pool = getPool();
  if (pool) {
    try {
      // Check for duplicate pending claim
      const { rows: existing } = await pool.query(
        "SELECT id FROM claims WHERE user_id=$1 AND content_type=$2 AND content_id=$3 AND status='pending'",
        [auth.userId, body.content_type, body.content_id]
      );
      if (existing.length > 0) {
        return NextResponse.json({ error: "Ya tienes una solicitud pendiente para este contenido" }, { status: 409 });
      }

      const { rows } = await pool.query(
        "INSERT INTO claims (user_id, content_type, content_id, reason) VALUES ($1,$2,$3,$4) RETURNING id",
        [auth.userId, body.content_type, body.content_id, body.reason ?? null]
      );
      return NextResponse.json({ claimId: String(rows[0].id) });
    } catch (err) {
      console.error("[claims] pg error", err);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  const supabase = getSupabaseServerClient(true);
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  // Check duplicate
  const { data: existing } = await supabase
    .from("claims")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("content_type", body.content_type)
    .eq("content_id", body.content_id)
    .eq("status", "pending");

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Ya tienes una solicitud pendiente para este contenido" }, { status: 409 });
  }

  const { data, error } = await supabase.from("claims").insert({
    user_id: auth.userId,
    content_type: body.content_type,
    content_id: body.content_id,
    reason: body.reason ?? null,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ claimId: data.id });
}
