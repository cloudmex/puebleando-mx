/**
 * SIC — Sistema de Información Cultural (sic.cultura.gob.mx)
 * Mexico's national cultural information system. No API key required.
 *
 * Data URL pattern:
 *   https://sic.cultura.gob.mx/opendata/d/{estado_id}_{table}_directorio.json
 *   Use estado_id = 0 for the full national dataset.
 *
 * Tables with reliable lat/lng (→ places):
 *   museo, zona_arqueologica, teatro, auditorio, galeria, casa_de_cultura
 *
 * Tables for events (dates in free-text, no coords):
 *   festival_ae  (662 nationally)
 */
import { Pool } from 'pg';
import { SupabaseClient } from '@supabase/supabase-js';
import { GeocodingService } from './geocoding';
import { EventUtils, Deduplicator } from './normalizer';

const SIC_BASE = 'https://sic.cultura.gob.mx/opendata/d';

// INEGI state IDs for the most tourist-relevant states
const TOURIST_STATES = [
  { id: 0,  name: 'Nacional' },    // full national dataset for places
];

// Place tables with reliable coords
const PLACE_TABLES = [
  { table: 'museo',            category: 'cultura',    nameField: 'museo_nombre',            latField: 'gmaps_latitud', lngField: 'gmaps_longitud', idField: 'museo_id', descField: 'museo_tematica_n1', townField: 'nom_mun', stateField: 'nom_ent' },
  { table: 'zona_arqueologica',category: 'cultura',    nameField: 'zona_nombre',             latField: 'gmaps_latitud', lngField: 'gmaps_longitud', idField: 'zona_id',  descField: 'zona_nombre',      townField: 'nom_mun', stateField: 'nom_ent' },
  { table: 'teatro',           category: 'cultura',    nameField: 'teatro_nombre',           latField: 'gmaps_latitud', lngField: 'gmaps_longitud', idField: 'teatro_id',descField: null,               townField: 'nom_mun', stateField: 'nom_ent' },
  { table: 'auditorio',        category: 'cultura',    nameField: 'auditorio_nombre',        latField: 'gmaps_latitud', lngField: 'gmaps_longitud', idField: 'auditorio_id', descField: null,           townField: 'nom_mun', stateField: 'nom_ent' },
  { table: 'galeria',          category: 'cultura',    nameField: 'galeria_nombre',          latField: 'gmaps_latitud', lngField: 'gmaps_longitud', idField: 'galeria_id',   descField: null,           townField: 'nom_mun', stateField: 'nom_ent' },
  { table: 'casa_de_cultura',  category: 'cultura',    nameField: 'casa_nombre',             latField: 'gmaps_latitud', lngField: 'gmaps_longitud', idField: 'casa_id',      descField: null,           townField: 'nom_mun', stateField: 'nom_ent' },
];

// Mexico bounding box validation
function inMexico(lat: number, lng: number): boolean {
  return lat >= 14.5 && lat <= 32.7 && lng >= -118.4 && lng <= -86.7;
}

function isSupabase(db: any): db is SupabaseClient {
  return typeof db.from === 'function';
}

// -------------------------------------------------------------------
// Month parser — handles "mayo", "18-24 de febrero de 2016", etc.
// Returns ISO date string for this year + that month, or null
// -------------------------------------------------------------------
const MONTH_ES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function parseApproxDate(text: string | null): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [name, month] of Object.entries(MONTH_ES)) {
    if (lower.includes(name)) {
      const year = new Date().getFullYear();
      const pad = String(month).padStart(2, '0');
      return `${year}-${pad}-01T12:00:00Z`;
    }
  }
  // Try ISO date fragments like "2024-05-01"
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    const date = new Date(isoMatch[1]);
    // If the date is in the past, bump to next year
    if (date < new Date()) {
      date.setFullYear(new Date().getFullYear() + (date.getMonth() >= new Date().getMonth() ? 0 : 1));
    }
    return date.toISOString();
  }
  return null;
}

// -------------------------------------------------------------------
export interface SICPlacesSyncResult {
  inserted: number;
  skipped: number;
  errors: number;
}

export interface SICFestivalsSyncResult {
  inserted: number;
  duplicates: number;
  errors: number;
}

// -------------------------------------------------------------------
// Places Sync — museums, theaters, archaeological zones, etc.
// -------------------------------------------------------------------
export class SICPlacesSync {
  private db: SupabaseClient | Pool;

  constructor(db: SupabaseClient | Pool) {
    this.db = db;
  }

