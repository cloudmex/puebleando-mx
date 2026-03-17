/**
 * Ticketmaster Discovery API v2 — Mexico event sync
 * Requires: TICKETMASTER_API_KEY env var
 * Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 */
import { Pool } from 'pg';
import { SupabaseClient } from '@supabase/supabase-js';
import { EventUtils, Deduplicator } from './normalizer';

const BASE = 'https://app.ticketmaster.com/discovery/v2';

const SEGMENT_MAP: Record<string, string> = {
  Music: 'cultura',
  'Arts & Theatre': 'cultura',
  Film: 'cultura',
  Family: 'festivales',
  Sports: 'festivales',
  Miscellaneous: 'festivales',
};

export interface TicketmasterSyncResult {
  inserted: number;
  duplicates: number;
  errors: number;
}

export class TicketmasterSync {
  private apiKey: string;
  private db: SupabaseClient | Pool;

  constructor(db: SupabaseClient | Pool) {
    this.apiKey = process.env.TICKETMASTER_API_KEY || '';
    this.db = db;
  }

  private isSupabase(db: any): db is SupabaseClient {
    return typeof (db as any).from === 'function';
  }

  private mapCategory(segmentName?: string): string {
    if (!segmentName) return 'festivales';
    return SEGMENT_MAP[segmentName] ?? 'festivales';
  }

  async sync(maxPages = 5): Promise<TicketmasterSyncResult> {
    if (!this.apiKey) throw new Error('TICKETMASTER_API_KEY not set');

    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    // TM format: 2026-03-15T00:00:00Z (no milliseconds)
    const startStr = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const endStr = in90Days.toISOString().replace(/\.\d{3}Z$/, 'Z');

    let inserted = 0, duplicates = 0, errors = 0;

    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({
        apikey: this.apiKey,
        countryCode: 'MX',
        startDateTime: startStr,
        endDateTime: endStr,
        size: '50',
        page: String(page),
        sort: 'date,asc',
      });

      const res = await fetch(`${BASE}/events.json?${params}`);
      if (!res.ok) {
        console.error(`[Ticketmaster] API error page ${page}: ${res.status}`);
        break;
      }

      const data = await res.json();
      const events: any[] = data?._embedded?.events || [];
      const totalPages: number = data?.page?.totalPages || 1;
      console.log(`[Ticketmaster] Page ${page + 1}/${Math.min(maxPages, totalPages)}: ${events.length} events`);

      if (events.length === 0) break;

      for (const ev of events) {
        try {
          const venue = ev?._embedded?.venues?.[0];
          if (venue?.country?.countryCode && venue.country.countryCode !== 'MX') continue;

          const lat = venue?.location?.latitude ? parseFloat(venue.location.latitude) : null;
          const lng = venue?.location?.longitude ? parseFloat(venue.location.longitude) : null;
          const city = venue?.city?.name || '';
          const state = venue?.state?.name || '';

          const classification = (ev.classifications || []).find((c: any) => c.primary) || ev.classifications?.[0];
          const segment = classification?.segment?.name || '';
          const category = this.mapCategory(segment);

          // Best image — widest available
          const image = ((ev.images || []) as any[]).sort((a, b) => (b.width || 0) - (a.width || 0))[0];

          const localDate = ev.dates?.start?.localDate || '';
          const localTime = ev.dates?.start?.localTime || '00:00:00';
          const startDate = ev.dates?.start?.dateTime || `${localDate}T${localTime}Z`;

          const hash = EventUtils.generateDedupHash({
            title: ev.name || '',
            start_date: startDate,
            city,
          });

          if (await Deduplicator.isDuplicate(hash, this.db)) {
            duplicates++;
            continue;
          }

          const genre = classification?.genre?.name || '';
          const shortDesc = [segment, genre, city, state ? `(${state})` : ''].filter(Boolean).join(' · ');

          const eventData: Record<string, any> = {
            title: (ev.name || 'Sin título').slice(0, 255),
            description: '',
            short_description: shortDesc.slice(0, 200),
            category,
            subcategory: genre,
            tags: [],
            start_date: startDate,
            end_date: null,
            time_text: localTime.slice(0, 5),
            venue_name: venue?.name || '',
            address: venue?.address?.line1 || '',
            city,
            state,
            country: 'México',
            latitude: lat && !isNaN(lat) ? lat : null,
            longitude: lng && !isNaN(lng) ? lng : null,
            price_text: '',
            is_free: false,
            image_url: image?.url || '',
            confidence_score: 1.0,
            slug: EventUtils.generateSlug(`${ev.name || 'evento'}-${localDate}`),
            dedup_hash: hash,
            source_name: 'Ticketmaster México',
            source_url: ev.url || '',
            source_type: 'api_ticketmaster',
            status: 'nuevo',
            published_at: null,
            scraped_at: now.toISOString(),
            updated_at: now.toISOString(),
          };

          if (this.isSupabase(this.db)) {
            const { error } = await this.db.from('events').insert(eventData);
            if (error) throw error;
          } else {
            const cols = Object.keys(eventData).join(', ');
            const placeholders = Object.keys(eventData).map((_, i) => `$${i + 1}`).join(', ');
            await (this.db as Pool).query(
              `INSERT INTO events (${cols}) VALUES (${placeholders})`,
              Object.values(eventData)
            );
          }
          inserted++;
        } catch (err) {
          console.error('[Ticketmaster] Failed to insert event:', err);
          errors++;
        }
      }

      if (page + 1 >= Math.min(maxPages, totalPages)) break;
    }

    console.log(`[Ticketmaster] Done — inserted: ${inserted}, dupes: ${duplicates}, errors: ${errors}`);
    return { inserted, duplicates, errors };
  }
}
