/**
 * Pre-seeds the scraping_sources table with known state tourism sites.
 * These are handpicked, reliable official/semi-official event calendars
 * that the LLM scraper can then crawl for events.
 */
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { SupabaseClient } from '@supabase/supabase-js';
import { getPool } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase';

const TOURISM_SEEDS = [
  // --- Oaxaca ---
  { name: 'Oaxaca Travel — Agenda', base_url: 'https://oaxaca.travel/agenda/', default_category: 'festivales', estado: 'Oaxaca' },
  { name: 'Oaxaca Travel — Eventos', base_url: 'https://oaxaca.travel/eventos/', default_category: 'festivales', estado: 'Oaxaca' },
  // --- Jalisco ---
  { name: 'Visit Jalisco — Eventos', base_url: 'https://visitjalisco.mx/es/categorias/fiestas-y-tradiciones/', default_category: 'festivales', estado: 'Jalisco' },
  { name: 'Guadalajara Turismo', base_url: 'https://www.guadalajara.gob.mx/dependencias/cdg/agenda-cultural', default_category: 'cultura', estado: 'Jalisco' },
  // --- Yucatán ---
  { name: 'Yucatán Travel — Eventos', base_url: 'https://yucatan.travel/eventos/', default_category: 'festivales', estado: 'Yucatán' },
  { name: 'Mérida Cultura', base_url: 'https://www.merida.gob.mx/cultura/', default_category: 'cultura', estado: 'Yucatán' },
  // --- Puebla ---
  { name: 'Turismo Puebla — Festividades', base_url: 'https://turismo.puebla.gob.mx/festividades-y-tradiciones', default_category: 'festivales', estado: 'Puebla' },
  { name: 'Visita Puebla — Eventos', base_url: 'https://www.visitapuebla.mx/eventos', default_category: 'festivales', estado: 'Puebla' },
  // --- Guanajuato ---
  { name: 'Querétaro Travel — Eventos', base_url: 'https://queretaro.travel/eventos/', default_category: 'festivales', estado: 'Querétaro' },
  { name: 'Visit Guanajuato', base_url: 'https://www.visitguanajuato.mx/es/eventos', default_category: 'festivales', estado: 'Guanajuato' },
  // --- CDMX ---
  { name: 'CDMX Turismo — Agenda', base_url: 'https://turismo.cdmx.gob.mx/entretenimiento-y-cultura', default_category: 'cultura', estado: 'Ciudad de México' },
  // --- Chiapas ---
  { name: 'Chiapas Travel — Eventos', base_url: 'https://www.chiapas.travel/es/eventos/', default_category: 'festivales', estado: 'Chiapas' },
  // --- San Cristóbal de las Casas ---
  { name: 'San Cristóbal Turismo', base_url: 'https://www.sancristobal.gob.mx/turismo', default_category: 'cultura', estado: 'Chiapas' },
  // --- Veracruz ---
  { name: 'Veracruz — Agenda Cultural', base_url: 'https://www.veracruz.gob.mx/turismo/agenda/', default_category: 'festivales', estado: 'Veracruz' },
  // --- Michoacán ---
  { name: 'Michoacán — Eventos y Festivales', base_url: 'https://turismo.michoacan.gob.mx/eventos/', default_category: 'festivales', estado: 'Michoacán' },
  // --- Morelos ---
  { name: 'Morelos — Agenda Cultural', base_url: 'https://www.morelos.gob.mx/turismo/agenda-cultural', default_category: 'cultura', estado: 'Morelos' },
  // --- Bajío / Artesanal markets ---
  { name: 'Festival Internacional Cervantino', base_url: 'https://www.festivalcervantino.gob.mx/agenda/', default_category: 'cultura', estado: 'Guanajuato' },
  // --- General national ---
  { name: 'VisitMexico — Agenda', base_url: 'https://www.visitmexico.com/eventos', default_category: 'festivales', estado: 'Nacional' },
  { name: 'Cultura UNAM — Cartelera', base_url: 'https://www.cultura.unam.mx/agenda', default_category: 'cultura', estado: 'Ciudad de México' },
];

function isSupabase(db: Pool | SupabaseClient): db is SupabaseClient {
  return typeof (db as any).from === 'function';
}

export async function POST() {
  try {
    const pool = getPool();
    const supabase = getSupabaseClient();
    const db = pool ?? supabase;
    if (!db) return NextResponse.json({ error: 'Sin conexión a base de datos' }, { status: 500 });

    let added = 0, skipped = 0, errors = 0;

    for (const seed of TOURISM_SEEDS) {
      try {
        const sourceData = {
          name: seed.name,
          base_url: seed.base_url,
          default_category: seed.default_category,
          is_active: true,
          parser_config: { location_hint: seed.estado },
          last_scraped_at: null,
          created_at: new Date().toISOString(),
        };

        if (isSupabase(db)) {
          const supabase = db as SupabaseClient;
          const { error } = await supabase
            .from('scraping_sources')
            .insert(sourceData)
            .select()
            .maybeSingle();
          if (error) {
            if (error.code === '23505') { skipped++; continue; } // duplicate base_url
            throw error;
          }
        } else {
          await (db as any).query(
            `INSERT INTO scraping_sources (name, base_url, default_category, is_active, parser_config, last_scraped_at, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (base_url) DO NOTHING`,
            [
              sourceData.name, sourceData.base_url, sourceData.default_category,
              sourceData.is_active, JSON.stringify(sourceData.parser_config),
              sourceData.last_scraped_at, sourceData.created_at,
            ]
          );
        }
        added++;
      } catch (err) {
        console.error('[seed-sources] Error:', err);
        errors++;
      }
    }

    return NextResponse.json({ success: true, added, skipped, errors, total: TOURISM_SEEDS.length });
  } catch (err: any) {
    console.error('[API/seed-sources] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
