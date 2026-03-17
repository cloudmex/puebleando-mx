import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase';
import { GeocodingService } from '@/lib/scraping/geocoding';

const BATCH_LIMIT = 50;

// Mexico geographic bounds — discard results outside these
const MX_LAT = { min: 14.5, max: 32.7 };
const MX_LNG = { min: -118.4, max: -86.7 };

function inMexico(lat: number, lng: number) {
  return lat >= MX_LAT.min && lat <= MX_LAT.max && lng >= MX_LNG.min && lng <= MX_LNG.max;
}

export async function POST() {
  const pool = getPool();
  const supabase = getSupabaseClient();

  if (!pool && !supabase) {
    return NextResponse.json({ error: 'Sin conexión a base de datos' }, { status: 500 });
  }

  let processed = 0;
  let geocoded = 0;
  let failed = 0;

  try {
    // Fetch events without coordinates that have at least city or state
    let events: { id: string; venue_name: string; address: string; city: string; state: string }[] = [];

    if (pool) {
      const { rows } = await pool.query(
        `SELECT id, venue_name, address, city, state FROM events
         WHERE latitude IS NULL
           AND (city != '' OR state != '')
         ORDER BY scraped_at DESC
         LIMIT $1`,
        [BATCH_LIMIT]
      );
      events = rows;
    } else if (supabase) {
      const { data } = await supabase
        .from('events')
        .select('id, venue_name, address, city, state')
        .is('latitude', null)
        .or('city.neq.,state.neq.')
        .order('scraped_at', { ascending: false })
        .limit(BATCH_LIMIT);
      events = data ?? [];
    }

    processed = events.length;

    for (const ev of events) {
      try {
        // 3-level fallback matching orchestrator logic
        const queries = [
          [ev.venue_name, ev.address, ev.city, ev.state, 'México'].filter(Boolean).join(', '),
          [ev.address, ev.city, ev.state, 'México'].filter(Boolean).join(', '),
          [ev.city, ev.state, 'México'].filter(Boolean).join(', '),
        ];

        let coords: [number, number] | null = null;
        for (const q of queries) {
          if (q.length < 5) continue;
          coords = await GeocodingService.geocode(q);
          if (coords) break;
        }

        if (!coords || !inMexico(coords[0], coords[1])) {
          failed++;
          continue;
        }

        const [lat, lng] = coords;

        if (pool) {
          await pool.query(
            'UPDATE events SET latitude = $1, longitude = $2, updated_at = NOW() WHERE id = $3',
            [lat, lng, ev.id]
          );
        } else if (supabase) {
          await supabase
            .from('events')
            .update({ latitude: lat, longitude: lng, updated_at: new Date().toISOString() })
            .eq('id', ev.id);
        }

        geocoded++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ success: true, processed, geocoded, failed });
  } catch (err: any) {
    console.error('[API/geocoding/batch] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
