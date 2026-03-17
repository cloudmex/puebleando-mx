import { NextResponse } from 'next/server';
import { SICPlacesSync } from '@/lib/scraping/sic';
import { getPool } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST() {
  try {
    const pool = getPool();
    const supabase = getSupabaseClient();
    const db = pool ?? supabase;
    if (!db) return NextResponse.json({ error: 'Sin conexión a base de datos' }, { status: 500 });

    // Use estado_id=0 for the full national dataset
    const sync = new SICPlacesSync(db);
    const result = await sync.sync(0, 300);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[API/places/sync/sic] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
