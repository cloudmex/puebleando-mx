/**
 * OpenStreetMap / Overpass API — Mexican places sync
 * No API key required. Queries archaeological sites, museums, markets, nature reserves.
 */
import { Pool } from 'pg';
import { SupabaseClient } from '@supabase/supabase-js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Mexico bounding box: south, west, north, east
const MX_BBOX = '14.5,-118.4,32.7,-86.7';

// OSM tag → category mapping
const TAG_CATEGORY: Record<string, string> = {
  archaeological_site: 'cultura',
  museum: 'cultura',
  monument: 'cultura',
  marketplace: 'mercados',
  market: 'mercados',
  nature_reserve: 'naturaleza',
  national_park: 'naturaleza',
};

const OVERPASS_QUERY = `
[out:json][timeout:60];
(
  node["historic"="archaeological_site"](${MX_BBOX});
  way["historic"="archaeological_site"](${MX_BBOX});
  node["tourism"="museum"](${MX_BBOX});
  way["tourism"="museum"](${MX_BBOX});
  node["amenity"="marketplace"](${MX_BBOX});
  way["amenity"="marketplace"](${MX_BBOX});
  node["leisure"="nature_reserve"](${MX_BBOX});
  way["leisure"="nature_reserve"](${MX_BBOX});
  relation["boundary"="national_park"](${MX_BBOX});
);
out center tags;
`;

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassSyncResult {
  inserted: number;
  skipped: number;
  errors: number;
}

function isSupabase(db: any): db is SupabaseClient {
  return typeof db.from === 'function';
}

function mapCategory(tags: Record<string, string>): string {
  for (const [key, val] of Object.entries(tags)) {
    if (key === 'historic' || key === 'tourism' || key === 'amenity' || key === 'leisure' || key === 'boundary') {
      const cat = TAG_CATEGORY[val];
      if (cat) return cat;
    }
  }
  return 'cultura';
}

function isInMexico(lat: number, lng: number): boolean {
  return lat >= 14.5 && lat <= 32.7 && lng >= -118.4 && lng <= -86.7;
}

export class OverpassSync {
  private db: SupabaseClient | Pool;

  constructor(db: SupabaseClient | Pool) {
    this.db = db;
  }

  async sync(limit = 500): Promise<OverpassSyncResult> {
    let inserted = 0, skipped = 0, errors = 0;

    console.log('[Overpass] Fetching OSM data...');
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
    });

    if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);

    const data = await res.json();
    const elements: OverpassElement[] = data.elements || [];
    console.log(`[Overpass] Got ${elements.length} elements`);

    const toProcess = elements.slice(0, limit);

    for (const el of toProcess) {
      try {
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;

        if (!lat || !lon || !isInMexico(lat, lon)) { skipped++; continue; }

        const tags = el.tags || {};
        const name = tags['name:es'] || tags['name'] || '';
        if (!name) { skipped++; continue; }

        const id = `osm-${el.type}-${el.id}`;
        const category = mapCategory(tags);
        const town = tags['addr:city'] || tags['addr:town'] || tags['addr:municipality'] || '';
        const state = tags['addr:state'] || tags['is_in:state'] || '';

        const tagValues: string[] = [];
        if (tags.historic) tagValues.push(tags.historic);
        if (tags.tourism) tagValues.push(tags.tourism);
        if (tags.amenity) tagValues.push(tags.amenity);
        if (tags.leisure) tagValues.push(tags.leisure);

        const placeData = {
          id,
          name: name.slice(0, 255),
          description: tags['description'] || '',
          category,
          latitude: lat,
          longitude: lon,
          photos: [] as string[],
          town: town.slice(0, 100),
          state: state.slice(0, 100),
          tags: tagValues,
          created_at: new Date().toISOString(),
        };

        if (isSupabase(this.db)) {
          const { error } = await this.db.from('places').insert(placeData).select().maybeSingle();
          // Ignore unique constraint violations (duplicate id)
          if (error) {
            if (error.code === '23505') { skipped++; continue; }
            throw error;
          }
        } else {
          const pool = this.db as Pool;
          await pool.query(
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
        console.error('[Overpass] Insert error:', err);
        errors++;
      }
    }

    console.log(`[Overpass] Done — inserted: ${inserted}, skipped: ${skipped}, errors: ${errors}`);
    return { inserted, skipped, errors };
  }
}
