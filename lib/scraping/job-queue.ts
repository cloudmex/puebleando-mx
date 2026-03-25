/**
 * JobQueue
 *
 * Thin wrapper over the existing `scraping_jobs` table that turns it into a
 * proper work queue. Works with both Supabase (RLS-safe) and a raw PG pool.
 *
 * Lifecycle:
 *   enqueue()     → status: 'queued'
 *   claimNext()   → status: 'running'  (atomic; safe for concurrent workers)
 *   orchestrator  → status: 'completed' | 'failed'  (managed by Orchestrator.runJob)
 *
 * The orchestrator already updates the job record at the end of runJob(), so
 * the queue only needs to handle enqueue + claim + recovery.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

export interface ClaimedJob {
  id: string;
  source_id: string;
}

export class JobQueue {
  private db: SupabaseClient | Pool;

  constructor(db: SupabaseClient | Pool) {
    this.db = db;
  }

  private isSupabase(db: any): db is SupabaseClient {
    return typeof (db as any).from === 'function';
  }

  /**
   * Adds a source to the queue. Returns the new job id.
   * started_at is used as the queue timestamp for ordering.
   */
  async enqueue(sourceId: string): Promise<string> {
    const now = new Date().toISOString();
    if (this.isSupabase(this.db)) {
      const { data, error } = await this.db
        .from('scraping_jobs')
        .insert({ source_id: sourceId, status: 'queued', started_at: now })
        .select('id')
        .single();
      if (error) throw new Error(`JobQueue.enqueue failed: ${error.message}`);
      return data.id;
    }
    const { rows } = await (this.db as Pool).query(
      `INSERT INTO scraping_jobs (source_id, status, started_at)
       VALUES ($1, 'queued', NOW()) RETURNING id`,
      [sourceId]
    );
    return rows[0].id;
  }

  /**
   * Atomically claims the oldest queued job and marks it 'running'.
   * On raw Postgres, uses SELECT FOR UPDATE SKIP LOCKED so multiple worker
   * processes can run safely without double-claiming.
   * On Supabase (no SKIP LOCKED via REST), uses an optimistic-lock CAS update.
   * Returns null when the queue is empty.
   */
  async claimNext(): Promise<ClaimedJob | null> {
    if (this.isSupabase(this.db)) {
      // Read oldest queued job
      const { data: rows } = await this.db
        .from('scraping_jobs')
        .select('id, source_id')
        .eq('status', 'queued')
        .order('started_at', { ascending: true })
        .limit(1);

      if (!rows || rows.length === 0) return null;
      const candidate = rows[0] as ClaimedJob;

      // CAS update: only succeeds if it's still 'queued' (guards against races)
      const { error, count } = await this.db
        .from('scraping_jobs')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', candidate.id)
        .eq('status', 'queued')
        .select();

      // If count is 0, another worker claimed it first — skip silently
      return !error && (count ?? 0) > 0 ? candidate : null;
    }

    // Raw PG: true atomic claim
    const { rows } = await (this.db as Pool).query<ClaimedJob>(`
      UPDATE scraping_jobs
         SET status = 'running', started_at = NOW()
       WHERE id = (
               SELECT id FROM scraping_jobs
                WHERE status = 'queued'
             ORDER BY started_at ASC
                LIMIT 1
            FOR UPDATE SKIP LOCKED
             )
   RETURNING id, source_id
    `);
    return rows[0] ?? null;
  }

  /**
   * Re-queues jobs stuck in 'running' for longer than timeoutMinutes.
   * Call once on worker startup to recover from crashed runs.
   */
  async recoverStuckJobs(timeoutMinutes = 20): Promise<number> {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();

    if (this.isSupabase(this.db)) {
      const { data } = await this.db
        .from('scraping_jobs')
        .update({ status: 'queued' })
        .eq('status', 'running')
        .lt('started_at', cutoff)
        .select('id');
      const n = data?.length ?? 0;
      if (n > 0) console.log(`[JobQueue] Recovered ${n} stuck job(s)`);
      return n;
    }

    const { rowCount } = await (this.db as Pool).query(
      `UPDATE scraping_jobs SET status = 'queued'
        WHERE status = 'running' AND started_at < $1`,
      [cutoff]
    );
    const n = rowCount ?? 0;
    if (n > 0) console.log(`[JobQueue] Recovered ${n} stuck job(s)`);
    return n;
  }

  /** Reads a job record for status polling. */
  async getStatus(jobId: string): Promise<Record<string, unknown> | null> {
    if (this.isSupabase(this.db)) {
      const { data } = await this.db
        .from('scraping_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      return data ?? null;
    }
    const { rows } = await (this.db as Pool).query(
      'SELECT * FROM scraping_jobs WHERE id = $1',
      [jobId]
    );
    return rows[0] ?? null;
  }
}
