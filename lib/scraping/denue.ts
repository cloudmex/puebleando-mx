/**
 * DENUE — Directorio Estadístico Nacional de Unidades Económicas (INEGI)
 * https://www.inegi.org.mx/servicios/api_denue.html
 *
 * Requires: DENUE_API_TOKEN env var (free registration at inegi.org.mx)
 *
 * Two exports:
 *
 *   DENUEPlacesSync
 *     Fetches cultural/gastronomic/natural establishments from DENUE and
 *     inserts them as verified `places` (ground-truth data from INEGI).
 *
 *   DENUEVenueVerifier
 *     Searches DENUE by venue name + coordinates to confirm a scraped venue
 *     actually exists. Used by the HallucinationChecker as a ground-truth layer.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import type { Place } from '../../types/index';

// ── API constants ───────────────────────────────────────────────────────────

const BASE = 'https://www.inegi.org.mx/app/api/denue/v1/consulta';

// ── Category search targets ─────────────────────────────────────────────────
// [keyword, category, humanLabel]
// Uses the working Buscar endpoint (keyword search near coordinates).
// BuscarEntidad (by SCIAN code) returns HTTP/1.1 000 with empty body — broken.

// DENUE tracks economic units — only include categories that are registered businesses.
// Heritage/nature sites (zonas arqueológicas, parques nacionales) are NOT in DENUE.
const SEARCH_TARGETS: Array<[string, string, string]> = [
  // Cultura (established businesses)
  ['museo',         'cultura',     'Museos'],
  ['teatro',        'cultura',     'Teatros'],
  ['auditorio',     'cultura',     'Auditorios'],
  ['galeria',       'cultura',     'Galerías de arte'],
  ['cultural',      'cultura',     'Centros culturales'],
  // Gastronomía
  ['gastronomico',  'gastronomia', 'Mercados gastronómicos'],
  // Naturaleza (operational parks/gardens)
  ['botanico',      'naturaleza',  'Jardines botánicos'],
  ['zoologico',     'naturaleza',  'Zoológicos'],
  // Artesanos
  ['artesanias',    'artesanos',   'Tiendas de artesanías'],
  ['artesanal',     'artesanos',   'Talleres artesanales'],
  // Mercados
  ['mercado',       'mercados',    'Mercados'],
  ['tianguis',      'mercados',    'Tianguis'],
];

// Major city coordinates to seed Buscar searches (covers most of Mexico)
// [lat, lng, city label]
const CITY_COORDS: Array<[number, number, string]> = [
  [19.4326, -99.1332,  'CDMX'],
  [20.6597, -103.3496, 'Guadalajara'],
  [25.6866, -100.3161, 'Monterrey'],
  [19.0414, -98.2063,  'Puebla'],
  [17.0669, -96.7203,  'Oaxaca'],
  [20.9674, -89.6237,  'Mérida'],
  [29.0729, -110.9559, 'Hermosillo'],
  [28.6353, -106.0889, 'Chihuahua'],
  [24.0277, -104.6532, 'Durango'],
  [21.8853, -102.2916, 'Aguascalientes'],
  [21.1240, -101.6839, 'León'],
  [19.7010, -101.1844, 'Morelia'],
  [18.9187, -99.2342,  'Cuernavaca'],
  [17.5492, -99.5035,  'Chilpancingo'],
  [16.7521, -93.1152,  'Tuxtla Gutiérrez'],
  [20.5888, -100.3899, 'Querétaro'],
  [22.1565, -100.9855, 'San Luis Potosí'],
  [23.7369, -99.1411,  'Ciudad Victoria'],
  [18.0042, -92.9189,  'Villahermosa'],
  [19.1817, -96.1429,  'Veracruz'],
  [21.0190, -86.8515,  'Cancún'],
  [20.5041, -86.9476,  'Playa del Carmen'],
  [22.7697, -102.5807, 'Zacatecas'],
  [19.3467, -99.6332,  'Toluca'],
  [32.5027, -117.0062, 'Tijuana'],
  [31.7267, -106.4870, 'Ciudad Juárez'],
  [20.1010, -98.7622,  'Pachuca'],
  [19.5438, -96.9269,  'Xalapa'],
  [19.8301, -90.5349,  'Campeche'],
  [17.9925, -94.3541,  'Coatzacoalcos'],
  [15.9267, -97.0741,  'Puerto Escondido'],
  [20.6774, -105.2348, 'Puerto Vallarta'],
  [27.4863, -109.9304, 'Ciudad Obregón'],
  [26.9320, -101.4493, 'Torreón'],
];

// ── Response field shape (DENUE Buscar JSON array items) ───────────────────
// Field names come from the Buscar endpoint (which works).
// BuscarEntidad returns HTTP/1.1 000 with empty body (broken upstream).

interface DENUERecord {
  Id: string;
  Nombre: string;
  Razon_social?: string;
  Clase_actividad?: string;
  Estrato?: string;           // text e.g. "0 a 5 personas"
  Calle?: string;
  Num_Exterior?: string;      // Buscar uses Num_Exterior (not Numero_Exterior)
  Colonia?: string;           // Buscar uses Colonia (not Nombre_Asentamiento)
  CP?: string;                // Buscar uses CP (not Codigo_Postal)
  Ubicacion?: string;         // "Municipio, Delegación, Estado" combined
  Telefono?: string;
  Sitio_internet?: string;
  Latitud?: string | number;
  Longitud?: string | number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function inMexico(lat: number, lng: number): boolean {
  return lat >= 14.5 && lat <= 32.7 && lng >= -118.4 && lng <= -86.7;
}

function isSupabase(db: any): db is SupabaseClient {
  return typeof db.from === 'function';
}

function token(): string {
  const t = process.env.DENUE_API_TOKEN;
  if (!t) throw new Error('DENUE_API_TOKEN not set');
  return t;
}

/** Normalizes the establishment name to title-case (DENUE returns ALL CAPS) */
function titleCase(str: string): string {
  return str.toLowerCase().replace(/(?:^|\s|[-/])\S/g, c => c.toUpperCase()).trim();
}

