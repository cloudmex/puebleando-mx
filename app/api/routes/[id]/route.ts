import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPool } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/routes/[id] — actualiza nombre, descripción o paradas */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 });

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

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ route: rows[0] });
  } catch (err) {
    console.error("[api/routes PATCH]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE /api/routes/[id] */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 });

  try {
    await pool.query(
      "DELETE FROM routes WHERE id = $1 AND user_id = $2",
      [id, auth.userId]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/routes DELETE]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
