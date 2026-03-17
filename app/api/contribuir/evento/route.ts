import { NextRequest, NextResponse } from "next/server";
import { requireAuth, canAutoPublish } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPool } from "@/lib/db";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    + "-" + Date.now();
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.title || !body.start_date || !body.category) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const payload = {
    title: String(body.title),
    slug: slugify(String(body.title)),
    description: String(body.description ?? ""),
    category: String(body.category),
    start_date: String(body.start_date),
    end_date: body.end_date ? String(body.end_date) : null,
    venue_name: String(body.venue_name ?? ""),
    city: String(body.city ?? ""),
    state: String(body.state ?? ""),
    is_free: Boolean(body.is_free),
    price_text: String(body.price_text ?? ""),
    image_url: String(body.image_url ?? ""),
    latitude: body.latitude ? Number(body.latitude) : null,
    longitude: body.longitude ? Number(body.longitude) : null,
    tags: Array.isArray(body.tags) ? body.tags : [],
  };

  const autoPublish = canAutoPublish(auth.profile);

  if (autoPublish) {
    const pool = getPool();
    if (pool) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO events (id, title, slug, description, category, start_date, end_date, venue_name, city, state, is_free, price_text, image_url, latitude, longitude, submitted_by, status, source_name, source_type, source_url, scraped_at, updated_at, confidence_score)
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'publicado','manual','manual','',NOW(),NOW(),1) RETURNING id`,
          [
            payload.title, payload.slug, payload.description, payload.category,
            payload.start_date, payload.end_date, payload.venue_name, payload.city,
            payload.state, payload.is_free, payload.price_text, payload.image_url,
            payload.latitude, payload.longitude, auth.userId,
          ]
        );
        return NextResponse.json({ published: true, id: String(rows[0].id) });
      } catch (err: any) {
        console.error("[contribuir/evento] pg insert error", err);
        return NextResponse.json({ error: "Server error: " + err.message }, { status: 500 });
      }
    }

    const supabase = getSupabaseServerClient(true);
    if (supabase) {
      const { data, error } = await supabase.from("events").insert({
        ...payload,
        submitted_by: auth.userId,
        status: "publicado",
        source_name: "manual",
        source_type: "manual",
        source_url: "",
        scraped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        confidence_score: 1,
      }).select("id").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ published: true, id: data.id });
    }
  }

  // Queue as pending
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO content_submissions (user_id, content_type, payload) VALUES ($1, 'event', $2) RETURNING id`,
        [auth.userId, JSON.stringify(payload)]
      );
      return NextResponse.json({ pendiente: true, submissionId: String(rows[0].id) });
    } catch (err) {
      console.error("[contribuir/evento] pg submission error", err);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const { data, error } = await supabase.from("content_submissions").insert({
      user_id: auth.userId,
      content_type: "event",
      payload,
    }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ pendiente: true, submissionId: data.id });
  }

  return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
}
