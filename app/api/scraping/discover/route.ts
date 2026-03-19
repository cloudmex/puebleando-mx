import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getPool } from "@/lib/db";
import { SourceDiscoverer } from "@/lib/scraping/discoverer";

export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  const pool = getPool();
  const db = supabase || pool;

  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const reqData = await request.json().catch(() => ({ location: "México", attempt: 1 }));
    const location = reqData.location || "México";
    const attempt = reqData.attempt || 1;

    const discoverer = new SourceDiscoverer(db);
    const result = await discoverer.discoverNewSources(location, attempt);

    return NextResponse.json({
      success: true,
      discovered: result.nuevas.length,
      sources: [...result.nuevas, ...result.existentes_sources],
      // Extra breakdown so the UI can show meaningful feedback
      existentes: result.existentes_sources.length,
      invalidas: result.invalidas.length,
      detalle: {
        existentes: result.existentes_sources.map((s: any) => s.base_url),
        invalidas: result.invalidas,
      },
    });
  } catch (err: any) {
    console.error("Discovery API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
