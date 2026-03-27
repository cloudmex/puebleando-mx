/**
 * Multi-source city data aggregation for the weekend planner.
 *
 * Queries all available verified sources IN PARALLEL, saves results to DB,
 * and returns the combined Place[] + Event[] pool for LLM curation.
 *
 * Sources (all run in parallel, failures are silently ignored):
 *   DENUE/INEGI   → places   (requires DENUE_API_TOKEN)
 *   Ticketmaster  → events   (requires TICKETMASTER_API_KEY)
 *   Eventbrite    → events   (requires EVENTBRITE_API_KEY)
 *   Serper        → events   (requires SERPER_API_KEY + GROQ_API_KEY)
 *     Google-searches "eventos fin de semana {ciudad}", extracts structured
 *     events via LLM from the organic snippets, then saves them to DB.
 *
 * Results are deduplicated by ID before being returned.
 */
import Groq from 'groq-sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Pool } from 'pg';
import type { Place } from '../../types';
import type { Event } from '../../types/events';
import { syncDenueForCity } from './denue';
import { syncTourismForCity } from './tourism-data';
import { EventUtils, Deduplicator } from './normalizer';

const ALLOWED_CATEGORIES = [
  'gastronomia', 'cultura', 'naturaleza', 'mercados', 'artesanos', 'festivales',
] as const;

