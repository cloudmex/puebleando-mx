import { Place } from "@/types";
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
