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
    const { location } = await request.json().catch(() => ({ location: "México" }));
    
    const discoverer = new SourceDiscoverer(db);
    const newSources = await discoverer.discoverNewSources(location || "México");

    return NextResponse.json({ 
      success: true, 
      discovered: newSources.length,
      sources: newSources
    });
  } catch (err: any) {
    console.error("Discovery API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