/** Convert ALL-CAPS or messy titles to proper Title Case */
function toTitleCase(s: string): string {
  // If less than 40% of letters are uppercase, assume it's already OK
  const letters = s.replace(/[^a-záéíóúñü]/gi, '');
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, '');
  if (letters.length > 0 && upper.length / letters.length < 0.6) return s;

  const LOWERCASE_WORDS = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'en', 'y', 'a', 'e', 'o', 'u', 'con', 'por', 'para', 'al', 'un', 'una']);
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      if (i > 0 && LOWERCASE_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

function isSupabase(db: SupabaseClient | Pool): db is SupabaseClient {
  return typeof (db as SupabaseClient).from === 'function';
}

// ── Ticketmaster: city + date-range filtered query ────────────────────────────

// Ticketmaster uses ASCII city names. Map known Mexican variants to their
// API-compatible form; for everything else, strip diacritics.
const TM_CITY_MAP: Record<string, string> = {
  'cdmx': 'Mexico City',
  'df': 'Mexico City',
  'ciudad de mexico': 'Mexico City',
  'ciudad de méxico': 'Mexico City',
  'mexico city': 'Mexico City',
};

function normalizeCityForTM(city: string): string {
  const lower = city.toLowerCase().trim();
  if (TM_CITY_MAP[lower]) return TM_CITY_MAP[lower];
  // Strip diacritics for other cities (Oaxaca, Mérida, etc.)
  return city.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const TM_SEGMENT_MAP: Record<string, string> = {
  Music: 'cultura',
  'Arts & Theatre': 'cultura',
  Film: 'cultura',
  Family: 'festivales',
  Sports: 'festivales',
  Miscellaneous: 'festivales',
};

async function syncTicketmasterCity(
  db: SupabaseClient | Pool,
  city: string,
  startDate: Date,
  endDate: Date,
): Promise<Event[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return [];

  const startStr = startDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const endStr = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');

  const params = new URLSearchParams({
    apikey: apiKey,
    countryCode: 'MX',
    city: normalizeCityForTM(city),
    startDateTime: startStr,
    endDateTime: endStr,
    size: '25',
    sort: 'date,asc',
  });

  const events: Event[] = [];
  const now = new Date();

  try {
    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?${params}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) {
      console.warn(`[CitySources/TM] API error ${res.status}`);
      return [];
    }

    const data = await res.json();
    const tmEvents: unknown[] = data?._embedded?.events ?? [];

    for (const ev of tmEvents as Record<string, unknown>[]) {
      try {
        const venue = (ev as Record<string, unknown>)?._embedded as Record<string, unknown> | undefined;
        const venues = (venue?.venues as unknown[]) ?? [];
        const v = venues[0] as Record<string, unknown> | undefined;

        const location = v?.location as Record<string, string | number> | undefined;
        const lat = location?.latitude ? parseFloat(String(location.latitude)) : null;
        const lng = location?.longitude ? parseFloat(String(location.longitude)) : null;
        const evCity = (v?.city as Record<string, string> | undefined)?.name ?? city;
        const evState = (v?.state as Record<string, string> | undefined)?.name ?? '';

        const classifications = (ev.classifications as unknown[]) ?? [];
        const classification =
          (classifications as Record<string, unknown>[]).find((c) => c.primary) ??
          (classifications as Record<string, unknown>[])[0];
        const segment = (classification?.segment as Record<string, string> | undefined)?.name ?? '';
        const genre = (classification?.genre as Record<string, string> | undefined)?.name ?? '';
        const category = TM_SEGMENT_MAP[segment] ?? 'festivales';

        const dates = ev.dates as Record<string, unknown> | undefined;
        const start = dates?.start as Record<string, string> | undefined;
        const localDate = start?.localDate ?? '';
        const localTime = start?.localTime ?? '00:00:00';
        const startDateStr = (start?.dateTime as string | undefined) ?? `${localDate}T${localTime}Z`;

        const images = ((ev.images as unknown[]) ?? []) as Record<string, number | string>[];
        const image = images.sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0))[0];

        const hash = EventUtils.generateDedupHash({
          title: String(ev.name ?? ''),
          start_date: startDateStr,
          city: evCity,
        });
        if (await Deduplicator.isDuplicate(hash, db)) continue;

        const shortDesc = [segment, genre, evCity, evState ? `(${evState})` : '']
          .filter(Boolean)
          .join(' · ')
          .slice(0, 200);

        // Best available description: info > pleaseNote > empty
        const tmDesc = [String(ev.info ?? ''), String(ev.pleaseNote ?? '')]
          .map((s) => s.trim()).filter(Boolean).join(' ').slice(0, 1000);

        const eventData: Record<string, unknown> = {
          title: toTitleCase(String(ev.name ?? 'Sin título')).slice(0, 255),
          description: tmDesc,
          short_description: shortDesc,
          category,
          subcategory: genre,
          tags: [],
          start_date: startDateStr,
          end_date: null,
          time_text: localTime.slice(0, 5),
          venue_name: String(v?.name ?? ''),
          address: String((v?.address as Record<string, string> | undefined)?.line1 ?? ''),
          city: evCity,
          state: evState,
          country: 'México',
          latitude: lat && !isNaN(lat) ? lat : null,
          longitude: lng && !isNaN(lng) ? lng : null,
          price_text: '',
          is_free: false,
          image_url: String(image?.url ?? ''),
          confidence_score: 1.0,
          slug: EventUtils.generateSlug(`${String(ev.name ?? 'evento')}-${localDate}`),
          dedup_hash: hash,
          source_name: 'Ticketmaster México',
          source_url: String(ev.url ?? ''),
          source_type: 'api_ticketmaster',
          status: 'nuevo',
          scraped_at: now.toISOString(),
          updated_at: now.toISOString(),
        };

        if (isSupabase(db)) {
          const { data: inserted } = await db
            .from('events')
            .upsert(eventData, { onConflict: 'slug', ignoreDuplicates: true })
            .select()
            .maybeSingle();
          if (inserted) events.push(inserted as Event);
        } else {
          const cols = Object.keys(eventData).join(', ');
          const placeholders = Object.keys(eventData).map((_, i) => `$${i + 1}`).join(', ');
          const { rows } = await (db as Pool).query(
            `INSERT INTO events (${cols}) VALUES (${placeholders}) ON CONFLICT (slug) DO NOTHING RETURNING *`,
            Object.values(eventData),
          );
          if (rows[0]) events.push(rows[0] as Event);
        }
      } catch { /* skip individual event errors */ }
    }

    console.log(`[CitySources/Ticketmaster] ${events.length} events for "${city}"`);
  } catch (err: unknown) {
    console.warn('[CitySources/Ticketmaster] Failed:', (err as Error).message);
  }

  return events;
}

// ── Eventbrite: lat/lng radius + date-range filtered query ───────────────────

const EB_CATEGORY_MAP: Record<string, string> = {
  '103': 'cultura',
  '104': 'cultura',
  '105': 'cultura',
  '108': 'festivales',
  '110': 'gastronomia',
  '113': 'cultura',
  '116': 'naturaleza',
  '119': 'mercados',
};