/** Builds a full address string from a DENUE record */
function buildAddress(r: DENUERecord): string {
  return [
    r.Calle && r.Num_Exterior
      ? `${titleCase(r.Calle)} ${r.Num_Exterior}`
      : r.Calle ? titleCase(r.Calle) : '',
    r.Colonia ? titleCase(r.Colonia) : '',
    r.CP ?? '',
  ].filter(Boolean).join(', ');
}

/**
 * Extracts town and state from the combined Ubicacion field.
 * Format: "Municipio/Delegación, MunicipalityName, STATE"
 * e.g.  "CUAUHTÉMOC, Cuauhtémoc, CIUDAD DE MÉXICO"
 */
function parseTownState(r: DENUERecord): { town: string; state: string } {
  if (!r.Ubicacion) return { town: '', state: '' };
  const parts = r.Ubicacion.split(',').map(s => s.trim());
  // Last part is state, second-to-last is municipality
  const state = parts[parts.length - 1] ?? '';
  const town  = parts[parts.length - 2] ?? parts[0] ?? '';
  return { town: titleCase(town), state: titleCase(state) };
}

/**
 * Low-level HTTPS GET via Node's https.request.
 * Works around INEGI's non-standard "HTTP/1.1 000" status code that causes
 * Node's fetch/undici to throw "fetch failed". https.request handles it fine.
 */
function httpGetRaw(url: string, timeoutMs = 20_000): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lib = url.startsWith('https') ? require('https') : require('http');
    const parsedUrl = new URL(url);
    const req = lib.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: { 'User-Agent': 'Puebleando/1.0 (puebleando.mx)' },
        // INEGI's SSL cert chain is incomplete in some Node.js environments
        rejectUnauthorized: false,
      },
      (res: any) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      }
    );
    req.setTimeout(timeoutMs, () =>
      req.destroy(new Error(`DENUE request timed out after ${timeoutMs}ms`))
    );
    req.on('error', reject);
    req.end();
  });
}

/**
 * Searches DENUE by keyword near given coordinates (Buscar endpoint).
 * Max radius per DENUE API is 5000m. Returns up to ~100 results per call.
 *
 * NOTE: The BuscarEntidad endpoint (bulk by SCIAN + state code) returns
 * HTTP/1.1 000 with an empty body on INEGI's servers — it appears broken.
 * We use Buscar (keyword + coords) instead.
 */
