import Groq from "groq-sdk";
import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPool } from "@/lib/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import type { Place } from "@/types";
import type { Event } from "@/types/events";
import { GeocodingService } from "@/lib/scraping/geocoding";
import { gatherSourcesForCity } from "@/lib/scraping/city-sources";

export type DayKey = "viernes" | "sabado" | "domingo";

export type ResolvedStop = {
  order: number;
  hora: string;
  razon: string;
  day: DayKey;
  place?: Place;
  event?: Event;
  referenceUrl?: string;
  referenceName?: string;
};

export type WeekendPlanResponse =
  | { ciudad: string; resumen: string; dias: DayKey[]; viernes: ResolvedStop[]; sabado: ResolvedStop[]; domingo: ResolvedStop[] }
  | { empty: true; ciudad: string };

const norm = (s?: string) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// ── Weekend date range ────────────────────────────────────────────────────
// Uses UTC midnight boundaries so events stored as date-only (T00:00:00Z)
// are always captured, regardless of where the Next.js server runs.
function getWeekendDates() {
  const now = new Date();
  const dow = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysUntilSat = dow === 0 ? 6 : (6 - dow);

  const sat = new Date(now);
  sat.setUTCDate(now.getUTCDate() + daysUntilSat);
  sat.setUTCHours(0, 0, 0, 0);   // Sat 00:00 UTC

  const fri = new Date(sat);
  fri.setUTCDate(sat.getUTCDate() - 1);
  fri.setUTCHours(0, 0, 0, 0);   // Fri 00:00 UTC

  const sun = new Date(sat);
  sun.setUTCDate(sat.getUTCDate() + 1);
  sun.setUTCHours(23, 59, 59, 999); // Sun 23:59 UTC

  const locale = "es-MX";
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" };
  return {
    friStart: fri,
    satStart: sat,
    sunEnd: sun,
    friLabel: fri.toLocaleDateString(locale, dateOpts),
    satLabel: sat.toLocaleDateString(locale, dateOpts),
    sunLabel: sun.toLocaleDateString(locale, dateOpts),
    year: sat.getUTCFullYear(),
    month: sat.toLocaleDateString(locale, { month: "long", timeZone: "UTC" }),
  };
}

// ── Reference URL helpers ─────────────────────────────────────────────────
function mapsUrl(name: string, location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${location} México`)}`;
}

function safeHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function isValidUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url.startsWith("http")) return false;
  try { new URL(url); return true; } catch { return false; }
}

// ── City alias expansion (handles CDMX variants) ──────────────────────────
function getCityVariants(ciudad: string): string[] {
  const CDMX = ["cdmx", "df", "ciudad de mexico", "ciudad de mejico", "mexico city"];
  if (CDMX.includes(ciudad) || ciudad.includes("ciudad de mexico")) {
    return ["mexico", "ciudad de mexico"];
  }
  return [ciudad];
}

const VALID_CATS = new Set([
  "gastronomia", "cultura", "naturaleza", "mercados", "artesanos", "festivales",
]);

function isSupabaseClient(db: SupabaseClient | Pool): db is SupabaseClient {
  return typeof (db as SupabaseClient).from === "function";
}

function rowToPlace(r: Record<string, unknown>): Place {
  return {
    id: String(r.id),
    name: String(r.name),
    description: String(r.description ?? ""),
    category: r.category as Place["category"],
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
    town: String(r.town ?? ""),
    state: String(r.state ?? ""),
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    importance_score: r.importance_score != null ? Number(r.importance_score) : undefined,
    created_at: String(r.created_at ?? new Date().toISOString()),
  };
}

async function queryPlaces(db: SupabaseClient | Pool, ciudad: string): Promise<Place[]> {
  const like = `%${ciudad}%`;
  try {
    if (isSupabaseClient(db)) {
      const { data } = await db
        .from("places")
        .select("*")
        .or(`town.ilike.${like},state.ilike.${like}`)
        .limit(20);
      return (data ?? []).map(rowToPlace);
    }
    const { rows } = await (db as Pool).query(
      "SELECT * FROM places WHERE LOWER(town) ILIKE $1 OR LOWER(state) ILIKE $1 LIMIT 20",
      [like]
    );
    return rows.map(rowToPlace);
  } catch {
    return [];
  }
}

