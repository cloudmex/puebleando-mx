/**
 * POST /api/scraping/denue
 *
 * Enqueues a DENUE → places sync in the background and returns immediately.
 * Accepts optional body params:
 *   maxPerSearch  Max records per (keyword, city) pair (default 5000)
 *
 * For a full sync prefer: npm run denue-sync
 * Requires DENUE_API_TOKEN + SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { NextResponse } from 'next/server';
import { DENUEPlacesSync } from '@/lib/scraping/denue';
import { getPool } from '@/lib/db';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  if (!process.env.DENUE_API_TOKEN) {
    return NextResponse.json({ error: 'DENUE_API_TOKEN not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const maxPerSearch: number = body?.maxPerSearch ?? body?.maxPerScian ?? 5000;

  // Service role bypasses RLS for trusted admin operations
  const supabase = getSupabaseServerClient(true);
  const pool     = getPool();
  const db       = supabase ?? pool;

  if (!db) {
    return NextResponse.json({ error: 'Sin conexión a base de datos' }, { status: 500 });
  }

  // Fire-and-forget — the sync takes 10–20 min, don't block the response
  const sync = new DENUEPlacesSync(db);
  sync.sync(maxPerSearch).then(result => {
    console.log('[API/denue] Sync complete:', result);
  }).catch(err => {
    console.error('[API/denue] Sync error:', err.message);
  });

  return NextResponse.json({
    success: true,
    message: 'DENUE sync iniciado en segundo plano. Revisa los logs del servidor para ver el progreso.',
    maxPerSearch,
  });
}