async function fetchByKeyword(
  keyword: string,
  lat: number,
  lng: number,
  radiusMeters = 5000
): Promise<DENUERecord[]> {
  const kw = encodeURIComponent(keyword);
  const radius = Math.min(radiusMeters, 5000);
  const url = `${BASE}/Buscar/${kw}/${lat},${lng}/${radius}/${token()}`;
  try {
    const body = await httpGetRaw(url, 8_000);
    if (!body || body.trim() === '') return [];
    const data = JSON.parse(body);
    return Array.isArray(data) ? (data as DENUERecord[]) : [];
  } catch (err) {
    console.warn(`[DENUE] fetchByKeyword(${keyword}) failed:`, (err as Error).message);
    return [];
  }
}

// ── DENUEPlacesSync ─────────────────────────────────────────────────────────

export interface DENUEPlacesSyncResult {
  inserted: number;
  skipped: number;
  errors: number;
}

/**
 * Fetches cultural/gastronomic/natural establishments from DENUE and upserts
 * them as Places. Uses the Buscar (keyword + coords) endpoint, searching near
 * major Mexican cities for each category.
 *
 * @param maxPerSearch  Cap per (keyword, city) combination (max 5000 per DENUE API)
 * @param _entity       Unused — kept for API compat. BuscarEntidad is broken upstream.
 */
export class DENUEPlacesSync {
  private db: SupabaseClient | Pool;
  private seen = new Set<string>(); // dedup across city searches

  constructor(db: SupabaseClient | Pool) {
    this.db = db;
  }

  async sync(maxPerSearch = 5000, _entity = '00'): Promise<DENUEPlacesSyncResult> {
    if (!process.env.DENUE_API_TOKEN) {
      throw new Error('DENUE_API_TOKEN not set');
    }

    let inserted = 0, skipped = 0, errors = 0;
    this.seen.clear();

    for (const [keyword, category, label] of SEARCH_TARGETS) {
      console.log(`[DENUE] Searching "${keyword}" (${label}) across ${CITY_COORDS.length} cities…`);
      let categoryTotal = 0;

      for (const [lat, lng, cityName] of CITY_COORDS) {
        const records = await fetchByKeyword(keyword, lat, lng, 5000);
        if (records.length === 0) continue;

        console.log(`[DENUE]   ${cityName}: ${records.length} results for "${keyword}"`);

        for (const r of records) {
          // Skip if we've already processed this establishment in another city search
          if (this.seen.has(r.Id)) { skipped++; continue; }
          this.seen.add(r.Id);

          try {
            const lat = parseFloat(String(r.Latitud ?? ''));
            const lng = parseFloat(String(r.Longitud ?? ''));

            if (!r.Id || !r.Nombre || isNaN(lat) || isNaN(lng) || !inMexico(lat, lng)) {
              skipped++;
              continue;
            }

            const name = titleCase(r.Nombre);
            if (!name) { skipped++; continue; }

            const { town, state } = parseTownState(r);
            const address = buildAddress(r);

            // Estrato is text like "0 a 5 personas", "6 a 10 personas", etc.
            // Map to rough importance score 30–80
            const estratoText = (r.Estrato ?? '').toLowerCase();
            const estratoMap: Record<string, number> = {
              '0 a 5':   30, '6 a 10':   40, '11 a 30':  50,
              '31 a 50': 60, '51 a 100': 70, '101 a 250': 75, '251':       80,
            };
            const importance_score =
              Object.entries(estratoMap).find(([k]) => estratoText.includes(k))?.[1] ?? 30;

            const tags: string[] = [label.toLowerCase()];
            if (r.Clase_actividad) tags.push(r.Clase_actividad.toLowerCase());

            const placeData = {
              id:              `denue-${r.Id}`,
              name:            name.slice(0, 255),
              description:     [r.Clase_actividad, address].filter(Boolean).join(' — ').slice(0, 500),
              category,
              latitude:        lat,
              longitude:       lng,
              photos:          [] as string[],
              town:            town.slice(0, 100),
              state:           state.slice(0, 100),
              tags,
              importance_score,
              created_at:      new Date().toISOString(),
            };

            if (isSupabase(this.db)) {
              const { error } = await (this.db as SupabaseClient)
                .from('places')
                .upsert(placeData, { onConflict: 'id', ignoreDuplicates: true });
              if (error && error.code !== '23505') throw error;
            } else {
              await (this.db as Pool).query(
                `INSERT INTO places
                   (id, name, description, category, latitude, longitude,
                    photos, town, state, tags, importance_score, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                 ON CONFLICT (id) DO NOTHING`,
                [
                  placeData.id, placeData.name, placeData.description, placeData.category,
                  placeData.latitude, placeData.longitude,
                  JSON.stringify(placeData.photos), placeData.town, placeData.state,
                  JSON.stringify(placeData.tags), placeData.importance_score, placeData.created_at,
                ]
              );
            }
            inserted++;
            categoryTotal++;
          } catch (err) {
            console.error(`[DENUE] Insert error (${r.Id}):`, err);
            errors++;
          }
        }

        // Respect INEGI's servers
        await new Promise(r => setTimeout(r, 200));

        if (categoryTotal >= maxPerSearch) break;
      }

      console.log(`[DENUE] "${keyword}": ${categoryTotal} new places inserted`);
    }

    console.log(`[DENUE Places] Done — inserted: ${inserted}, skipped: ${skipped}, errors: ${errors}`);
    return { inserted, skipped, errors };
  }
}

