import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getPool } from "@/lib/db";
import { ScrapingOrchestrator } from "@/lib/scraping/orchestrator";

export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  const pool = getPool();
  const db = supabase || pool;

  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const { sourceId } = await request.json();
    if (!sourceId) {
      return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
    }

    const orchestrator = new ScrapingOrchestrator(db);

    // Fire-and-forget: Apify/Cloudflare pueden tardar minutos.
    // No bloqueamos el request HTTP — el job corre en background y guarda eventos en DB.
    orchestrator.runJob(sourceId)
      .then(({ newEvents }) => {
        console.log(`[Crawl] Job done for source ${sourceId}: ${newEvents} new events`);
      })
      .catch((err) => {
        console.error(`[Crawl] Job failed for source ${sourceId}:`, err.message);
      });

    return NextResponse.json({ success: true, started: true, newEvents: 0 });
  } catch (err: any) {
    console.error("Scraping crawl start error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
