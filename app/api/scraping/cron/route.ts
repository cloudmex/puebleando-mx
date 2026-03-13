import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getPool } from "@/lib/db";
import { ScrapingOrchestrator } from "@/lib/scraping/orchestrator";
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
    let sources: ScrapingSource[] = [];

    // Fetch all active sources
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

    const orchestrator = new ScrapingOrchestrator(db);
    const results = [];

    for (const source of sources) {
      try {
        const jobId = await orchestrator.runJob(source.id);
        results.push({ sourceId: source.id, jobId, status: "success" });
      } catch (err: any) {
        results.push({ sourceId: source.id, error: err.message, status: "failed" });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("Cron API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
