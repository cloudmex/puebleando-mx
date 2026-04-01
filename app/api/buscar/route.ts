/**
 * GET /api/buscar?q=&category=&limit=
 *
 * Searches places + events in Supabase using full-text ilike.
 * Extracts city/state hints from the query to boost relevance.
 * Returns { places, events, intent } — no LLM involved here (speed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getPool } from '@/lib/db';
import type { Place } from '@/types';
import type { Event } from '@/types/events';

// Shared tag expansion — single source of truth in lib/vibeScoring.ts
import { expandTripTags } from '@/lib/vibeScoring';

// Common Mexican cities/states for intent extraction
const LOCATIONS: Record<string, string> = {
  'cdmx': 'Ciudad de México', 'ciudad de mexico': 'Ciudad de México',
  'df': 'Ciudad de México', 'mexico city': 'Ciudad de México',
  'guadalajara': 'Guadalajara', 'gdl': 'Guadalajara',
  'monterrey': 'Monterrey', 'mty': 'Monterrey',
  'oaxaca': 'Oaxaca', 'puebla': 'Puebla',
  'merida': 'Mérida', 'mérida': 'Mérida',
  'cancun': 'Cancún', 'cancún': 'Cancún',
  'tulum': 'Tulum', 'playa del carmen': 'Playa del Carmen',
  'san cristobal': 'San Cristóbal de las Casas',
  'guanajuato': 'Guanajuato', 'queretaro': 'Querétaro', 'querétaro': 'Querétaro',
  'morelia': 'Morelia', 'xalapa': 'Xalapa', 'veracruz': 'Veracruz',
  'zacatecas': 'Zacatecas', 'durango': 'Durango', 'chihuahua': 'Chihuahua',
  'tijuana': 'Tijuana', 'hermosillo': 'Hermosillo', 'mazatlan': 'Mazatlán',
  'puerto vallarta': 'Puerto Vallarta', 'acapulco': 'Acapulco',
  'leon': 'León', 'toluca': 'Toluca', 'aguascalientes': 'Aguascalientes',
};

const CATEGORY_KEYWORDS: Record<string, string> = {
  'museo': 'cultura', 'galeria': 'cultura', 'teatro': 'cultura',
  'concierto': 'cultura', 'arte': 'cultura', 'cultural': 'cultura',
  'musica': 'cultura', 'danza': 'cultura', 'exposicion': 'cultura',
  'restaurante': 'gastronomia', 'comida': 'gastronomia', 'gastronomia': 'gastronomia',
  'taco': 'gastronomia', 'cocina': 'gastronomia', 'chef': 'gastronomia',
  'mercado': 'mercados', 'tianguis': 'mercados',
  'artesania': 'artesanos', 'artesanal': 'artesanos', 'taller': 'artesanos',
  'naturaleza': 'naturaleza', 'parque': 'naturaleza', 'bosque': 'naturaleza',
  'cascada': 'naturaleza', 'laguna': 'naturaleza', 'playa': 'naturaleza',
  'festival': 'festivales', 'feria': 'festivales', 'festejo': 'festivales',
};

function extractIntent(query: string): { city?: string; category?: string; keywords: string[] } {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let city: string | undefined;
  for (const [key, val] of Object.entries(LOCATIONS)) {
    if (q.includes(key)) { city = val; break; }
  }

  let category: string | undefined;
  for (const [key, val] of Object.entries(CATEGORY_KEYWORDS)) {
    if (q.includes(key)) { category = val; break; }
  }

  const keywords = query.trim().split(/\s+/).filter(w => w.length > 2);
  return { city, category, keywords };
}

function rowToPlace(row: Record<string, unknown>): Place {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
    category: row.category as Place['category'],
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    photos: Array.isArray(row.photos) ? row.photos as string[] : [],
    town: String(row.town ?? ''),
    state: String(row.state ?? ''),
    tags: Array.isArray(row.tags) ? row.tags as string[] : [],
    importance_score: row.importance_score != null ? Number(row.importance_score) : undefined,
    created_at: String(row.created_at ?? ''),
  };
}

function rowToEvent(row: Record<string, unknown>): Event {
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    description: String(row.description ?? ''),
    short_description: String(row.short_description ?? ''),
    source_name: String(row.source_name ?? ''),
    source_url: String(row.source_url ?? ''),
    source_type: String(row.source_type ?? 'web'),
    category: String(row.category ?? ''),
    tags: Array.isArray(row.tags) ? row.tags as string[] : [],
    start_date: String(row.start_date),
    end_date: row.end_date ? String(row.end_date) : undefined,
    time_text: String(row.time_text ?? ''),
    venue_name: String(row.venue_name ?? ''),
    address: String(row.address ?? ''),
    city: String(row.city ?? ''),
    state: String(row.state ?? ''),
    country: String(row.country ?? 'México'),
    latitude: row.latitude ? Number(row.latitude) : undefined,
    longitude: row.longitude ? Number(row.longitude) : undefined,
    price_text: String(row.price_text ?? ''),
    is_free: Boolean(row.is_free),
    image_url: String(row.image_url ?? ''),
    scraped_at: String(row.scraped_at),
    updated_at: String(row.updated_at),
    status: row.status as Event['status'],
    confidence_score: Number(row.confidence_score ?? 0),
    importance_score: row.importance_score != null ? Number(row.importance_score) : undefined,
    dedup_hash: String(row.dedup_hash ?? ''),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q')?.trim() ?? '';
  const categoryParam = searchParams.get('category') ?? '';
  const tripTagsParam = searchParams.get('tripTags') ?? '';
  const tripTags = tripTagsParam ? tripTagsParam.split(',').map(t => t.trim()).filter(Boolean) : [];
  const boostCatsParam = searchParams.get('boostCats') ?? '';
  const explicitBoostCats = boostCatsParam ? boostCatsParam.split(',').map(c => c.trim()).filter(Boolean) : [];
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '24'), 60);

  if (!query && !categoryParam && tripTags.length === 0) {
    return NextResponse.json({ places: [], events: [], intent: {} });
  }

  const intent = extractIntent(query);
  const category = categoryParam || intent.category;

  const sb = getSupabaseServerClient(false);
  const pool = getPool();

  let places: Place[] = [];
  let events: Event[] = [];

  if (sb) {
    // ── Supabase search ────────────────────────────────────────────────────

    if (tripTags.length > 0) {
      // Trip-type search: expand narrow tags into broader matches
      const { expandedTags, boostCategories } = expandTripTags(tripTags);
      // Merge explicit boost categories from frontend (TripType.boostCategories)
      const allBoostCats = [...new Set([...boostCategories, ...explicitBoostCats])];

      // Match by: expanded tag overlap, description keywords, OR category match
      const tagFilter = expandedTags.map(t => `tags.cs.{${t}}`).join(',');
      const descFilter = expandedTags.slice(0, 8).map(t => `description.ilike.%${t}%`).join(',');
      const catFilter = allBoostCats.map(c => `category.eq.${c}`).join(',');

      const orParts = [tagFilter, descFilter, catFilter].filter(Boolean).join(',');

      let placesQ = sb
        .from('places')
        .select('*')
        .or(orParts)
        .order('importance_score', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (category) placesQ = placesQ.eq('category', category);

      const { data: pData } = await placesQ;
      places = (pData ?? []).map(rowToPlace);

    } else {
      // Text/category search
      const cityLower = intent.city?.toLowerCase() ?? '';
      const meaningfulKeywords = intent.keywords.filter(
        kw => kw.length > 2 && !cityLower.includes(kw.toLowerCase()) && kw.toLowerCase() !== cityLower
      );

      const buildTextFilter = (cols: string[]) => {
        const terms = meaningfulKeywords.length > 0 ? meaningfulKeywords : [query];
        return terms.flatMap(kw => cols.map(col => `${col}.ilike.%${kw}%`)).join(',');
      };

      const placeTextFilter = buildTextFilter(['name', 'description', 'town', 'state']);
      const eventTextFilter = buildTextFilter(['title', 'description', 'city', 'venue_name']);

      let placesQ = sb
        .from('places')
        .select('*')
        .or(placeTextFilter)
        .order('importance_score', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (category) placesQ = placesQ.eq('category', category);
      if (intent.city) placesQ = placesQ.or(`town.ilike.%${intent.city}%,state.ilike.%${intent.city}%`);

      const cutoff = new Date(Date.now() - 3600 * 1000).toISOString();
      let eventsQ = sb
        .from('events')
        .select('*')
        .or(eventTextFilter)
        .in('status', ['publicado', 'nuevo'])
        .gte('start_date', cutoff)
        .order('start_date', { ascending: true })
        .limit(limit);

      if (intent.city) eventsQ = eventsQ.or(`city.ilike.%${intent.city}%,state.ilike.%${intent.city}%`);

      const [{ data: pData }, { data: eData }] = await Promise.all([placesQ, eventsQ]);
      places = (pData ?? []).map(rowToPlace);
      events = (eData ?? []).map(rowToEvent);
    }

  } else if (pool) {
    // ── PostgreSQL search ──────────────────────────────────────────────────
    if (tripTags.length > 0) {
      const { expandedTags, boostCategories } = expandTripTags(tripTags);
      const allBoostCatsPg = [...new Set([...boostCategories, ...explicitBoostCats])];
      // Match expanded tags OR boosted categories
      const catClause = allBoostCatsPg.length > 0
        ? ` OR category = ANY($3::text[])`
        : '';
      const params: unknown[] = [expandedTags, limit];
      if (allBoostCatsPg.length > 0) params.push(allBoostCatsPg);
      const pRes = await pool.query(
        `SELECT * FROM places
         WHERE tags && $1::text[]${catClause}
         ORDER BY importance_score DESC NULLS LAST
         LIMIT $2`,
        params
      );
      places = pRes.rows.map(rowToPlace);
    } else {
      const like = `%${query}%`;
      const [pRes, eRes] = await Promise.all([
        pool.query(
          `SELECT * FROM places
           WHERE (name ILIKE $1 OR description ILIKE $1 OR town ILIKE $1 OR state ILIKE $1)
             ${category ? 'AND category = $2' : ''}
           ORDER BY importance_score DESC NULLS LAST
           LIMIT $${category ? 3 : 2}`,
          category ? [like, category, limit] : [like, limit]
        ),
        pool.query(
          `SELECT * FROM events
           WHERE (title ILIKE $1 OR description ILIKE $1 OR city ILIKE $1)
             AND status IN ('publicado','nuevo')
             AND start_date >= NOW() - INTERVAL '1 hour'
           ORDER BY start_date ASC
           LIMIT $2`,
          [like, limit]
        ),
      ]);
      places = pRes.rows.map(rowToPlace);
      events = eRes.rows.map(rowToEvent);
    }
  }

  return NextResponse.json({ places, events, intent, total: places.length + events.length });
}