// ── DENUECitySync ────────────────────────────────────────────────────────────
// On-demand DENUE sync for a single city — used by the weekend planner when
// a city has fewer than N verified places in the DB. Runs 5 key category
// searches in parallel (vs full sync which runs 12 keywords × 34 cities).

const CITY_SYNC_KEYWORDS: Array<[string, string]> = [
  ['museo',      'cultura'],
  ['teatro',     'cultura'],
  ['cultural',   'cultura'],
  ['mercado',    'mercados'],
  ['artesanias', 'artesanos'],
];

export async function syncDenueForCity(
  db: SupabaseClient | Pool,
  lat: number,
  lng: number,
  cityDisplay: string,
  radiusMeters = 5000
): Promise<Place[]> {
  if (!process.env.DENUE_API_TOKEN) return [];

  const seen = new Set<string>();
  const saved: Place[] = [];

  // Run all keyword searches in parallel
  const results = await Promise.allSettled(
    CITY_SYNC_KEYWORDS.map(([kw]) => fetchByKeyword(kw, lat, lng, radiusMeters))
  );

  for (let i = 0; i < CITY_SYNC_KEYWORDS.length; i++) {
    const [, category] = CITY_SYNC_KEYWORDS[i];
    const result = results[i];
    if (result.status !== 'fulfilled') continue;

    for (const r of result.value) {
      if (seen.has(r.Id)) continue;
      seen.add(r.Id);

      const rLat = parseFloat(String(r.Latitud ?? ''));
      const rLng = parseFloat(String(r.Longitud ?? ''));
      if (!r.Id || !r.Nombre || isNaN(rLat) || isNaN(rLng) || !inMexico(rLat, rLng)) continue;

      const name = titleCase(r.Nombre);
      const { town, state } = parseTownState(r);
      const address = buildAddress(r);

      const estratoText = (r.Estrato ?? '').toLowerCase();
      const estratoMap: Record<string, number> = {
        '0 a 5': 30, '6 a 10': 40, '11 a 30': 50,
        '31 a 50': 60, '51 a 100': 70, '101 a 250': 75, '251': 80,
      };
      const importance_score =
        Object.entries(estratoMap).find(([k]) => estratoText.includes(k))?.[1] ?? 30;

      const placeData = {
        id: `denue-${r.Id}`,
        name: name.slice(0, 255),
        description: [r.Clase_actividad, address].filter(Boolean).join(' — ').slice(0, 500),
        category,
        latitude: rLat,
        longitude: rLng,
        photos: [] as string[],
        town: (town || cityDisplay).slice(0, 100),
        state: state.slice(0, 100),
        tags: [category],
        importance_score,
        created_at: new Date().toISOString(),
      };

      try {
        if (isSupabase(db)) {
          await (db as SupabaseClient)
            .from('places')
            .upsert(placeData, { onConflict: 'id', ignoreDuplicates: true });
        } else {
          await (db as Pool).query(
            `INSERT INTO places (id, name, description, category, latitude, longitude, photos, town, state, tags, importance_score, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,'{}','{}',ARRAY[$7::text],$8,$9,$10)
             ON CONFLICT (id) DO NOTHING`,
            [placeData.id, placeData.name, placeData.description, category,
             rLat, rLng, category, placeData.importance_score, placeData.town, placeData.created_at]
          );
        }
        saved.push({
          id: placeData.id,
          name: placeData.name,
          description: placeData.description,
          category: category as Place['category'],
          latitude: rLat,
          longitude: rLng,
          photos: [],
          town: placeData.town,
          state: placeData.state,
          tags: placeData.tags,
          importance_score: placeData.importance_score,
          created_at: placeData.created_at,
        });
      } catch { /* ignore duplicate / constraint errors */ }
    }
  }

  console.log(`[DENUE] syncForCity(${cityDisplay}): ${saved.length} places saved`);
  return saved;
}