  private async fetchTable(estadoId: number, table: string): Promise<any[]> {
    const url = `${SIC_BASE}/${estadoId}_${table}_directorio.json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Puebleando/1.0' } });
    if (!res.ok) {
      console.warn(`[SIC] ${table} estado ${estadoId}: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async sync(estadoId = 0, limitPerTable = 300): Promise<SICPlacesSyncResult> {
    let inserted = 0, skipped = 0, errors = 0;

    for (const meta of PLACE_TABLES) {
      let records: any[] = [];
      try {
        records = await this.fetchTable(estadoId, meta.table);
      } catch (err) {
        console.error(`[SIC] Fetch failed for ${meta.table}:`, err);
        continue;
      }
      console.log(`[SIC] ${meta.table}: ${records.length} records`);

      for (const rec of records.slice(0, limitPerTable)) {
        try {
          const lat = parseFloat(rec[meta.latField]);
          const lng = parseFloat(rec[meta.lngField]);

          if (!lat || !lng || isNaN(lat) || isNaN(lng) || !inMexico(lat, lng)) {
            skipped++;
            continue;
          }

          const rawName = rec[meta.nameField] || '';
          const name = String(rawName).trim();
          if (!name) { skipped++; continue; }

          const id = `sic-${meta.table}-${rec[meta.idField]}`;
          const description = meta.descField ? String(rec[meta.descField] || '').trim() : '';
          const town = String(rec[meta.townField] || '').trim();
          const state = String(rec[meta.stateField] || '').trim();
          const website = rec.pagina_web ? String(rec.pagina_web).trim() : '';

          const tags: string[] = [meta.table.replace(/_/g, ' ')];

          const placeData = {
            id,
            name: name.slice(0, 255),
            description: description.slice(0, 1000),
            category: meta.category,
            latitude: lat,
            longitude: lng,
            photos: [] as string[],
            town: town.slice(0, 100),
            state: state.slice(0, 100),
            tags,
            created_at: new Date().toISOString(),
          };

          if (isSupabase(this.db)) {
            const { error } = await (this.db as SupabaseClient).from('places').insert(placeData).select().maybeSingle();
            if (error) {
              if (error.code === '23505') { skipped++; continue; }
              throw error;
            }
          } else {
            await (this.db as Pool).query(
              `INSERT INTO places (id, name, description, category, latitude, longitude, photos, town, state, tags, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
               ON CONFLICT (id) DO NOTHING`,
              [
                placeData.id, placeData.name, placeData.description, placeData.category,
                placeData.latitude, placeData.longitude,
                JSON.stringify(placeData.photos), placeData.town, placeData.state,
                JSON.stringify(placeData.tags), placeData.created_at,
              ]
            );
          }
          inserted++;
        } catch (err) {
          console.error(`[SIC] Insert error (${meta.table}):`, err);
          errors++;
        }
      }
    }

    console.log(`[SIC Places] Done — inserted: ${inserted}, skipped: ${skipped}, errors: ${errors}`);
    return { inserted, skipped, errors };
  }
}

// -------------------------------------------------------------------
// Festivals Sync — festival_ae table → events
// Dates are free-text; coords missing (geocoded from city+state)
// -------------------------------------------------------------------
export class SICFestivalsSync {
  private db: SupabaseClient | Pool;

  constructor(db: SupabaseClient | Pool) {
    this.db = db;
  }

  async sync(estadoIds: number[] = [9, 11, 14, 20, 21, 22, 31, 7, 30]): Promise<SICFestivalsSyncResult> {
    let inserted = 0, duplicates = 0, errors = 0;

    for (const estadoId of estadoIds) {
      let records: any[] = [];
      try {
        const url = `${SIC_BASE}/${estadoId}_festival_ae_directorio.json`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Puebleando/1.0' } });
        if (!res.ok) { continue; }
        const data = await res.json();
        records = Array.isArray(data) ? data : [];
      } catch {
        continue;
      }
      console.log(`[SIC Festivals] Estado ${estadoId}: ${records.length} festivales`);

      for (const rec of records) {
        try {
          const name = String(rec.festival_ae_nombre || '').trim();
          if (!name) continue;

          const city = String(rec.nom_mun || '').trim();
          const state = String(rec.nom_ent || '').trim();
          const description = String(rec.festival_ae_descripcion || '').trim();

          // Parse date
          const rawDate = rec.festival_ae_fecha_inicio || rec.festival_ae_fecha_1 || rec.festival_ae_fecha_t;
          const startDate = parseApproxDate(String(rawDate || ''));
          if (!startDate) continue; // skip if we can't determine even the month

          const hash = EventUtils.generateDedupHash({ title: name, start_date: startDate, city });
          if (await Deduplicator.isDuplicate(hash, this.db)) { duplicates++; continue; }

          // Geocode from city+state
          let lat: number | null = null;
          let lng: number | null = null;
          if (city && state) {
            const coords = await GeocodingService.geocode(`${city}, ${state}, México`);
            if (coords) [lat, lng] = [coords[0], coords[1]];
          }

          const discipline = String(rec.festival_ae_disciplina || '').trim();
          const subcategory = discipline.slice(0, 100);

          const eventData: Record<string, any> = {
            title: name.slice(0, 255),
            description: description.slice(0, 2000),
            short_description: description.slice(0, 200),
            category: 'festivales',
            subcategory,
            tags: discipline ? [discipline] : [],
            start_date: startDate,
            end_date: null,
            time_text: '',
            venue_name: String(rec.festival_ae_sede || '').slice(0, 255),
            address: String(rec.festival_ae_calle_numero || '').slice(0, 255),
            city: city.slice(0, 100),
            state: state.slice(0, 100),
            country: 'México',
            latitude: lat,
            longitude: lng,
            price_text: '',
            is_free: true,
            image_url: '',
            confidence_score: 0.7,
            slug: EventUtils.generateSlug(`${name}-${city}`),
            dedup_hash: hash,
            source_name: 'SIC Cultura México',
            source_url: rec.link_sic || '',
            source_type: 'api_sic',
            status: 'nuevo',
            published_at: null,
            scraped_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          if (isSupabase(this.db)) {
            const { error } = await (this.db as SupabaseClient).from('events').insert(eventData);
            if (error) throw error;
          } else {
            const cols = Object.keys(eventData).join(', ');
            const vals = Object.keys(eventData).map((_, i) => `$${i + 1}`).join(', ');
            await (this.db as Pool).query(`INSERT INTO events (${cols}) VALUES (${vals})`, Object.values(eventData));
          }
          inserted++;
        } catch (err) {
          console.error('[SIC Festivals] Error:', err);
          errors++;
        }
      }
    }

    console.log(`[SIC Festivals] Done — inserted: ${inserted}, dupes: ${duplicates}, errors: ${errors}`);
    return { inserted, duplicates, errors };
  }
}
