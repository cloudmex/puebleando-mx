/**
 * Scraping Worker — standalone process
 *
 * Run with:
 *   npm run worker
 *
 * Or with PM2 for production:
 *   pm2 start "npm run worker" --name scraping-worker
 *
 * Responsibilities:
 *  1. On startup: recover jobs stuck in 'running' from a prior crash
 *  2. Poll the queue every POLL_INTERVAL_MS
 *  3. Process one job at a time (avoids hammering Groq rate limits)
 *  4. Graceful shutdown on SIGTERM / SIGINT
 *
 * Environment variables required (same as the Next.js app):
 *  DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
 *  GROQ_API_KEY, NEXT_PUBLIC_MAPBOX_TOKEN, CLOUDFLARE_API_TOKEN, etc.
 */

// Load .env.local so the worker can run standalone without Next.js
import { config } from 'dotenv';
config({ path: '.env.local' });

import { JobQueue } from '../lib/scraping/job-queue';
import { ScrapingOrchestrator } from '../lib/scraping/orchestrator';
import { getSupabaseClient } from '../lib/supabase';
import { getPool } from '../lib/db';

// ── Config ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS  = 5_000;   // how often to check for new jobs when idle
const STUCK_TIMEOUT_MIN = 20;      // jobs running longer than this are re-queued
const MAX_JOB_DURATION  = 15 * 60 * 1000; // hard per-job timeout (15 min)

// ── State ───────────────────────────────────────────────────────────────────

let running = true;
let currentJobId: string | null = null;

// ── Graceful shutdown ────────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  console.log('[Worker] SIGTERM received — will stop after current job finishes');
  running = false;
});
process.on('SIGINT', () => {
  console.log('[Worker] SIGINT received — will stop after current job finishes');
  running = false;
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main loop ────────────────────────────────────────────────────────────────

async function main() {
  // Connect to DB — prefer Supabase, fall back to raw PG pool
  const supabase = getSupabaseClient();
  const pool = getPool();
  const db = supabase ?? pool;

  if (!db) {
    console.error('[Worker] No database configured. Set DATABASE_URL or Supabase env vars.');
    process.exit(1);
  }

  const queue       = new JobQueue(db);
  const orchestrator = new ScrapingOrchestrator(db);

  console.log('[Worker] Starting up…');

  // Recover jobs that were 'running' when a previous worker instance crashed
  await queue.recoverStuckJobs(STUCK_TIMEOUT_MIN);

  console.log(`[Worker] Polling for jobs every ${POLL_INTERVAL_MS / 1000}s`);

  while (running) {
    try {
      const job = await queue.claimNext();

      if (!job) {
        // Queue is empty — wait before polling again
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      currentJobId = job.id;
      console.log(`[Worker] Processing job ${job.id} for source ${job.source_id}`);

      // Wrap in a per-job timeout so a hung crawl can't block the worker forever
      const jobPromise = orchestrator.runJob(job.source_id, job.id);
      const timeoutPromise = sleep(MAX_JOB_DURATION).then(() => {
        throw new Error(`Job timed out after ${MAX_JOB_DURATION / 60000} minutes`);
      });

      await Promise.race([jobPromise, timeoutPromise]);

      console.log(`[Worker] Job ${job.id} completed`);
    } catch (err: any) {
      console.error(`[Worker] Job ${currentJobId ?? '?'} failed:`, err.message);
      // The orchestrator marks the job as 'failed' on its own error path.
      // If the timeout fired before the orchestrator could do it, we don't
      // double-update (the orchestrator's catch block will handle it or the
      // recoverStuckJobs will pick it up on next startup).
    } finally {
      currentJobId = null;
      // Small pause between jobs to avoid flooding APIs
      await sleep(1000);
    }
  }

  console.log('[Worker] Shutdown complete');
  process.exit(0);
}

main().catch(err => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
