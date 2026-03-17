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
      const { rows } = await pool.query(
        "SELECT * FROM content_submissions WHERE id = $1",
        [id]
      );
      const submission = rows[0];
      if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const payload = submission.payload as Record<string, unknown>;
      let publishedId: string | null = null;

      if (submission.content_type === "place") {
        const { rows: inserted } = await pool.query(
          `INSERT INTO places (name, description, category, latitude, longitude, photos, town, state, tags, submitted_by, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'publicado') RETURNING id`,
          [
            payload.name, payload.description, payload.category,
            payload.latitude, payload.longitude, JSON.stringify(payload.photos ?? []),
            payload.town, payload.state, JSON.stringify(payload.tags ?? []),
            submission.user_id,
          ]
        );
        publishedId = String(inserted[0].id);
      } else {
        const { rows: inserted } = await pool.query(
          `INSERT INTO events (title, slug, description, category, start_date, end_date, venue_name, city, state, is_free, price_text, image_url, submitted_by, status, source_name, source_type, source_url, scraped_at, updated_at, confidence_score)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'publicado','manual','manual','',NOW(),NOW(),1) RETURNING id`,
          [
            payload.title, payload.slug ?? String(payload.title).toLowerCase().replace(/\s+/g, "-"),
            payload.description, payload.category, payload.start_date, payload.end_date ?? null,
            payload.venue_name, payload.city, payload.state, payload.is_free ?? false,
            payload.price_text ?? "", payload.image_url ?? "", submission.user_id,
          ]
        );
        publishedId = String(inserted[0].id);
      }

      await pool.query(
        `UPDATE content_submissions SET status='publicado', published_id=$1, reviewed_by=$2, reviewed_at=NOW(), reviewer_note=$3 WHERE id=$4`,
        [publishedId, auth.userId, reviewerNote, id]
      );

      return NextResponse.json({ ok: true, publishedId });
    } catch (err) {
      console.error("[admin/submissions/approve] pg error", err);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  const supabase = getSupabaseServerClient(true);
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { data: submission, error: fetchErr } = await supabase
    .from("content_submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = submission.payload as Record<string, unknown>;
  let publishedId: string | null = null;

  if (submission.content_type === "place") {
    const { data: inserted } = await supabase.from("places").insert({
      name: payload.name, description: payload.description, category: payload.category,
      latitude: payload.latitude, longitude: payload.longitude, photos: payload.photos ?? [],
      town: payload.town, state: payload.state, tags: payload.tags ?? [],
      submitted_by: submission.user_id, status: "publicado",
    }).select("id").single();
    publishedId = inserted?.id ?? null;
  } else {
    const { data: inserted } = await supabase.from("events").insert({
      title: payload.title,
      slug: payload.slug ?? String(payload.title).toLowerCase().replace(/\s+/g, "-"),
      description: payload.description, category: payload.category,
      start_date: payload.start_date, end_date: payload.end_date,
      venue_name: payload.venue_name, city: payload.city, state: payload.state,
      is_free: payload.is_free ?? false, price_text: payload.price_text ?? "",
      image_url: payload.image_url ?? "", submitted_by: submission.user_id,
      status: "publicado", source_name: "manual", source_type: "manual", source_url: "",
      scraped_at: new Date().toISOString(), updated_at: new Date().toISOString(), confidence_score: 1,
    }).select("id").single();
    publishedId = inserted?.id ?? null;
  }

  await supabase.from("content_submissions").update({
    status: "publicado", published_id: publishedId,
    reviewed_by: auth.userId, reviewed_at: new Date().toISOString(),
    reviewer_note: reviewerNote,
  }).eq("id", id);

  return NextResponse.json({ ok: true, publishedId });
}
