import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getSupabaseClient } from "@/lib/supabase";
import { PLACES, CATEGORIES } from "@/lib/data";

/**
 * POST /api/seed
 * Populates the database (pg or Supabase) with mock data.
 *
 * Development:  curl -X POST http://localhost:3000/api/seed
 * Production:   curl -X POST https://tu-app.vercel.app/api/seed \
 *                 -H "Content-Type: application/json" \
 *                 -d '{"secret":"TU_SEED_SECRET"}'
 */
export async function POST(req: Request) {
  // Basic protection in production
  if (process.env.NODE_ENV === "production") {
    const { secret } = await req.json().catch(() => ({}));
    if (secret !== process.env.SEED_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // ── Provider: local PostgreSQL ────────────────────────────
  const pool = getPool();
  if (pool) {
    try {
      // Categories
      for (const cat of CATEGORIES) {
        await pool.query(
          `INSERT INTO categories (id, name, icon, color)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE
             SET name = EXCLUDED.name,
                 icon = EXCLUDED.icon,
                 color = EXCLUDED.color`,
          [cat.id, cat.name, cat.icon, cat.color]
        );
      }

      // Places
      for (const place of PLACES) {
        await pool.query(
          `INSERT INTO places (id, name, description, category, latitude, longitude, photos, town, state, tags)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (id) DO UPDATE
             SET name        = EXCLUDED.name,
                 description = EXCLUDED.description,
                 category    = EXCLUDED.category,
                 latitude    = EXCLUDED.latitude,
                 longitude   = EXCLUDED.longitude,
                 photos      = EXCLUDED.photos,
                 town        = EXCLUDED.town,
                 state       = EXCLUDED.state,
                 tags        = EXCLUDED.tags`,
          [
            place.id,
            place.name,
            place.description,
            place.category,
            place.latitude,
            place.longitude,
            place.photos,
            place.town,
            place.state,
            place.tags,
          ]
        );
      }

      return NextResponse.json({
        ok: true,
        provider: "postgresql",
        inserted: { categories: CATEGORIES.length, places: PLACES.length },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── Provider: Supabase ────────────────────────────────────
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error: catError } = await supabase
      .from("categories")
      .upsert(CATEGORIES, { onConflict: "id" });
    if (catError) {
      return NextResponse.json({ error: catError.message, step: "categories" }, { status: 500 });
    }

    const placesToInsert = PLACES.map(({ created_at: _, ...p }) => p);
    const { error: placesError } = await supabase
      .from("places")
      .upsert(placesToInsert, { onConflict: "id" });
    if (placesError) {
      return NextResponse.json({ error: placesError.message, step: "places" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      provider: "supabase",
      inserted: { categories: CATEGORIES.length, places: PLACES.length },
    });
  }

  // ── No provider configured ────────────────────────────────
  return NextResponse.json(
    { error: "No database configured. Set DATABASE_URL (local) or NEXT_PUBLIC_SUPABASE_URL (production)." },
    { status: 400 }
  );
}
