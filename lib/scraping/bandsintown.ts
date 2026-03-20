/**
 * Bandsintown API — Mexican concert events
 * Requires: BANDSINTOWN_APP_ID env var (just a string identifier, e.g. "puebleando")
 * Docs: https://app.swaggerhub.com/apis/Bandsintown/PublicAPI/3.0.0
 */
import { Pool } from 'pg';
import { SupabaseClient } from '@supabase/supabase-js';
import { EventUtils, Deduplicator } from './normalizer';

const BASE = 'https://rest.bandsintown.com/artists';
const REQUEST_DELAY_MS = 300;

// Popular Mexican artists seed list
const MEXICAN_ARTISTS = [
  'Maná', 'Café Tacvba', 'Zoé', 'Peso Pluma', 'Natanael Cano',
  'Eslabón Armado', 'Banda MS', 'Christian Nodal', 'Los Tigres del Norte',
  'Grupo Firme', 'Los Ángeles Azules', 'Panteón Rococó', 'Molotov',
  'Kinky', 'Enjambre', 'Carín León', 'Caifanes',
  'La Arrolladora Banda el Limón', 'Alejandro Fernández', 'Mon Laferte',
  'Juanes', 'Alejandro Sanz', 'Enrique Iglesias', 'Camila', 'Reik',
];

const MEXICO_COUNTRY = new Set(['Mexico', 'México', 'MX']);

export interface BandsintownSyncResult {
  inserted: number;
  duplicates: number;
  errors: number;
}

function isSupabase(db: any): db is SupabaseClient {
  return typeof db.from === 'function';
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class BandsintownSync {
  private appId: string;
  private db: SupabaseClient | Pool;

  constructor(db: SupabaseClient | Pool) {
    this.appId = process.env.BANDSINTOWN_APP_ID || '';
    this.db = db;
  }

  async sync(): Promise<BandsintownSyncResult> {
    if (!this.appId) throw new Error('BANDSINTOWN_APP_ID no está configurado');

    let inserted = 0, duplicates = 0, errors = 0;

    for (const artist of MEXICAN_ARTISTS) {
      try {
        const encoded = encodeURIComponent(artist);
        const url = `${BASE}/${encoded}/events?app_id=${this.appId}&date=upcoming`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Puebleando/1.0' } });

        if (res.status === 404) { await sleep(REQUEST_DELAY_MS); continue; }
        if (!res.ok) { errors++; await sleep(REQUEST_DELAY_MS); continue; }

        const events: any[] = await res.json();
        if (!Array.isArray(events)) { await sleep(REQUEST_DELAY_MS); continue; }

        for (const ev of events) {
          try {
            const venue = ev.venue || {};
            const country = venue.country || '';
            if (!MEXICO_COUNTRY.has(country)) continue;

            const city = venue.city || '';
            const startDate = ev.datetime || ev.start?.datetime || '';
            if (!startDate) continue;

            const hash = EventUtils.generateDedupHash({
              title: `${artist} - ${venue.name || city}`,
              start_date: startDate,
              city,
            });

            if (await Deduplicator.isDuplicate(hash, this.db)) { duplicates++; continue; }

            const offers = ev.offers || [];
            const ticketUrl = offers[0]?.url || ev.url || '';
            const isFree = offers.length === 0;

            const eventData: Record<string, any> = {
              title: `${artist}`.slice(0, 255),
              description: ev.description || '',
              short_description: `Concierto en ${venue.name || city}`.slice(0, 200),
              category: 'cultura',
              subcategory: artist,
              tags: ['concierto', 'música'],
              start_date: new Date(startDate).toISOString(),
              end_date: null,
              time_text: new Date(startDate).toTimeString().slice(0, 5),
              venue_name: (venue.name || '').slice(0, 255),
              address: '',
              city: city.slice(0, 100),
              state: (venue.region || '').slice(0, 100),
              country: 'México',
              latitude: venue.latitude ? parseFloat(venue.latitude) : null,
              longitude: venue.longitude ? parseFloat(venue.longitude) : null,
              price_text: '',
              is_free: isFree,
              image_url: ev.artist?.image_url || '',
              confidence_score: 0.95,
              slug: EventUtils.generateSlug(`${artist}-${venue.name || city}-${startDate.slice(0, 10)}`),
              dedup_hash: hash,
              source_name: 'Bandsintown',
              source_url: ticketUrl,
              source_type: 'api_bandsintown',
              status: 'nuevo',
              published_at: null,
              scraped_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            if (isSupabase(this.db)) {
              const { error } = await this.db.from('events').upsert(eventData, { onConflict: 'slug', ignoreDuplicates: true });
              if (error) throw error;
            } else {
              const cols = Object.keys(eventData).join(', ');
              const placeholders = Object.keys(eventData).map((_, i) => `$${i + 1}`).join(', ');
              await (this.db as Pool).query(
                `INSERT INTO events (${cols}) VALUES (${placeholders}) ON CONFLICT (slug) DO NOTHING`,
                Object.values(eventData)
              );
            }
            inserted++;
          } catch (err) {
            console.error(`[Bandsintown] Insert error (${artist}):`, err);
            errors++;
          }
        }
      } catch (err) {
        console.error(`[Bandsintown] Fetch error (${artist}):`, err);
        errors++;
      }
      await sleep(REQUEST_DELAY_MS);
    }

    console.log(`[Bandsintown] Done — inserted: ${inserted}, dupes: ${duplicates}, errors: ${errors}`);
    return { inserted, duplicates, errors };
  }
}
