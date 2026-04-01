import ExplorarClient from "./ExplorarClient";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPool } from "@/lib/db";
import type { Place } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explorar Guadalajara — Puebleando",
  description: "Descubre los mejores lugares de Guadalajara, Tlaquepaque, Zapopan, Tequila y más.",
};

async function getDefaultPlaces(): Promise<Place[]> {
  const sb = getSupabaseServerClient(false);
  if (sb) {
    const { data } = await sb
      .from("places")
      .select("*")
      .eq("state", "Jalisco")
      .order("importance_score", { ascending: false, nullsFirst: false })
      .limit(48);
    // Fallback to all places if no Jalisco ones
    if (data && data.length > 0) return data as Place[];
    const { data: all } = await sb
      .from("places")
      .select("*")
      .order("importance_score", { ascending: false, nullsFirst: false })
      .limit(48);
    return (all ?? []) as Place[];
  }
  const pool = getPool();
  if (pool) {
    const { rows } = await pool.query(
      "SELECT * FROM places WHERE state = 'Jalisco' ORDER BY importance_score DESC NULLS LAST LIMIT 48"
    );
    if (rows.length > 0) return rows as Place[];
    const { rows: all } = await pool.query(
      "SELECT * FROM places ORDER BY importance_score DESC NULLS LAST LIMIT 48"
    );
    return all as Place[];
  }
  return [];
}

export default async function ExplorarPage() {
  const defaultPlaces = await getDefaultPlaces();
  return <ExplorarClient defaultPlaces={defaultPlaces} />;
}
