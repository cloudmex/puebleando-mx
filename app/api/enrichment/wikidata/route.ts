import { NextResponse } from 'next/server';
import { WikidataEnricher } from '@/lib/scraping/wikidata';
import { getPool } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST() {
  try {
    const pool = getPool();
    const supabase = getSupabaseClient();
    const db = pool ?? supabase;
    if (!db) return NextResponse.json({ error: 'Sin conexión a base de datos' }, { status: 500 });

    const enricher = new WikidataEnricher(db);
    const result = await enricher.enrich(200);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[API/wikidata] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
