/**
 * Wikidata SPARQL enrichment — Mexican places
 * No API key required.
 * Enriches existing places with descriptions and images, and can insert new ones.
 */
import { Pool } from 'pg';
import { SupabaseClient } from '@supabase/supabase-js';

const SPARQL_URL = 'https://query.wikidata.org/sparql';

// SPARQL: Mexican archaeological sites, UNESCO heritage, museums with coords + Spanish label + image
const SPARQL_QUERY = `
SELECT ?item ?itemLabel ?description ?image ?lat ?lng ?typeLabel WHERE {
  {
    ?item wdt:P17 wd:Q96;          # country = Mexico
          wdt:P31/wdt:P279* wd:Q839954. # archaeological site
  } UNION {
    ?item wdt:P17 wd:Q96;
          wdt:P31/wdt:P279* wd:Q33506.  # museum
  } UNION {
    ?item wdt:P17 wd:Q96;
          wdt:P1435 wd:Q18275518.       # UNESCO World Heritage Site (Mexico)
  }
  ?item wdt:P625 ?coords.
  BIND(geof:latitude(?coords) AS ?lat)
  BIND(geof:longitude(?coords) AS ?lng)
  OPTIONAL { ?item wdt:P18 ?image. }
  OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "es") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
  ?item wdt:P31 ?type.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". ?type rdfs:label ?typeLabel. }
  FILTER(?lat >= 14.5 && ?lat <= 32.7 && ?lng >= -118.4 && ?lng <= -86.7)
}
LIMIT 300
`;

interface WikidataResult {
  item: { value: string };
  itemLabel: { value: string };
  description?: { value: string };
  image?: { value: string };
  lat: { value: string };
  lng: { value: string };
  typeLabel?: { value: string };
}

export interface WikidataEnrichResult {
  enriched: number;
  inserted: number;
  skipped: number;
  errors: number;
}

function isSupabase(db: any): db is SupabaseClient {
  return typeof db.from === 'function';
}

function getWikidataId(uri: string): string {
  return uri.replace('http://www.wikidata.org/entity/', '');
}

export class WikidataEnricher {
  private db: SupabaseClient | Pool;

  constructor(db: SupabaseClient | Pool) {
    this.db = db;
  }

  private async fetchWikidata(): Promise<WikidataResult[]> {
    const params = new URLSearchParams({
      query: SPARQL_QUERY,
      format: 'json',
    });
    const res = await fetch(`${SPARQL_URL}?${params}`, {
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'Puebleando/1.0 (tourism discovery app)',
      },
    });
    if (!res.ok) throw new Error(`Wikidata SPARQL error: ${res.status}`);
    const data = await res.json();
    return data?.results?.bindings || [];
  }

  private async findNearbyPlace(lat: number, lng: number, name: string): Promise<string | null> {
    const delta = 0.01;
    if (isSupabase(this.db)) {
      const { data } = await this.db
        .from('places')
        .select('id')
        .gte('latitude', lat - delta).lte('latitude', lat + delta)
        .gte('longitude', lng - delta).lte('longitude', lng + delta)
        .limit(1);
      return data?.[0]?.id ?? null;
    } else {
      const { rows } = await (this.db as Pool).query(
        `SELECT id FROM places
         WHERE latitude BETWEEN $1 AND $2
           AND longitude BETWEEN $3 AND $4
         LIMIT 1`,
        [lat - delta, lat + delta, lng - delta, lng + delta]
      );
      return rows[0]?.id ?? null;
    }
  }

  private async updatePlace(id: string, description: string, imageUrl: string) {
    if (isSupabase(this.db)) {
      await this.db.from('places').update({ description, ...(imageUrl ? { photos: [imageUrl] } : {}) }).eq('id', id);
    } else {
      if (imageUrl) {
        await (this.db as Pool).query(
          `UPDATE places SET description = COALESCE(NULLIF(description,''), $1), photos = CASE WHEN photos = '[]'::jsonb THEN $2::jsonb ELSE photos END WHERE id = $3`,
          [description, JSON.stringify([imageUrl]), id]
        );
      } else {
        await (this.db as Pool).query(
          `UPDATE places SET description = COALESCE(NULLIF(description,''), $1) WHERE id = $2`,
          [description, id]
        );
      }
    }
  }

  private async insertPlace(wd: WikidataResult) {
    const wikidataId = getWikidataId(wd.item.value);
    const lat = parseFloat(wd.lat.value);
    const lng = parseFloat(wd.lng.value);
    const imageUrl = wd.image?.value || '';

    const placeData = {
      id: `wd-${wikidataId}`,
      name: wd.itemLabel.value.slice(0, 255),
      description: wd.description?.value || '',
      category: 'cultura' as const,
      latitude: lat,
      longitude: lng,
      photos: imageUrl ? [imageUrl] : [] as string[],
      town: '',
      state: '',
      tags: wd.typeLabel?.value ? [wd.typeLabel.value] : [] as string[],
      created_at: new Date().toISOString(),
    };

    if (isSupabase(this.db)) {
      const { error } = await this.db.from('places').insert(placeData).select().maybeSingle();
      if (error && error.code !== '23505') throw error;
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
  }

  async enrich(limit = 200): Promise<WikidataEnrichResult> {
    let enriched = 0, inserted = 0, skipped = 0, errors = 0;

    console.log('[Wikidata] Fetching SPARQL results...');
    const results = await this.fetchWikidata();
    console.log(`[Wikidata] Got ${results.length} results`);

    const toProcess = results.slice(0, limit);

    for (const wd of toProcess) {
      try {
        const lat = parseFloat(wd.lat.value);
        const lng = parseFloat(wd.lng.value);
        const name = wd.itemLabel.value;
        const description = wd.description?.value || '';
        const imageUrl = wd.image?.value || '';

        if (!name || name.startsWith('Q')) { skipped++; continue; }

        const existingId = await this.findNearbyPlace(lat, lng, name);

        if (existingId) {
          if (description || imageUrl) {
            await this.updatePlace(existingId, description, imageUrl);
            enriched++;
          } else {
            skipped++;
          }
        } else if (description) {
          await this.insertPlace(wd);
          inserted++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error('[Wikidata] Error:', err);
        errors++;
      }
    }

    console.log(`[Wikidata] Done — enriched: ${enriched}, inserted: ${inserted}, skipped: ${skipped}, errors: ${errors}`);
    return { enriched, inserted, skipped, errors };
  }
}
