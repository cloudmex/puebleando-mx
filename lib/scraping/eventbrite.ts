/**
 * Eventbrite API v3 — Mexico event sync
 * Requires: EVENTBRITE_API_KEY env var (private token)
 * Docs: https://www.eventbrite.com/platform/api
 */
import { Pool } from 'pg';
import { SupabaseClient } from '@supabase/supabase-js';
import { EventUtils, Deduplicator } from './normalizer';

const BASE = 'https://www.eventbriteapi.com/v3';

// Eventbrite category ID → our category slug
const CATEGORY_MAP: Record<string, string> = {
  '103': 'cultura',     // Music
  '104': 'cultura',     // Film & Media
  '105': 'cultura',     // Performing & Visual Arts
  '108': 'festivales',  // Festivals & Fairs
  '110': 'gastronomia', // Food & Drink
  '113': 'cultura',     // Community & Culture
  '116': 'naturaleza',  // Travel & Outdoor
  '119': 'mercados',    // Hobbies & Special Interest
};

export interface EventbriteSyncResult {
  inserted: number;
  duplicates: number;
  errors: number;
}

export class EventbriteSync {
  private token: string;
  private db: SupabaseClient | Pool;

  constructor(db: SupabaseClient | Pool) {
    this.token = process.env.EVENTBRITE_API_KEY || '';
    this.db = db;
  }

  private isSupabase(db: any): db is SupabaseClient {
    return typeof (db as any).from === 'function';
  }

  private mapCategory(categoryId?: string): string {
    if (!categoryId) return 'festivales';
    return CATEGORY_MAP[categoryId] ?? 'festivales';
  }

  async sync(maxPages = 5): Promise<EventbriteSyncResult> {
    if (!this.token) throw new Error('EVENTBRITE_API_KEY not set');

    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    let inserted = 0, duplicates = 0, errors = 0;

    for (let page = 1; page <= maxPages; page++) {
      // Use Mexico City coordinates as center; 2500km radius covers all of MX
      const params = new URLSearchParams({
        'location.latitude': '19.4326',
        'location.longitude': '-99.1332',
        'location.within': '2500km',
        'start_date.range_start': now.toISOString(),
        'start_date.range_end': in90Days.toISOString(),
        expand: 'venue,category',
        page_size: '50',
        page: String(page),
        sort_by: 'start_asc',
      });

      const res = await fetch(`${BASE}/events/search/?${params}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`[Eventbrite] API error page ${page}: HTTP ${res.status} — ${body.slice(0, 300)}`);
        break;
      }

      const data = await res.json();
      if (data.error) {
        console.error(`[Eventbrite] API error: ${data.error} — ${data.error_description}`);
        break;
      }
      const events: any[] = data.events || [];
      const pagination = data.pagination ?? {};
      console.log(`[Eventbrite] Page ${page}: ${events.length} events | total: ${pagination.object_count ?? '?'} | pages: ${pagination.page_count ?? '?'}`);
      if (page === 1 && events.length === 0) {
        console.warn(`[Eventbrite] Zero results on page 1. This usually means the Consumer API tier does not allow public event search. Apply to Eventbrite Partner Program for full access.`);
        break;
      }
      if (events.length === 0) break;

      for (const ev of events) {
        try {
          const venue = ev.venue;
          const countryCode = venue?.address?.country;
          if (countryCode && countryCode !== 'MX') continue;

          const lat = venue?.address?.latitude ? parseFloat(venue.address.latitude) : null;
          const lng = venue?.address?.longitude ? parseFloat(venue.address.longitude) : null;
          const city = venue?.address?.city || '';
          const state = venue?.address?.region || '';

          const category = this.mapCategory(ev.category?.id);
          const startDate = ev.start?.utc || now.toISOString();

          const hash = EventUtils.generateDedupHash({
            title: ev.name?.text || '',
            start_date: startDate,
            city,
          });

          if (await Deduplicator.isDuplicate(hash, this.db)) {
            duplicates++;
            continue;
          }

          const descText = (ev.description?.text || '').slice(0, 5000);
          const eventData: Record<string, any> = {
            title: (ev.name?.text || 'Sin título').slice(0, 255),
            description: descText,
            short_description: descText.slice(0, 200),
            category,
            subcategory: ev.category?.name || '',
            tags: [],
            start_date: startDate,
            end_date: ev.end?.utc || null,
            time_text: ev.start?.local ? ev.start.local.split('T')[1]?.slice(0, 5) || '' : '',
            venue_name: venue?.name || '',
            address: venue?.address?.address_1 || '',
            city,
            state,
            country: 'México',
            latitude: lat && !isNaN(lat) ? lat : null,
            longitude: lng && !isNaN(lng) ? lng : null,
            price_text: ev.is_free ? 'Gratis' : '',
            is_free: !!ev.is_free,
            image_url: ev.logo?.url || '',
            confidence_score: 1.0,
            slug: EventUtils.generateSlug(`${ev.name?.text || 'evento'}-${startDate.split('T')[0]}`),
            dedup_hash: hash,
            source_name: 'Eventbrite',
            source_url: ev.url || '',
            source_type: 'api_eventbrite',
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
          console.error('[Eventbrite] Failed to insert event:', err);
          errors++;
        }
      }

      if (events.length < 50) break; // last page
    }

    console.log(`[Eventbrite] Done — inserted: ${inserted}, dupes: ${duplicates}, errors: ${errors}`);
    return { inserted, duplicates, errors };
  }
}
