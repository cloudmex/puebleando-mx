import { Place } from "@/types";
import { Event } from "@/types/events";
import { PLACES } from "./data";
import { getPool } from "./db";
import { getSupabaseClient } from "./supabase";

/**
 * Provider selection (first match wins):
 *   DATABASE_URL             → PostgreSQL local (pg)
 *   NEXT_PUBLIC_SUPABASE_URL → Supabase (production)
 *   (none)                   → mock data
 */
function rowToPlace(row: Record<string, unknown>): Place {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    category: row.category as Place["category"],
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    photos: Array.isArray(row.photos) ? (row.photos as string[]) : [],
    town: String(row.town ?? ""),
    state: String(row.state ?? ""),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    created_at: String(row.created_at ?? ""),
  };
}

function rowToEvent(row: Record<string, unknown>): Event {
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    description: String(row.description ?? ""),
    short_description: String(row.short_description ?? ""),
    source_name: String(row.source_name ?? ""),
    source_url: String(row.source_url ?? ""),
    source_type: String(row.source_type ?? "web"),
    category: String(row.category ?? ""),
    subcategory: String(row.subcategory ?? ""),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    start_date: row.start_date instanceof Date ? row.start_date.toISOString() : String(row.start_date),
    end_date: row.end_date instanceof Date ? row.end_date.toISOString() : (row.end_date ? String(row.end_date) : undefined),
    time_text: String(row.time_text ?? ""),
    venue_name: String(row.venue_name ?? ""),
    address: String(row.address ?? ""),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    country: String(row.country ?? "México"),
    latitude: row.latitude ? Number(row.latitude) : undefined,
    longitude: row.longitude ? Number(row.longitude) : undefined,
    price_text: String(row.price_text ?? ""),
    is_free: Boolean(row.is_free),
    image_url: String(row.image_url ?? ""),
    scraped_at: row.scraped_at instanceof Date ? row.scraped_at.toISOString() : String(row.scraped_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    published_at: row.published_at instanceof Date ? row.published_at.toISOString() : (row.published_at ? String(row.published_at) : undefined),
    status: row.status as Event["status"],
    confidence_score: Number(row.confidence_score ?? 0),
    importance_score: row.importance_score != null ? Number(row.importance_score) : undefined,
    dedup_hash: String(row.dedup_hash ?? ""),
  };
}

export async function getPlaces(): Promise<Place[]> {
  // 1. Local PostgreSQL
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM places ORDER BY created_at ASC"
      );
      if (rows.length > 0) return rows.map(rowToPlace);
    } catch (err) {
      console.warn("[puebleando] pg getPlaces failed, using mock data.", err);
    }
    return PLACES;
  }

  // 2. Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("places")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data && data.length > 0) return data.map(rowToPlace);
    console.warn("[puebleando] Supabase getPlaces failed or empty, using mock data.", error?.message);
    return PLACES;
  }

  // 3. Mock data
  return PLACES;
}

export async function getPlace(id: string): Promise<Place | null> {
  // 1. Local PostgreSQL
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM places WHERE id = $1",
        [id]
      );
      if (rows[0]) return rowToPlace(rows[0]);
    } catch (err) {
      console.warn("[puebleando] pg getPlace failed, trying mock.", err);
    }
    return PLACES.find((p) => p.id === id) ?? null;
  }

  // 2. Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("places")
      .select("*")
      .eq("id", id)
      .single();
    if (!error && data) return rowToPlace(data);
    return PLACES.find((p) => p.id === id) ?? null;
  }

  // 3. Mock data
  return PLACES.find((p) => p.id === id) ?? null;
}

export async function getEvent(idOrSlug: string): Promise<Event | null> {
  // 1. Local PostgreSQL
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM events WHERE id = $1 OR slug = $1",
        [idOrSlug]
      );
      if (rows[0]) return rowToEvent(rows[0]);
    } catch (err) {
      console.warn("[puebleando] pg getEvent failed.", err);
    }
    return null;
  }

  // 2. Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
      .single();
    if (!error && data) return rowToEvent(data);
  }

  return null;
}

export async function getEvents(): Promise<Event[]> {
  // 1. Local PostgreSQL
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM events
         WHERE status IN ('publicado', 'nuevo')
           AND start_date >= NOW() - INTERVAL '1 hour'
         ORDER BY start_date ASC
         LIMIT 1000`
      );
      console.log(`[queries] Found ${rows.length} upcoming events in local PG`);
      return rows.map(rowToEvent);
    } catch (err) {
      console.warn("[puebleando] pg getEvents failed.", err);
    }
  }

  // 2. Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    const cutoff = new Date(Date.now() - 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .in("status", ["publicado", "nuevo"])
      .gte("start_date", cutoff)
      .order("start_date", { ascending: true })
      .limit(1000);
    if (!error && data) {
      console.log(`[queries] Found ${data.length} events in Supabase`);
      return data.map(rowToEvent);
    }
    console.warn("[puebleando] Supabase getEvents failed or empty.", error?.message);
  }
  console.log("[queries] No events found in either DB");
  return [];
}
