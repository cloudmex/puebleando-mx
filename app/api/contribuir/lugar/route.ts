import { NextRequest, NextResponse } from "next/server";
import { requireAuth, canAutoPublish } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPool } from "@/lib/db";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.name || !body.category || !body.latitude || !body.longitude) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Coordenadas inválidas" }, { status: 400 });
  }
  if (String(body.name).trim().length > 200) {
    return NextResponse.json({ error: "Nombre demasiado largo (máx 200)" }, { status: 400 });
  }

  const payload = {
    name: String(body.name).trim(),
    description: String(body.description ?? ""),
    category: String(body.category),
    latitude: lat,
    longitude: lng,
    photos: Array.isArray(body.photos) ? body.photos.slice(0, 20) : [],
    town: String(body.town ?? ""),
    state: String(body.state ?? ""),
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 20) : [],
  };

  const autoPublish = canAutoPublish(auth.profile);

  if (autoPublish) {
    // Insert directly into places
    const pool = getPool();
    if (pool) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO places (id, name, description, category, latitude, longitude, photos, town, state, tags, submitted_by, status)
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'publicado') RETURNING id`,
          [
            payload.name, payload.description, payload.category,
            payload.latitude, payload.longitude,
            payload.photos, payload.town, payload.state,
            payload.tags, auth.userId,
          ]
        );
        return NextResponse.json({ published: true, id: String(rows[0].id) });
      } catch (err) {
        console.error("[contribuir/lugar] pg insert error", err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
    }

    const supabase = getSupabaseServerClient(true);
    if (supabase) {
      const { data, error } = await supabase.from("places").insert({
        ...payload,
        submitted_by: auth.userId,
        status: "publicado",
      }).select("id").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ published: true, id: data.id });
    }
  }

  // Queue as pending submission
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO content_submissions (user_id, content_type, payload) VALUES ($1, 'place', $2) RETURNING id`,
        [auth.userId, JSON.stringify(payload)]
      );
      return NextResponse.json({ pendiente: true, submissionId: String(rows[0].id) });
    } catch (err) {
      console.error("[contribuir/lugar] pg submission error", err);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const { data, error } = await supabase.from("content_submissions").insert({
      user_id: auth.userId,
      content_type: "place",
      payload,
    }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ pendiente: true, submissionId: data.id });
  }

  return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
}