async function syncEventbriteCity(
  db: SupabaseClient | Pool,
  lat: number,
  lng: number,
  startDate: Date,
  endDate: Date,
): Promise<Event[]> {
  const token = process.env.EVENTBRITE_API_KEY;
  if (!token) return [];

  const params = new URLSearchParams({
    'location.latitude': String(lat),
    'location.longitude': String(lng),
    'location.within': '50km',
    'start_date.range_start': startDate.toISOString(),
    'start_date.range_end': endDate.toISOString(),
    expand: 'venue,category',
    page_size: '25',
    sort_by: 'start_asc',
  });

  const events: Event[] = [];
  const now = new Date();

  try {
    const res = await fetch(
      `https://www.eventbriteapi.com/v3/events/search/?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) {
      console.warn(`[CitySources/EB] API error ${res.status}`);
      return [];
    }

    const data = await res.json();
    const ebEvents: unknown[] = data.events ?? [];

    for (const ev of ebEvents as Record<string, unknown>[]) {
      try {
        const venue = ev.venue as Record<string, unknown> | undefined;
        const address = venue?.address as Record<string, string> | undefined;
        const evCity = address?.city ?? String(venue?.city ?? '');
        const evState = address?.region ?? '';
        const lat2 = venue?.latitude ? parseFloat(String(venue.latitude)) : null;
        const lng2 = venue?.longitude ? parseFloat(String(venue.longitude)) : null;

        const startObj = ev.start as Record<string, string> | undefined;
        const startDateStr = startObj?.utc ?? '';
        const endObj = ev.end as Record<string, string> | undefined;

        const nameObj = ev.name as Record<string, string> | undefined;
        const title = nameObj?.text ?? 'Sin título';
        const descObj = ev.description as Record<string, string> | undefined;
        const categoryObj = ev.category as Record<string, string> | undefined;
        const category = EB_CATEGORY_MAP[categoryObj?.id ?? ''] ?? 'festivales';

        const hash = EventUtils.generateDedupHash({
          title,
          start_date: startDateStr,
          city: evCity,
        });
        if (await Deduplicator.isDuplicate(hash, db)) continue;

        const logoObj = ev.logo as Record<string, string> | undefined;

        const eventData: Record<string, unknown> = {
          title: title.slice(0, 255),
          description: (descObj?.text ?? '').slice(0, 1000),
          short_description: String(ev.summary ?? '').slice(0, 200),
          category,
          subcategory: '',
          tags: [],
          start_date: startDateStr,
          end_date: endObj?.utc ?? null,
          time_text: '',
          venue_name: String(venue?.name ?? ''),
          address: address?.address_1 ?? '',
          city: evCity,
          state: evState,
          country: 'México',
          latitude: lat2 && !isNaN(lat2) ? lat2 : null,
          longitude: lng2 && !isNaN(lng2) ? lng2 : null,
          price_text: ev.is_free ? 'Gratis' : '',
          is_free: Boolean(ev.is_free ?? false),
          image_url: logoObj?.url ?? '',
          confidence_score: 0.9,
          slug: EventUtils.generateSlug(`${title}-${startDateStr.slice(0, 10)}`),
          dedup_hash: hash,
          source_name: 'Eventbrite',
          source_url: String(ev.url ?? ''),
          source_type: 'api_eventbrite',
          status: 'nuevo',
          scraped_at: now.toISOString(),
          updated_at: now.toISOString(),
        };

        if (isSupabase(db)) {
          const { data: inserted } = await db
            .from('events')
            .upsert(eventData, { onConflict: 'slug', ignoreDuplicates: true })
            .select()
            .maybeSingle();
          if (inserted) events.push(inserted as Event);
        } else {
          const cols = Object.keys(eventData).join(', ');
          const placeholders = Object.keys(eventData).map((_, i) => `$${i + 1}`).join(', ');
          const { rows } = await (db as Pool).query(
            `INSERT INTO events (${cols}) VALUES (${placeholders}) ON CONFLICT (slug) DO NOTHING RETURNING *`,
            Object.values(eventData),
          );
          if (rows[0]) events.push(rows[0] as Event);
        }
      } catch { /* skip individual event errors */ }
    }

    console.log(`[CitySources/Eventbrite] ${events.length} events near (${lat.toFixed(2)}, ${lng.toFixed(2)})`);
  } catch (err: unknown) {
    console.warn('[CitySources/Eventbrite] Failed:', (err as Error).message);
  }

  return events;
}

// ── Serper: Google search → LLM extract → save events ────────────────────────

async function searchSerperEvents(
  db: SupabaseClient | Pool,
  ciudad: string,
  weekendStart: Date,
  weekendEnd: Date,
): Promise<Event[]> {
  const serperKey = process.env.SERPER_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!serperKey || !groqKey) return [];

  // Weekend date labels in Spanish
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const year = weekendStart.getUTCFullYear();
  const friLabel = fmt(weekendStart);
  const sunLabel = fmt(weekendEnd);

  const queries = [
    `eventos ${ciudad} ${friLabel} ${sunLabel} ${year}`,
    `agenda cultural fin de semana ${ciudad} ${year}`,
  ];

  // 1. Parallel Serper queries
  const serperResults = await Promise.allSettled(
    queries.map((q) =>
      fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, gl: 'mx', hl: 'es', num: 10 }),
        signal: AbortSignal.timeout(8_000),
      }).then((r) => r.json()),
    ),
  );

  // 2. Collect unique organic snippets
  const seen = new Set<string>();
  const snippets: { title: string; snippet: string; link: string; imageUrl?: string }[] = [];
  for (const r of serperResults) {
    if (r.status !== 'fulfilled') continue;
    for (const item of (r.value?.organic ?? []) as Record<string, string>[]) {
      if (!item.link || seen.has(item.link)) continue;
      seen.add(item.link);
      snippets.push({ title: item.title ?? '', snippet: item.snippet ?? '', link: item.link, imageUrl: item.imageUrl || item.thumbnailUrl || undefined });
    }
  }

  if (snippets.length === 0) {
    console.log(`[CitySources/Serper] No snippets found for "${ciudad}"`);
    return [];
  }

  // Build a URL→image lookup so we can attach images to extracted events
  const urlImageMap = new Map<string, string>();
  for (const s of snippets) {
    if (s.imageUrl && s.link) urlImageMap.set(s.link, s.imageUrl);
  }

  // 3. LLM extraction — ask the model to pull structured events from the snippets
  const snippetsText = snippets
    .slice(0, 15)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nURL: ${r.link}`)
    .join('\n\n');

  const prompt = `Eres un extractor de eventos culturales. A continuación hay snippets de búsqueda de Google sobre eventos en "${ciudad}" para el fin de semana del ${friLabel} al ${sunLabel} ${year}.

SNIPPETS:
${snippetsText}

Extrae SOLO eventos que:
- Ocurran claramente en ${ciudad} o municipios cercanos
- Caigan en ese fin de semana (${friLabel}–${sunLabel} ${year})
- Tengan nombre y lugar mencionados explícitamente en el snippet

No inventes detalles que no aparezcan en el snippet.

Responde ÚNICAMENTE con este JSON (sin markdown):
{
  "events": [
    {
      "title": "Nombre exacto del evento",
      "venue_name": "Nombre del recinto o lugar",
      "description": "Descripción ≤ 150 chars tomada del snippet",
      "category": "una de: cultura, gastronomia, naturaleza, mercados, artesanos, festivales",
      "start_date": "ISO 8601, ej: ${weekendStart.toISOString().slice(0, 10)}T20:00:00",
      "is_free": false,
      "source_url": "URL del snippet"
    }
  ]
}`;

  let extracted: Record<string, unknown>[] = [];
  try {
    const groq = new Groq({ apiKey: groqKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
    extracted = Array.isArray(parsed.events) ? (parsed.events as Record<string, unknown>[]) : [];
  } catch (err: unknown) {
    console.warn('[CitySources/Serper] LLM extraction failed:', (err as Error).message);
    return [];
  }

  // 4. Validate dates + save to DB
  const events: Event[] = [];
  const now = new Date();
  // Accept dates from 1 day before weekend start to 1 day after end (timezone buffer)
  const rangeStart = new Date(weekendStart.getTime() - 86_400_000);
  const rangeEnd = new Date(weekendEnd.getTime() + 86_400_000);

  for (const ev of extracted) {
    const rawTitle = String(ev.title ?? '').trim();
    if (!rawTitle) continue;
    const title = toTitleCase(rawTitle);

    // Parse and validate date — NO fallback to Friday.
    // Events without a valid, in-range date are discarded to prevent
    // polluting the DB with fake-dated entries.
    const rawDate = String(ev.start_date ?? '');
    const parsed = rawDate ? new Date(rawDate) : null;
    const startDate =
      parsed && !isNaN(parsed.getTime()) && parsed >= rangeStart && parsed <= rangeEnd
        ? parsed.toISOString()
        : null;

    if (!startDate) {
      console.log(`[CitySources/Serper] Discarding "${title}" — no valid date in range (raw: ${rawDate})`);
      continue;
    }

    try {
      const hash = EventUtils.generateDedupHash({ title, start_date: startDate, city: ciudad });
      if (await Deduplicator.isDuplicate(hash, db)) continue;

      const eventData: Record<string, unknown> = {
        title: title.slice(0, 255),
        description: String(ev.description ?? '').slice(0, 500),
        short_description: String(ev.description ?? '').slice(0, 200),
        category: ALLOWED_CATEGORIES.includes(String(ev.category ?? '') as typeof ALLOWED_CATEGORIES[number])
          ? String(ev.category)
          : 'festivales',
        subcategory: '',
        tags: [],
        start_date: startDate,
        end_date: null,
        time_text: '',
        venue_name: String(ev.venue_name ?? '').slice(0, 255),
        address: '',
        city: ciudad,
        state: '',
        country: 'México',
        latitude: null,
        longitude: null,
        price_text: Boolean(ev.is_free) ? 'Gratis' : '',
        is_free: Boolean(ev.is_free),
        image_url: urlImageMap.get(String(ev.source_url ?? '')) ?? '',
        confidence_score: 0.65,
        slug: EventUtils.generateSlug(`${title}-${startDate.slice(0, 10)}`),
        dedup_hash: hash,
        source_name: 'Búsqueda local (Google)',
        source_url: String(ev.source_url ?? '').slice(0, 500),
        source_type: 'serper_search',
        status: 'nuevo',
        scraped_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      if (isSupabase(db)) {
        const { data: inserted } = await db
          .from('events')
          .upsert(eventData, { onConflict: 'slug', ignoreDuplicates: true })
          .select()
          .maybeSingle();
        if (inserted) events.push(inserted as Event);
      } else {
        const cols = Object.keys(eventData).join(', ');
        const placeholders = Object.keys(eventData).map((_, i) => `$${i + 1}`).join(', ');
        const { rows } = await (db as Pool).query(
          `INSERT INTO events (${cols}) VALUES (${placeholders}) ON CONFLICT (slug) DO NOTHING RETURNING *`,
          Object.values(eventData),
        );
        if (rows[0]) events.push(rows[0] as Event);
      }
    } catch { /* skip */ }
  }

  console.log(`[CitySources/Serper] ${events.length} events saved for "${ciudad}"`);
  return events;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface CitySourcesResult {
  places: Place[];
  events: Event[];
  /** How many items each source contributed */
  sources: { denue: number; tourism: number; ticketmaster: number; eventbrite: number; serper: number };
}

/**
 * Aggregate all available verified sources for a specific city in parallel.
 * Results are saved to DB (fire-and-save) and returned immediately.
 *
 * @param db       Supabase or pg Pool (write access)
 * @param ciudad   Display name of the city (used for DENUE + TM city param)
 * @param lat      Latitude of city centre (for DENUE + Eventbrite radius query)
 * @param lng      Longitude of city centre
 * @param weekendStart  Start of the weekend window
 * @param weekendEnd    End of the weekend window
 */
export async function gatherSourcesForCity(
  db: SupabaseClient | Pool,
  ciudad: string,
  lat: number,
  lng: number,
  weekendStart: Date,
  weekendEnd: Date,
): Promise<CitySourcesResult> {
  const [denueResult, tourismResult, tmResult, ebResult, serperResult] = await Promise.allSettled([
    process.env.DENUE_API_TOKEN
      ? syncDenueForCity(db, lat, lng, ciudad)
      : Promise.resolve([] as Place[]),
    // Tourism data (zonas arqueológicas, cenotes, playas, pueblos mágicos)
    // Always runs — no API key needed, uses curated local data
    syncTourismForCity(db, lat, lng, ciudad),
    syncTicketmasterCity(db, ciudad, weekendStart, weekendEnd),
    syncEventbriteCity(db, lat, lng, weekendStart, weekendEnd),
    searchSerperEvents(db, ciudad, weekendStart, weekendEnd),
  ]);

  const places = [
    ...(denueResult.status === 'fulfilled' ? denueResult.value : []),
    ...(tourismResult.status === 'fulfilled' ? tourismResult.value : []),
  ];
  const events = [
    ...(tmResult.status === 'fulfilled' ? tmResult.value : []),
    ...(ebResult.status === 'fulfilled' ? ebResult.value : []),
    ...(serperResult.status === 'fulfilled' ? serperResult.value : []),
  ];

  // Deduplicate by ID
  const seenPlaces = new Set<string>();
  const seenEvents = new Set<string>();

  return {
    places: places.filter((p) => {
      if (seenPlaces.has(p.id)) return false;
      seenPlaces.add(p.id);
      return true;
    }),
    events: events.filter((e) => {
      if (seenEvents.has(e.id)) return false;
      seenEvents.add(e.id);
      return true;
    }),
    sources: {
      denue: denueResult.status === 'fulfilled' ? denueResult.value.length : 0,
      tourism: tourismResult.status === 'fulfilled' ? tourismResult.value.length : 0,
      ticketmaster: tmResult.status === 'fulfilled' ? tmResult.value.length : 0,
      eventbrite: ebResult.status === 'fulfilled' ? ebResult.value.length : 0,
      serper: serperResult.status === 'fulfilled' ? serperResult.value.length : 0,
    },
  };
}
