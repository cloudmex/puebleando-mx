import { NextResponse } from 'next/server';
import { SICFestivalsSync } from '@/lib/scraping/sic';
import { getPool } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase';

// Top tourist states by INEGI ID
const DEFAULT_STATES = [9, 11, 14, 20, 21, 22, 31, 7, 30];

export async function POST() {
  try {
    const pool = getPool();
    const supabase = getSupabaseClient();
    const db = pool ?? supabase;
    if (!db) return NextResponse.json({ error: 'Sin conexión a base de datos' }, { status: 500 });

    const sync = new SICFestivalsSync(db);
    const result = await sync.sync(DEFAULT_STATES);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[API/sic-festivals] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
