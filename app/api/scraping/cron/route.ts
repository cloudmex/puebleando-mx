/**
 * GET /api/scraping/cron
 *
 * Called by Vercel Cron or an external scheduler. Enqueues jobs for all active
 * sources and triggers one discovery cycle for a random priority location.
 * Returns immediately — the worker process handles actual execution.
 */

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getPool } from "@/lib/db";
import { JobQueue } from "@/lib/scraping/job-queue";
import { SourceDiscoverer } from "@/lib/scraping/discoverer";
import { PRIORITY_LOCATIONS } from "@/lib/scraping/config";
import { ScrapingSource } from "@/types/events";

export async function GET(request: Request) {
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

  const isSupabase = typeof (db as any).from === 'function';

  try {
    // 1. Discovery — pick a random priority location and find new sources
    const randomLocation = PRIORITY_LOCATIONS[Math.floor(Math.random() * PRIORITY_LOCATIONS.length)];
    console.log(`[Cron] Discovery for: ${randomLocation}`);

    let discoveredCount = 0;
    try {
      const discoverer = new SourceDiscoverer(db);
      const result = await discoverer.discoverNewSources(randomLocation);
      discoveredCount = result.nuevas.length;
      console.log(`[Cron] Discovery done — ${discoveredCount} new sources found`);
    } catch (err) {
      console.error("[Cron] Discovery failed (continuing):", err);
    }

    // 2. Enqueue all active sources — the worker will pick them up
    let sources: ScrapingSource[] = [];
    if (isSupabase) {
      const { data, error } = await (db as any)
        .from("scraping_sources")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      sources = data as ScrapingSource[];
    } else {
      const { rows } = await (db as any).query(
        "SELECT * FROM scraping_sources WHERE is_active = true"
      );
      sources = rows as ScrapingSource[];
    }

    if (sources.length === 0) {
      return NextResponse.json({ message: "No active sources to enqueue" });
    }

    const queue = new JobQueue(db);
    const jobIds: string[] = [];
    let enqueueErrors = 0;

    for (const source of sources) {
      try {
        const jobId = await queue.enqueue(source.id);
        jobIds.push(jobId);
      } catch (err: any) {
        console.error(`[Cron] Failed to enqueue ${source.id}:`, err.message);
        enqueueErrors++;
      }
    }

    console.log(`[Cron] Enqueued ${jobIds.length} jobs`);

    return NextResponse.json({
      success: true,
      location_scanned: randomLocation,
      new_sources_discovered: discoveredCount,
      jobs_enqueued: jobIds.length,
      enqueue_errors: enqueueErrors,
      job_ids: jobIds,
    });
  } catch (err: any) {
    console.error("[Cron] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
