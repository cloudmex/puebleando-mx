/**
 * Standalone DENUE → places sync script.
 *
 * Usage:
 *   npm run denue-sync
 *   npm run denue-sync -- --max 100   # limit per (keyword, city) combination
 *
 * Requires DENUE_API_TOKEN in .env.local (and DATABASE_URL or Supabase vars).
 * Searches 15 category keywords across 34 major Mexican cities.
 * Typical run: ~500 DENUE API calls, may take 10–20 minutes.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local before any app imports
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { DENUEPlacesSync } from '../lib/scraping/denue';
import { getPool } from '../lib/db';
import { getSupabaseServerClient } from '../lib/supabase-server';

async function main() {
  if (!process.env.DENUE_API_TOKEN) {
    console.error('[denue-sync] DENUE_API_TOKEN is not set in .env.local');
    process.exit(1);
  }

  const maxArg = process.argv.indexOf('--max');
  const maxPerSearch = maxArg !== -1 ? parseInt(process.argv[maxArg + 1], 10) : 5000;

  // Use service role to bypass RLS (this is a trusted admin script)
  const supabase = getSupabaseServerClient(true);
  const pool = getPool();
  const db = supabase ?? pool;

  if (!db) {
    console.error('[denue-sync] No database connection. Set DATABASE_URL or Supabase env vars.');
    process.exit(1);
  }

  const dbType = supabase ? 'Supabase' : 'PostgreSQL';
  console.log(`[denue-sync] Starting DENUE sync → ${dbType} (maxPerSearch=${maxPerSearch})`);
  console.log('[denue-sync] Searching 15 category keywords across 34 Mexican cities…\n');

  const start = Date.now();
  const sync = new DENUEPlacesSync(db);
  const result = await sync.sync(maxPerSearch);

  const elapsed = Math.round((Date.now() - start) / 1000);
  console.log(`\n[denue-sync] Finished in ${elapsed}s`);
  console.log(`  Inserted : ${result.inserted}`);
  console.log(`  Skipped  : ${result.skipped} (duplicates / invalid coords)`);
  console.log(`  Errors   : ${result.errors}`);

  if (pool) await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('[denue-sync] Fatal error:', err);
  process.exit(1);
});
