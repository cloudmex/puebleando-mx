/**
 * POST /api/scraping  — enqueue sources into the job queue (returns immediately)
 * GET  /api/scraping?jobId=xxx — poll job status from DB
 *
 * The actual processing is done by the standalone worker process
 * (scripts/scraping-worker.ts). This route never runs the pipeline itself,
 * so it has no risk of hitting Vercel's function timeout.
 */

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getPool } from "@/lib/db";
import { JobQueue } from "@/lib/scraping/job-queue";
import { ScrapingSource } from "@/types/events";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

function isSupabase(db: SupabaseClient | Pool): db is SupabaseClient {
  return typeof (db as SupabaseClient).from === "function";
}

// ── POST /api/scraping ──────────────────────────────────────────────────────
// Enqueues one specific source (body.sourceId) or all active sources for a
// given location (body.location). Returns the list of enqueued job IDs.

export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  const pool = getPool();
  const db = supabase ?? pool;

  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const sourceId: string | undefined = body?.sourceId;
  const location: string | undefined = body?.location;

  try {
    const sources = sourceId
      ? await querySingleSource(db, sourceId)
      : await queryActiveSources(db, location);

    if (sources.length === 0) {
      return NextResponse.json({ message: "No active sources found", jobIds: [] });
    }

    const queue = new JobQueue(db);
    const jobIds: string[] = [];

    for (const source of sources) {
      try {
        const jobId = await queue.enqueue(source.id);
        jobIds.push(jobId);
      } catch (err: any) {
        console.error(`[API] Failed to enqueue source ${source.id}:`, err.message);
      }
    }

    return NextResponse.json({
      status: "queued",
      message: `${jobIds.length} job(s) added to queue. The worker will process them shortly.`,
      jobIds,
    });
  } catch (err: any) {
    console.error("[API] Enqueue error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── GET /api/scraping?jobId=xxx ─────────────────────────────────────────────
// Returns the current status of a specific job, read directly from the DB.
// Poll this every few seconds to track progress.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const pool = getPool();
  const db = supabase ?? pool;

  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const queue = new JobQueue(db);
  const job = await queue.getStatus(jobId);

  if (!job) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    source_id: job.source_id,
    started_at: job.started_at,
    finished_at: job.finished_at,
    new_events: job.new_events ?? 0,
    failed_events: job.failed_events ?? 0,
    total_scraped: job.total_scraped ?? 0,
    error: job.error_message ?? null,
  });
}

// ── DB helpers ───────────────────────────────────────────────────────────────

async function querySingleSource(
  db: SupabaseClient | Pool,
  sourceId: string
): Promise<ScrapingSource[]> {
  if (isSupabase(db)) {
    const { data } = await db
      .from("scraping_sources")
      .select("*")
      .eq("id", sourceId)
      .single();
    return data ? [data as ScrapingSource] : [];
  }
  const { rows } = await (db as Pool).query(
    "SELECT * FROM scraping_sources WHERE id = $1",
    [sourceId]
  );
  return rows as ScrapingSource[];
}

async function queryActiveSources(
  db: SupabaseClient | Pool,
  location?: string
): Promise<ScrapingSource[]> {
  if (isSupabase(db)) {
    let q = db.from("scraping_sources").select("*").eq("is_active", true);
    if (location) q = q.ilike("target_location", `%${location}%`);
    const { data } = await q;
    return (data ?? []) as ScrapingSource[];
  }
  const { rows } = await (db as Pool).query(
    location
      ? "SELECT * FROM scraping_sources WHERE is_active = true AND target_location ILIKE $1"
      : "SELECT * FROM scraping_sources WHERE is_active = true",
    location ? [`%${location}%`] : []
  );
  return rows as ScrapingSource[];
}
