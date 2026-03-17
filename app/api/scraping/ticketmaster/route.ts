import { NextResponse } from 'next/server';
import { TicketmasterSync } from '@/lib/scraping/ticketmaster';
import { getPool } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST() {
  if (!process.env.TICKETMASTER_API_KEY) {
    return NextResponse.json(
      { error: 'TICKETMASTER_API_KEY no está configurado en el servidor' },
      { status: 400 }
    );
  }

  try {
    const pool = getPool();
    const supabase = getSupabaseClient();
    const db = pool ?? supabase;
    if (!db) return NextResponse.json({ error: 'Sin conexión a base de datos' }, { status: 500 });

    const sync = new TicketmasterSync(db);
    const result = await sync.sync(5);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[API/ticketmaster] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
