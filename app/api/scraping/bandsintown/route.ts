import { NextResponse } from 'next/server';
import { BandsintownSync } from '@/lib/scraping/bandsintown';
import { getPool } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST() {
  if (!process.env.BANDSINTOWN_APP_ID) {
    return NextResponse.json(
      { error: 'BANDSINTOWN_APP_ID no está configurado. Agrega una cadena identificadora (ej: "puebleando") en tus variables de entorno.' },
      { status: 400 }
    );
  }

  try {
    const pool = getPool();
    const supabase = getSupabaseClient();
    const db = pool ?? supabase;
    if (!db) return NextResponse.json({ error: 'Sin conexión a base de datos' }, { status: 500 });

    const sync = new BandsintownSync(db);
    const result = await sync.sync();
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[API/bandsintown] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
