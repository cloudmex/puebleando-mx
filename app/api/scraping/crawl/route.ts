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
    const jobId = await orchestrator.runJob(sourceId);

    return NextResponse.json({ success: true, jobId });
  } catch (err: any) {
    console.error("Scraping API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
