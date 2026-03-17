/**
 * CDMX Cartelera Cultural — WordPress REST API
 * No API key required. Free cultural events from the Mexico City government portal.
 */
import { Pool } from 'pg';
import { SupabaseClient } from '@supabase/supabase-js';
import { EventUtils, Deduplicator } from './normalizer';

const BASE_TRIBE = 'https://cartelera.cdmx.gob.mx/wp-json/tribe/events/v1/events';
const BASE_WP    = 'https://cartelera.cdmx.gob.mx/wp-json/wp/v2/tribe_events';

// CDMX center fallback coords
const CDMX_LAT = 19.4326;
const CDMX_LNG = -99.1332;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function mapCategory(categories: any[]): string {
  if (!categories?.length) return 'cultura';
  const names = categories.map((c: any) => (c.name || '').toLowerCase());
  if (names.some(n => n.includes('música') || n.includes('musica') || n.includes('concert'))) return 'cultura';
  if (names.some(n => n.includes('feria') || n.includes('festival'))) return 'festivales';
  if (names.some(n => n.includes('mercado'))) return 'mercados';
  return 'cultura';
}

export interface CDMXSyncResult {
  inserted: number;
  duplicates: number;
  errors: number;
}

function isSupabase(db: any): db is SupabaseClient {
  return typeof db.from === 'function';
}

export class CDMXCarteleraSync {
  private db: SupabaseClient | Pool;

  constructor(db: SupabaseClient | Pool) {
    this.db = db;
  }

  private async fetchTribeEvents(pages: number): Promise<any[]> {
    const events: any[] = [];
    for (let page = 1; page <= pages; page++) {
      const url = `${BASE_TRIBE}?per_page=50&page=${page}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Puebleando/1.0' } });
      if (!res.ok) return events; // endpoint not available, return what we have
      const data = await res.json();
      const items: any[] = data?.events || [];
      events.push(...items);
      if (!data.next_rest_url) break;
    }
    return events;
  }

  private async fetchWpEvents(pages: number): Promise<any[]> {
    const events: any[] = [];
    for (let page = 1; page <= pages; page++) {
      const url = `${BASE_WP}?per_page=50&page=${page}&_embed=true`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Puebleando/1.0' } });
      if (!res.ok) break;
      const items: any[] = await res.json();
      if (!Array.isArray(items) || items.length === 0) break;
      events.push(...items);
    }
    return events;
  }

  private normalizeTribeEvent(ev: any): Record<string, any> | null {
    const title = ev.title?.rendered ? stripHtml(ev.title.rendered) : ev.title;
    if (!title) return null;

    const startDate = ev.start_date || ev.start_date_details?.date || '';
    if (!startDate) return null;

    const venue = ev.venue || {};
    const city = venue.city || 'Ciudad de México';
    const lat = parseFloat(venue.geo_lat) || null;
    const lng = parseFloat(venue.geo_lng) || null;

    const descRaw = ev.description?.rendered || ev.description || '';
    const desc = stripHtml(descRaw);

    return {
      title: title.slice(0, 255),
      description: desc.slice(0, 2000),
      short_description: desc.slice(0, 200),
      category: mapCategory(ev.categories || []),
      subcategory: '',
      tags: [],
      start_date: new Date(startDate).toISOString(),
      end_date: ev.end_date ? new Date(ev.end_date).toISOString() : null,
      time_text: startDate.length > 10 ? startDate.slice(11, 16) : '',
      venue_name: venue.venue || '',
      address: venue.address || '',
      city,
      state: 'Ciudad de México',
      country: 'México',
      latitude: lat && !isNaN(lat) ? lat : CDMX_LAT,
      longitude: lng && !isNaN(lng) ? lng : CDMX_LNG,
      price_text: '',
      is_free: true,
      image_url: ev.image?.url || '',
      confidence_score: 0.9,
      source_name: 'CDMX Cartelera Cultural',
      source_url: ev.url || ev.link || '',
      source_type: 'api_cdmx',
      status: 'nuevo',
      scraped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private normalizeWpEvent(ev: any): Record<string, any> | null {
    const title = ev.title?.rendered ? stripHtml(ev.title.rendered) : '';
    if (!title) return null;

    const featuredMedia = ev._embedded?.['wp:featuredmedia']?.[0];
    const imageUrl = featuredMedia?.source_url || '';
    const descRaw = ev.content?.rendered || '';
    const desc = stripHtml(descRaw);

    // WP events may not have tribe fields; use modified date as start_date fallback
    const startDate = ev.meta?._EventStartDate || ev.date || '';
    if (!startDate) return null;

    return {
      title: title.slice(0, 255),
      description: desc.slice(0, 2000),
      short_description: desc.slice(0, 200),
      category: 'cultura',
      subcategory: '',
      tags: [],
      start_date: new Date(startDate).toISOString(),
      end_date: null,
      time_text: '',
      venue_name: ev.meta?._EventVenue || '',
      address: ev.meta?._EventAddress || '',
      city: 'Ciudad de México',
      state: 'Ciudad de México',
      country: 'México',
      latitude: CDMX_LAT,
      longitude: CDMX_LNG,
      price_text: '',
      is_free: true,
      image_url: imageUrl,
      confidence_score: 0.8,
      source_name: 'CDMX Cartelera Cultural',
      source_url: ev.link || '',
      source_type: 'api_cdmx',
      status: 'nuevo',
      scraped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async sync(pages = 3): Promise<CDMXSyncResult> {
    let inserted = 0, duplicates = 0, errors = 0;

    // Try Tribe Events API first, fall back to WP REST
    let rawEvents: any[] = [];
    let useTribe = true;
    try {
      rawEvents = await this.fetchTribeEvents(pages);
    } catch {
      useTribe = false;
    }

    if (rawEvents.length === 0) {
      useTribe = false;
      try {
        rawEvents = await this.fetchWpEvents(pages);
      } catch (err) {
        throw new Error(`No se pudo conectar a CDMX Cartelera: ${err}`);
      }
    }

    console.log(`[CDMX] ${rawEvents.length} eventos via ${useTribe ? 'Tribe' : 'WP REST'}`);

    for (const ev of rawEvents) {
      try {
        const eventData = useTribe ? this.normalizeTribeEvent(ev) : this.normalizeWpEvent(ev);
        if (!eventData) { errors++; continue; }

        const hash = EventUtils.generateDedupHash({
          title: eventData.title,
          start_date: eventData.start_date,
          city: eventData.city,
        });

        if (await Deduplicator.isDuplicate(hash, this.db)) { duplicates++; continue; }

        eventData.slug = EventUtils.generateSlug(`${eventData.title}-${eventData.start_date.slice(0, 10)}`);
        eventData.dedup_hash = hash;

        if (isSupabase(this.db)) {
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
        console.error('[CDMX] Insert error:', err);
        errors++;
      }
    }

    console.log(`[CDMX] Done — inserted: ${inserted}, dupes: ${duplicates}, errors: ${errors}`);
    return { inserted, duplicates, errors };
  }
}
