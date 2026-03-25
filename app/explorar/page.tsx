import ExplorarClient from "./ExplorarClient";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPool } from "@/lib/db";
import type { Place } from "@/types";

async function getDefaultPlaces(): Promise<Place[]> {
  const sb = getSupabaseServerClient(false);
  if (sb) {
    const { data } = await sb
      .from("places")
      .select("*")
      .order("importance_score", { ascending: false, nullsFirst: false })
      .limit(48);
    return (data ?? []) as Place[];
  }
  const pool = getPool();
  if (pool) {
    const { rows } = await pool.query(
      "SELECT * FROM places ORDER BY importance_score DESC NULLS LAST LIMIT 48"
    );
    return rows as Place[];
  }
  return [];
}

export default async function ExplorarPage() {
  const defaultPlaces = await getDefaultPlaces();
  return <ExplorarClient defaultPlaces={defaultPlaces} />;
}