// ── DENUEVenueVerifier ──────────────────────────────────────────────────────

export interface VenueMatch {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceMeters: number;
}

/**
 * Searches DENUE by venue name near given coordinates.
 * Used by the HallucinationChecker as a ground-truth validation layer.
 *
 * Returns the closest matching establishment within radiusMeters, or null.
 */
export class DENUEVenueVerifier {

  /**
   * Checks if a venue name exists near the given coordinates.
   * @param venueName  Name from the scraped event
   * @param lat        Approximate latitude
   * @param lng        Approximate longitude
   * @param radiusMeters  Search radius (max 5000 per DENUE API)
   */
  async findNearby(
    venueName: string,
    lat: number,
    lng: number,
    radiusMeters = 1000
  ): Promise<VenueMatch | null> {
    if (!process.env.DENUE_API_TOKEN || !venueName) return null;

    // DENUE's Buscar uses the venue name as a keyword search
    const keyword = encodeURIComponent(venueName.slice(0, 50));
    const radius = Math.min(radiusMeters, 5000);
    const url = `${BASE}/Buscar/${keyword}/${lat},${lng}/${radius}/${token()}`;

    try {
      const body = await httpGetRaw(url, 8_000);
      if (!body || body.trim() === '') return null;
      let data: unknown;
      try { data = JSON.parse(body); } catch { return null; }
      if (!Array.isArray(data) || (data as unknown[]).length === 0) return null;

      // Pick the closest result
      const best = (data as DENUERecord[])
        .map(r => {
          const rLat = parseFloat(String(r.Latitud ?? ''));
          const rLng = parseFloat(String(r.Longitud ?? ''));
          if (isNaN(rLat) || isNaN(rLng)) return null;
          // Haversine approximation (good enough for <5km)
          const dLat = (rLat - lat) * (Math.PI / 180);
          const dLng = (rLng - lng) * (Math.PI / 180);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat * (Math.PI / 180)) *
            Math.cos(rLat * (Math.PI / 180)) *
            Math.sin(dLng / 2) ** 2;
          const distanceMeters = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return {
            id: r.Id,
            name: titleCase(r.Nombre),
            address: buildAddress(r),
            lat: rLat,
            lng: rLng,
            distanceMeters,
          } as VenueMatch;
        })
        .filter((r): r is VenueMatch => r !== null)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] ?? null;

      return best;
    } catch (err) {
      console.warn('[DENUE] Venue lookup failed:', (err as Error).message);
      return null;
    }
  }

  /**
   * Quick boolean check: does a venue exist in DENUE near these coords?
   * Returns true also when DENUE_API_TOKEN is not set (fail-open).
   */
  async exists(venueName: string, lat?: number, lng?: number): Promise<boolean> {
    if (!process.env.DENUE_API_TOKEN || !lat || !lng) return true; // fail-open
    const match = await this.findNearby(venueName, lat, lng, 800);
    return match !== null;
  }
}
