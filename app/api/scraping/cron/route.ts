import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getPool } from "@/lib/db";
import { ScrapingOrchestrator } from "@/lib/scraping/orchestrator";
import { SourceDiscoverer } from "@/lib/scraping/discoverer";
import { PRIORITY_LOCATIONS } from "@/lib/scraping/config";
import { ScrapingSource } from "@/types/events";

export async function GET(request: Request) {
  // Check for Vercel Cron secret or other auth if needed
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = getSupabaseClient();
  const pool = getPool();
  const db = supabase || pool;

  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const orchestrator = new ScrapingOrchestrator(db);
    const discoverer = new SourceDiscoverer(db);
    
    // 1. PHASE 1: Automatic Discovery (Pick a random priority location)
    const randomLocation = PRIORITY_LOCATIONS[Math.floor(Math.random() * PRIORITY_LOCATIONS.length)];
    console.log(`[Cron] Starting auto-discovery for: ${randomLocation}`);
    
    try {
      const discoveryResult = await discoverer.discoverNewSources(randomLocation);
      console.log(`[Cron] Discovery finished. New: ${discoveryResult.nuevas.length}, Existentes: ${discoveryResult.existentes_sources.length}`);
    } catch (discErr) {
      console.error("[Cron] Discovery phase failed (skipping):", discErr);
    }

    // 2. PHASE 2: Running Jobs
    let sources: ScrapingSource[] = [];

    // Fetch all active sources (including newly discovered ones)
    if (supabase) {
      const { data, error } = await supabase
        .from("scraping_sources")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      sources = data as ScrapingSource[];
    } else {
      const { rows } = await pool!.query("SELECT * FROM scraping_sources WHERE is_active = true");
      sources = rows as ScrapingSource[];
    }

    if (sources.length === 0) {
      return NextResponse.json({ message: "No active sources found" });
    }

    const results = [];

    for (const source of sources) {
      try {
        const jobId = await orchestrator.runJob(source.id);
        results.push({ sourceId: source.id, jobId, status: "success" });
      } catch (err: any) {
        results.push({ sourceId: source.id, error: err.message, status: "failed" });
      }
    }

    return NextResponse.json({ 
      success: true, 
      location_scanned: randomLocation,
      results 
    });
  } catch (err: any) {
    console.error("Cron API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
