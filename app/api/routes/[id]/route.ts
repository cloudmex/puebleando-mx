import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/routes/[id] — obtiene una ruta por id */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Local PostgreSQL ──
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        "SELECT id, name, description, stops, created_at FROM routes WHERE id = $1 AND user_id = $2",
        [id, auth.userId]
      );
      if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ route: rows[0] });
    } catch (err) {
      console.error("[api/routes GET id pg]", err);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  // ── Supabase fallback ──
  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const { data, error } = await supabase
      .from("routes")
      .select("id, name, description, stops, created_at")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .single();

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ route: data });
  }

  return NextResponse.json({ error: "No database configured" }, { status: 503 });
}

/** PATCH /api/routes/[id] — actualiza nombre, descripcion o paradas */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  if (body.stops !== undefined && (!Array.isArray(body.stops) || body.stops.length > 50)) {
    return NextResponse.json({ error: "stops must be an array (max 50)" }, { status: 400 });
  }

  // ── Local PostgreSQL ──
  const pool = getPool();
  if (pool) {
    try {
      const setClauses: string[] = [];
      const values: unknown[] = [];

      if (body.name !== undefined) {
        values.push(body.name);
        setClauses.push(`name = $${values.length}`);
      }
      if (body.description !== undefined) {
        values.push(body.description);
        setClauses.push(`description = $${values.length}`);
      }
      if (body.stops !== undefined) {
        values.push(JSON.stringify(body.stops));
        setClauses.push(`stops = $${values.length}`);
      }

      if (setClauses.length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      }

      values.push(id, auth.userId);
      const { rows } = await pool.query(
        `UPDATE routes SET ${setClauses.join(", ")}
         WHERE id = $${values.length - 1} AND user_id = $${values.length}
         RETURNING id, name, description, stops, created_at`,
        values
      );

      if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ route: rows[0] });
    } catch (err) {
      console.error("[api/routes PATCH pg]", err);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  // ── Supabase fallback ──
  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.stops !== undefined) updates.stops = body.stops;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("routes")
      .update(updates)
      .eq("id", id)
      .eq("user_id", auth.userId)
      .select("id, name, description, stops, created_at")
      .single();

    if (error) {
      console.error("[api/routes PATCH supabase]", error);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ route: data });
  }

  return NextResponse.json({ error: "No database configured" }, { status: 503 });
}

/** DELETE /api/routes/[id] */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Local PostgreSQL ──
  const pool = getPool();
  if (pool) {
    try {
      await pool.query("DELETE FROM routes WHERE id = $1 AND user_id = $2", [id, auth.userId]);
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("[api/routes DELETE pg]", err);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  // ── Supabase fallback ──
  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const { error } = await supabase
      .from("routes")
      .delete()
      .eq("id", id)
      .eq("user_id", auth.userId);

    if (error) {
      console.error("[api/routes DELETE supabase]", error);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "No database configured" }, { status: 503 });
}