async function queryEvents(
  db: SupabaseClient | Pool,
  ciudad: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<Event[]> {
  const variants = getCityVariants(ciudad);
  try {
    if (isSupabaseClient(db)) {
      const orParts = variants.flatMap((v) => [
        `city.ilike.%${v}%`,
        `state.ilike.%${v}%`,
      ]);
      const { data } = await db
        .from("events")
        .select("*")
        .or(orParts.join(","))
        .in("status", ["publicado", "nuevo"])
        .gte("start_date", rangeStart.toISOString())
        .lte("start_date", rangeEnd.toISOString())
        .order("start_date", { ascending: true })
        .limit(30);
      return (data ?? []) as Event[];
    }
    const conditions = variants
      .map((v, i) => `(LOWER(city) ILIKE $${i + 3} OR LOWER(state) ILIKE $${i + 3})`)
      .join(" OR ");
    const { rows } = await (db as Pool).query(
      `SELECT * FROM events
       WHERE (${conditions})
         AND status IN ('publicado','nuevo')
         AND start_date >= $1
         AND start_date <= $2
       ORDER BY start_date ASC
       LIMIT 30`,
      [rangeStart.toISOString(), rangeEnd.toISOString(), ...variants.map((v) => `%${v}%`)]
    );
    return rows as Event[];
  } catch {
    return [];
  }
}



// ── Day label helpers ─────────────────────────────────────────────────────
function dayPromptLabel(d: DayKey, weekend: ReturnType<typeof getWeekendDates>): string {
  if (d === "viernes") return `VIERNES ${weekend.friLabel} (solo tarde/noche: actividades a partir de las 6pm)`;
  if (d === "sabado") return `SÁBADO ${weekend.satLabel}`;
  return `DOMINGO ${weekend.sunLabel}`;
}

function dayExampleHora(d: DayKey): string {
  if (d === "viernes") return "8:00 PM";
  if (d === "sabado") return "10:00 AM";
  return "11:00 AM";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rawCiudad: string = body?.ciudad ?? "";
  if (!rawCiudad.trim()) {
    return new Response(JSON.stringify({ error: "ciudad is required" }), { status: 400 });
  }

  const ciudad = norm(rawCiudad);
  const ciudadDisplay = rawCiudad.trim();
  const contexto: string = (body?.contexto ?? "").trim().slice(0, 400);

  // Validate and normalize dias
  const rawDias: unknown[] = Array.isArray(body?.dias) ? body.dias : ["sabado", "domingo"];
  const dias = (rawDias.filter((d) => ["viernes", "sabado", "domingo"].includes(d as string)) as DayKey[]);
  const activeDias: DayKey[] = dias.length > 0 ? dias : ["sabado", "domingo"];

  const readDb = getSupabaseClient() ?? getPool();

  if (!readDb) {
    return new Response(JSON.stringify({ error: "Base de datos no configurada" }), { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        } catch { /* stream closed */ }
      };

      try {
        // ══════════════════════════════════════════════════════════════════
        // PHASE 1 — Fetch verified data from DB
        // All records here are INEGI/DENUE-verified (denue-* IDs).
        // ══════════════════════════════════════════════════════════════════
        send({ type: "progress", step: 1, message: `Buscando en base de datos verificada de ${ciudadDisplay}...` });

        const weekend = getWeekendDates();
        const queryStart = activeDias.includes("viernes") ? weekend.friStart : weekend.satStart;
        const [dbPlaces, dbEvents] = await Promise.all([
          queryPlaces(readDb, ciudad),
          queryEvents(readDb, ciudad, queryStart, weekend.sunEnd),
        ]);

        let places = [...dbPlaces];
        const events = [...dbEvents];
        const proposalStats = { proposed: 0, verified: 0, rejected: 0 };

        // Fire-and-forget: trigger the scraping pipeline for this city so that
        // future requests will find more events/places already in the DB.
        // This is non-blocking — the current request doesn't wait for results.
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        fetch(`${baseUrl}/api/scraping/discover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location: ciudadDisplay }),
        }).catch(() => {});

        // ══════════════════════════════════════════════════════════════════
        // PHASE 2 — Multi-source live query for this city
        // Queries DENUE, Ticketmaster, and Eventbrite IN PARALLEL.
        // Results are saved to DB for future requests.
        // Runs when places are sparse OR when we have no events yet —
        // events are time-sensitive so we always check external APIs.
        // ══════════════════════════════════════════════════════════════════
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });

        const hasApiSources =
          process.env.DENUE_API_TOKEN ||
          process.env.TICKETMASTER_API_KEY ||
          process.env.EVENTBRITE_API_KEY ||
          process.env.SERPER_API_KEY;

        if (hasApiSources && (places.length < 8 || events.length < 5)) {
          send({
            type: "progress",
            step: 2,
            message: `Consultando fuentes verificadas para ${ciudadDisplay}...`,
          });

          try {
            const cityCoords = await GeocodingService.geocode(`${ciudadDisplay}, México`);
            if (cityCoords) {
              const [cityLat, cityLng] = cityCoords;
              const writeDb = getSupabaseServerClient(true) ?? getPool();

              if (writeDb) {
                // ══════════════════════════════════════════════════════
                // PHASE 3 — Parallel multi-source gather
                // DENUE: verified cultural/gastro venues
                // Ticketmaster: weekend events for this city
                // Eventbrite: weekend events within 50km radius
                // ══════════════════════════════════════════════════════
                const sourceLabels = [
                  process.env.DENUE_API_TOKEN ? "INEGI/DENUE" : "",
                  process.env.TICKETMASTER_API_KEY ? "Ticketmaster" : "",
                  process.env.EVENTBRITE_API_KEY ? "Eventbrite" : "",
                  process.env.SERPER_API_KEY ? "búsqueda local" : "",
                ].filter(Boolean).join(", ");

                send({
                  type: "progress",
                  step: 3,
                  message: `Verificando con ${sourceLabels || "fuentes externas"}...`,
                });

                const gathered = await gatherSourcesForCity(
                  writeDb,
                  ciudadDisplay,
                  cityLat,
                  cityLng,
                  queryStart,
                  weekend.sunEnd,
                );

                // Merge with existing DB results, dedup by ID
                const existingPlaceIds = new Set(places.map((p) => p.id));
                const existingEventIds = new Set(events.map((e) => e.id));

                for (const p of gathered.places) {
                  if (!existingPlaceIds.has(p.id)) {
                    places.push(p);
                    existingPlaceIds.add(p.id);
                  }
                }
                for (const e of gathered.events) {
                  if (!existingEventIds.has(e.id)) {
                    events.push(e);
                    existingEventIds.add(e.id);
                  }
                }

                const total = gathered.places.length + gathered.events.length;
                proposalStats.proposed = total;
                proposalStats.verified = total;

                const summary = Object.entries(gathered.sources)
                  .filter(([, n]) => n > 0)
                  .map(([src, n]) => `${src}:${n}`)
                  .join(" ");
                if (summary) console.log(`[weekend-plan] Multi-source gather for ${ciudadDisplay} — ${summary}`);
              }
            }
          } catch (gatherErr: unknown) {
            console.warn("[weekend-plan] Multi-source gather failed:", (gatherErr as Error).message);
          }
        }

        // ══════════════════════════════════════════════════════════════════
        // PHASE 4 — Build plan from verified pool only
        // LLM receives ONLY IDs that exist in our DB. It arranges + narrates.
        // Final resolveStops validates every returned ID — any ID not in the
        // verified maps is silently rejected (hallucination guard).
        // ══════════════════════════════════════════════════════════════════

        if (places.length === 0 && events.length === 0) {
          send({ type: "error", message: `No encontramos lugares verificados en ${ciudadDisplay}. Prueba con otra ciudad.` });
          return;
        }

        const placeCount = places.length;
        const eventCount = events.length;
        send({
          type: "progress",
          step: 4,
          message: eventCount > 0
            ? `Armando plan con ${placeCount} lugares y ${eventCount} evento${eventCount !== 1 ? "s" : ""} verificados...`
            : `Armando plan con ${placeCount} lugares verificados...`,
        });

        // Phase 4: build plan from the verified pool (places + events).
        // The LLM only sees IDs that exist in our DB — it cannot invent new ones.
        //
        // Cap what we send to the LLM to stay within token budget (~4k tokens for context).
        // Validation maps still use the FULL pools so no valid ID gets rejected.
        const LLM_PLACES_LIMIT = 45;
        const LLM_EVENTS_LIMIT = 20;

        const llmPlaces = [...places]
          .sort((a, b) => (b.importance_score ?? 0) - (a.importance_score ?? 0))
          .slice(0, LLM_PLACES_LIMIT);
        const llmEvents = events.slice(0, LLM_EVENTS_LIMIT);

        const eventsText = llmEvents
          .map((e) => {
            const dayLabel = new Date(e.start_date).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
            const timeLabel = new Date(e.start_date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
            const sourceTag = e.source_type === "serper_search" ? " [fuente: web local]" : "";
            return `[EVENTO id="${e.id}"] ${e.title} (${e.category ?? "evento"})${sourceTag} — ${dayLabel} a las ${timeLabel}. ${e.venue_name ? `Lugar: ${e.venue_name}.` : ""} ${(e.short_description ?? e.description ?? "").slice(0, 60)}`;
          })
          .join("\n");
        const placesText = llmPlaces
          .map((p) => `[LUGAR id="${p.id}"] ${p.name} (${p.category}) — ${p.town}. ${(p.description ?? "").slice(0, 60)}`)
          .join("\n");

        const contextoSection = contexto
          ? `\nPREFERENCIAS DEL VIAJERO (adapta TODO el plan a esto):\n"${contexto}"\n`
          : "";

        const diaLabels = activeDias.map((d) => dayPromptLabel(d, weekend)).join(" · ");
        const diaSchemaLines = activeDias
          .map((d) => `  "${d}": [{ "id": "EXACT_ID_FROM_LIST", "type": "place_or_event", "hora": "${dayExampleHora(d)}", "razon": "..." }]`)
          .join(",\n");

        const prompt = `Eres un experto en agenda cultural mexicana. Crea el plan de fin de semana en ${ciudadDisplay}.

REGLA ANTI-ALUCINACIÓN: USA ÚNICAMENTE los IDs de la lista de abajo. Nunca inventes IDs.

DÍAS SELECCIONADOS: ${diaLabels}
${contextoSection}
EVENTOS ESTE PERÍODO (PRIORIDAD MÁXIMA — usa sus IDs exactos):
${eventsText || "(ninguno — usa lugares)"}

LUGARES DISPONIBLES (INEGI/DENUE verificados — usa sus IDs exactos):
${placesText || "(ninguno)"}

INSTRUCCIONES:
- Asigna eventos al día correcto según su fecha
- Cada día: MÍNIMO 3, MÁXIMO 5 paradas. NUNCA dejes un día vacío.
- No repitas el mismo lugar/evento en diferentes días
- "id": copia el ID EXACTO de la lista (e.g. "denue-12345678")
- "type": usa "event" para IDs de la lista EVENTOS, "place" para IDs de la lista LUGARES
- "hora" debe coincidir con la hora real del evento (o estimada para lugares)
- "razon" = frase motivadora ≤ 60 chars

Responde ÚNICAMENTE con este JSON, sin markdown:
{
  "resumen": "Una frase que capture el espíritu del finde (máx 80 chars)",
  "descripcion": "2-3 oraciones que describan qué tipo de fin de semana será y qué lo hace especial para ${ciudadDisplay}",
  "clima": "Condición y temperatura estimada. Incluye emoji. Ej: '☀️ Cálido y soleado, ~26°C / ~16°C de noche'",
  "vestimenta": "Ropa específica para este plan y clima.",
  "tips": ["Tip práctico 1", "Tip 2", "Tip 3"],
${diaSchemaLines}
}
- "tips": 3-5 consejos prácticos (reservas, transporte, horarios, efectivo, etc.)`;

        const completion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.1-8b-instant",
          temperature: 0.3,
          response_format: { type: "json_object" },
        });
        const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");

        const placesMap = new Map(places.map((p) => [p.id, p]));
        const eventsMap = new Map(events.map((e) => [e.id, e]));
        let hallucinations = 0;

        // Phase 5: validate every ID the LLM returned — reject any not in our DB.
        // Look up in both maps — don't gate on item.type (LLM often returns wrong type).
        const resolveStops = (raw: any[], day: DayKey): ResolvedStop[] => {
          if (!Array.isArray(raw)) return [];
          return raw
            .map((item: any, idx: number) => {
              const place = placesMap.get(item.id);
              const event = eventsMap.get(item.id);
              if (!place && !event) {
                hallucinations++;
                console.warn(`[weekend-plan] Rejected hallucinated ID: ${item.id}`);
                return null;
              }

              let referenceUrl: string | undefined;
              let referenceName: string | undefined;
              if (event?.source_url) {
                referenceUrl = event.source_url;
                referenceName = event.source_name || safeHostname(event.source_url);
              } else if (place) {
                referenceUrl = mapsUrl(place.name, place.town || ciudadDisplay);
                referenceName = "Google Maps";
              }

              return { order: idx + 1, hora: item.hora ?? "", razon: item.razon ?? "", day, place, event, referenceUrl, referenceName } as ResolvedStop;
            })
            .filter((s): s is ResolvedStop => s !== null);
        };

        // Resolve each day — geocode stops without coords, dedup across days
        const usedIds = new Set<string>();
        const resolvedByDay: Record<string, ResolvedStop[]> = {};

        for (const day of activeDias) {
          const raw = resolveStops(parsed[day] ?? [], day);
          for (const stop of raw) {
            const hasCoords = (stop.place && stop.place.latitude && stop.place.longitude) ||
                              (stop.event && stop.event.latitude && stop.event.longitude);
            if (!hasCoords) {
              const name = stop.place?.name ?? stop.event?.title ?? "";
              const cityStr = stop.place?.town ?? stop.event?.city ?? ciudadDisplay;
              const addressStr = stop.event?.address ?? "";
              const venueStr = stop.event?.venue_name ?? "";
              const queriesToTry = [
                addressStr ? `${addressStr}, ${cityStr}, México` : null,
                venueStr ? `${venueStr}, ${cityStr}, México` : null,
                name ? `${name}, ${cityStr}, México` : null,
                `${cityStr}, México`,
              ].filter(Boolean) as string[];

              let coords: [number, number] | null = null;
              for (const q of queriesToTry) {
                coords = await GeocodingService.geocode(q);
                if (coords) break;
              }
              if (coords) {
                if (stop.place) { stop.place.latitude = coords[0]; stop.place.longitude = coords[1]; }
                else if (stop.event) { stop.event.latitude = coords[0]; stop.event.longitude = coords[1]; }
              }
            }
          }

          const deduped = raw
            .filter((s) => {
              const id = s.place?.id ?? s.event?.id;
              if (id && usedIds.has(id)) return false;
              if (id) usedIds.add(id);
              return true;
            })
            .map((s, i) => ({ ...s, order: i + 1 }));
          resolvedByDay[day] = deduped;
        }

        const totalStops = Object.values(resolvedByDay).reduce((sum, arr) => sum + arr.length, 0);

        if (hallucinations > 0) {
          console.warn(`[weekend-plan] Rejected ${hallucinations} hallucinated ID(s) from LLM response`);
        }

        if (totalStops === 0) {
          send({ type: "error", message: "No pudimos armar un plan verificado para esta ciudad. Intenta de nuevo." });
          return;
        }

        send({
          type: "ready",
          ciudad: ciudadDisplay,
          resumen: parsed.resumen ?? `Tu fin de semana en ${ciudadDisplay}`,
          descripcion: parsed.descripcion ?? "",
          clima: parsed.clima ?? "",
          vestimenta: parsed.vestimenta ?? "",
          tips: Array.isArray(parsed.tips) ? parsed.tips : [],
          dias: activeDias,
          viernes: resolvedByDay.viernes ?? [],
          sabado: resolvedByDay.sabado ?? [],
          domingo: resolvedByDay.domingo ?? [],
          friDate: weekend.friStart.toISOString().slice(0, 10).replace(/-/g, ""),
          satDate: weekend.satStart.toISOString().slice(0, 10).replace(/-/g, ""),
          sunDate: weekend.sunEnd.toISOString().slice(0, 10).replace(/-/g, ""),
          friLabel: weekend.friLabel,
          satLabel: weekend.satLabel,
          sunLabel: weekend.sunLabel,
          meta: {
            verified_places: places.length,
            verified_events: events.length,
            external_sources_found: proposalStats.verified,
            hallucinations_rejected: hallucinations + proposalStats.rejected,
          },
        });
      } catch (err: any) {
        console.error("[weekend-plan] Stream error:", err.message);
        send({ type: "error", message: "Error generando el itinerario" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
