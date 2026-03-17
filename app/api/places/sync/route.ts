import { NextResponse } from 'next/server';
import { OverpassSync } from '@/lib/scraping/overpass';
import { getPool } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST() {
  try {
    const pool = getPool();
    const supabase = getSupabaseClient();
    const db = pool ?? supabase;
    if (!db) return NextResponse.json({ error: 'Sin conexión a base de datos' }, { status: 500 });

    const sync = new OverpassSync(db);
    const result = await sync.sync(500);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[API/places/sync] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
