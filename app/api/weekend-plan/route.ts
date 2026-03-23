import Groq from "groq-sdk";
import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPool } from "@/lib/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import type { Place } from "@/types";
import type { Event } from "@/types/events";
import type { CategoryId } from "@/types";

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

const slugify = (s: string) =>
  norm(s).replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 60);

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

async function upsertPlace(
  db: SupabaseClient | Pool,
  item: { nombre: string; descripcion?: string; categoria: string; lat: number; lng: number },
  ciudadDisplay: string
): Promise<Place | null> {
  if (!item.nombre || typeof item.lat !== "number" || item.lat === 0 || typeof item.lng !== "number" || item.lng === 0) {
    return null;
  }

  const id = `${slugify(item.nombre)}-${slugify(ciudadDisplay)}`;
  const cat = (VALID_CATS.has(item.categoria) ? item.categoria : "cultura") as CategoryId;
  const payload = {
    name: item.nombre,
    description: item.descripcion ?? "",
    category: cat,
    latitude: item.lat,
    longitude: item.lng,
    town: ciudadDisplay,
    state: "",
    photos: [] as string[],
    tags: [] as string[],
    importance_score: 65,
  };

  try {
    if (isSupabaseClient(db)) {
      const { data: inserted } = await db
        .from("places")
        .insert({ id, ...payload })
        .select()
        .single();
      if (inserted) return rowToPlace(inserted as Record<string, unknown>);

      const { data: existing } = await db.from("places").select("*").eq("id", id).single();
      if (existing) return rowToPlace(existing as Record<string, unknown>);
    } else {
      const { rows } = await (db as Pool).query(
        `INSERT INTO places (id, name, description, category, latitude, longitude, town, state, photos, tags, importance_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '', '{}', '{}', 65)
         ON CONFLICT (id) DO NOTHING
         RETURNING *`,
        [id, payload.name, payload.description, cat, item.lat, item.lng, ciudadDisplay]
      );
      if (rows[0]) return rowToPlace(rows[0]);
      const { rows: ex } = await (db as Pool).query("SELECT * FROM places WHERE id = $1", [id]);
      if (ex[0]) return rowToPlace(ex[0]);
    }
  } catch (err: any) {
    console.error(`[weekend-plan] upsertPlace error for ${id}:`, err.message);
  }

  return {
    id: `gen-${slugify(item.nombre)}`,
    ...payload,
    created_at: new Date().toISOString(),
  };
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
  const writeDb = getSupabaseServerClient(true) ?? getPool();

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
        // ── Step 1: Query DB ─────────────────────────────────────────────
        send({ type: "progress", step: 1, message: `Buscando eventos este fin de semana en ${ciudadDisplay}...` });

        const weekend = getWeekendDates();
        // Extend query range to Friday if requested
        const queryStart = activeDias.includes("viernes") ? weekend.friStart : weekend.satStart;
        const [places, events] = await Promise.all([
          queryPlaces(readDb, ciudad),
          queryEvents(readDb, ciudad, queryStart, weekend.sunEnd),
        ]);

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });
        const hasDBData = events.length >= 1 || places.length >= 2;

        if (hasDBData) {
          // ── Path A: curate existing DB data ─────────────────────────────
          const eventCount = events.length;
          const placeCount = places.length;
          send({
            type: "progress",
            step: 2,
            message: eventCount > 0
              ? `Encontramos ${eventCount} evento${eventCount > 1 ? "s" : ""} en ${ciudadDisplay}`
              : `Encontramos ${placeCount} lugares en ${ciudadDisplay}`,
          });
          send({ type: "progress", step: 3, message: `Armando tu plan con IA...` });

          const eventsText = events
            .map((e) => {
              const dayLabel = new Date(e.start_date).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
              const timeLabel = new Date(e.start_date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
              return `[EVENTO id="${e.id}"] ${e.title} (${e.category ?? "evento"}) — ${dayLabel} a las ${timeLabel}. ${e.venue_name ? `Lugar: ${e.venue_name}.` : ""} ${(e.short_description ?? e.description ?? "").slice(0, 80)}`;
            })
            .join("\n");
          const placesText = places
            .map((p) => `[LUGAR id="${p.id}"] ${p.name} (${p.category}) — ${p.town}. ${(p.description ?? "").slice(0, 80)}`)
            .join("\n");

          const contextoSection = contexto
            ? `\nPREFERENCIAS DEL VIAJERO (adapta TODO el plan a esto):\n"${contexto}"\n`
            : "";

          const diaLabels = activeDias.map((d) => dayPromptLabel(d, weekend)).join(" · ");
          const diaSchemaLines = activeDias
            .map((d) => `  "${d}": [{ "id": "EXACT_ID_FROM_LIST", "type": "event", "hora": "${dayExampleHora(d)}", "razon": "..." }]`)
            .join(",\n");

          const prompt = `Eres un experto en agenda cultural mexicana. Crea el plan de fin de semana en ${ciudadDisplay}.

DÍAS SELECCIONADOS: ${diaLabels}
${contextoSection}
EVENTOS QUE OCURREN ESTE PERÍODO (PRIORIDAD MÁXIMA):
${eventsText || "(ninguno — usa lugares)"}

LUGARES COMPLEMENTARIOS:
${placesText || "(ninguno)"}

INSTRUCCIONES:
- Asigna los eventos al día correcto según su fecha (viernes/sábado/domingo)
- CADA día seleccionado debe tener MÍNIMO 3 y MÁXIMO 5 paradas. Si un día no tiene eventos de la lista, llena OBLIGATORIAMENTE con restaurantes, mercados, museos u otras actividades icónicas de la ciudad. NUNCA dejes un día vacío.
- NUNCA repitas el mismo lugar o evento en diferentes días — cada parada debe ser única en todo el plan
- "hora" debe coincidir con la hora real del evento (o estimada si es un lugar)
- "razon" = frase motivadora ≤ 60 chars que refleje las preferencias del viajero

Responde ÚNICAMENTE con este JSON, sin markdown:
{
  "resumen": "Una frase que capture el espíritu del finde (máx 80 chars)",
  "descripcion": "2-3 oraciones que describan qué tipo de fin de semana será y qué lo hace especial para ${ciudadDisplay}",
  "clima": "Condición y temperatura estimada para ${ciudadDisplay} en esta época. Incluye emoji de clima al inicio. Ej: '☀️ Cálido y soleado, ~26°C de día / ~16°C de noche'",
  "vestimenta": "Recomendación de ropa específica para este plan y clima. Ej: 'Ropa casual y cómoda, tenis para caminar. Lleva una chamarra ligera para las noches.'",
  "tips": ["Tip práctico 1 específico para este fin de semana", "Tip 2", "Tip 3"],
${diaSchemaLines}
}
- "tips": 3-5 consejos prácticos y específicos para este itinerario (reservas, transporte, horarios, efectivo, etc.)`;

          const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.1-8b-instant",
            temperature: 0.3,
            response_format: { type: "json_object" },
          });
          const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");

          const placesMap = new Map(places.map((p) => [p.id, p]));
          const eventsMap = new Map(events.map((e) => [e.id, e]));

          const resolveStops = (raw: any[], day: DayKey): ResolvedStop[] => {
            if (!Array.isArray(raw)) return [];
            return raw
              .map((item: any, idx: number) => {
                const place = item.type === "place" ? placesMap.get(item.id) : undefined;
                const event = item.type === "event" ? eventsMap.get(item.id) : undefined;
                if (!place && !event) return null;

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

          // Resolve each selected day, deduplicating across days
          const usedIds = new Set<string>();
          const resolvedByDay: Record<string, ResolvedStop[]> = {};

          for (const day of activeDias) {
            const raw = resolveStops(parsed[day] ?? [], day);
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

          if (totalStops > 0) {
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
            });
            return;
          }
          // If LLM returned wrong IDs, fall through to Path B
        }

        // ── Path B: search → save → plan ─────────────────────────────────
        send({ type: "progress", step: 2, message: `Buscando eventos del ${weekend.friLabel} al ${weekend.sunLabel}...` });

        // Fire-and-forget: full scraping pipeline for future visits
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        fetch(`${baseUrl}/api/scraping/discover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location: ciudadDisplay }),
        }).catch(() => {});

        // Serper: search for real weekend events
        const SERPER_KEY = process.env.SERPER_API_KEY;
        let serperContext = "";

        if (SERPER_KEY) {
          try {
            const queries = [
              `eventos agenda "${ciudadDisplay}" México ${weekend.month} ${weekend.year}`,
              `conciertos festivales actividades "${ciudadDisplay}" fin de semana ${weekend.month} ${weekend.year}`,
            ];
            const results = await Promise.allSettled(
              queries.map((q) =>
                fetch("https://google.serper.dev/search", {
                  method: "POST",
                  headers: { "X-API-KEY": SERPER_KEY, "Content-Type": "application/json" },
                  body: JSON.stringify({ q, gl: "mx", hl: "es", num: 8 }),
                }).then((r) => r.json())
              )
            );
            const organic = results.flatMap((r) =>
              r.status === "fulfilled" ? (r.value?.organic ?? []) : []
            );
            serperContext = organic
              .slice(0, 12)
              .map((r: any) => `• ${r.title}\n  ${r.snippet ?? ""}\n  URL: ${r.link ?? ""}`)
              .join("\n");
            if (organic.length > 0) {
              send({ type: "progress", step: 3, message: `Encontramos agenda actualizada de internet` });
            }
          } catch (err: any) {
            console.warn("[weekend-plan] Serper error:", err.message);
          }
        }

        send({ type: "progress", step: 4, message: `Extrayendo eventos y actividades con IA...` });

        const contextSection = serperContext
          ? `AGENDA REAL DE INTERNET PARA ${ciudadDisplay.toUpperCase()}:\n${serperContext}\n\nBasa el itinerario en esta información actualizada.`
          : `Usa tu conocimiento sobre ${ciudadDisplay}, México para sugerir eventos y actividades del fin de semana.`;

        const contextoBlock = contexto
          ? `\nPREFERENCIAS DEL VIAJERO (adapta TODO el plan a esto):\n"${contexto}"\n`
          : "";

        const diaLabelsB = activeDias.map((d) => dayPromptLabel(d, weekend)).join(" · ");
        const diaSchemaLinesB = activeDias
          .map((d) => {
            const exHora = dayExampleHora(d);
            return `  "${d}": [\n    { "nombre": "Nombre real del evento/lugar", "categoria": "festivales", "hora": "${exHora}", "razon": "...", "descripcion": "...", "lat": 0.0, "lng": 0.0, "source_url": "URL exacta o null" }\n  ]`;
          })
          .join(",\n");

        const extractPrompt = `Eres un experto en agenda cultural mexicana. Crea el mejor plan de fin de semana para ${ciudadDisplay}, México.

DÍAS SELECCIONADOS: ${diaLabelsB}
${contextoBlock}
${contextSection}

REGLAS:
- Usa NOMBRES REALES de eventos o lugares en ${ciudadDisplay}
- CADA día seleccionado debe tener MÍNIMO 3 y MÁXIMO 5 paradas. Si un día no tiene eventos específicos, llena OBLIGATORIAMENTE con restaurantes, mercados, museos u otras actividades icónicas. NUNCA dejes un día vacío.
- NUNCA repitas el mismo lugar o evento en diferentes días — cada parada debe ser única en todo el plan
- PRIORIZA: conciertos, festivales, ferias, teatro, exposiciones, mercados artesanales con fecha
- Coordenadas GPS correctas (lat/lng de ${ciudadDisplay})
- "razon" máx 55 chars, motivadora
- "descripcion" máx 90 chars

Responde ÚNICAMENTE con este JSON, sin markdown:
{
  "resumen": "Una frase que capture el espíritu del finde (máx 80 chars)",
  "descripcion": "2-3 oraciones que describan qué tipo de fin de semana será y qué lo hace especial",
  "clima": "Condición y temperatura estimada para ${ciudadDisplay} en esta época. Incluye emoji. Ej: '☀️ Cálido y soleado, ~26°C de día / ~16°C de noche'",
  "vestimenta": "Ropa específica para este plan y clima. Ej: 'Casual y cómodo, tenis para caminar. Chamarra ligera para las noches.'",
  "tips": ["Tip práctico 1", "Tip 2", "Tip 3"],
${diaSchemaLinesB}
}

- "tips": 3-5 consejos prácticos y específicos (reservas, transporte, horarios, efectivo, etc.)
- "source_url": copia la URL exacta del snippet de la AGENDA que mencione este lugar/evento. Si no hay URL relevante pon null.
Categorías válidas: gastronomia, cultura, naturaleza, mercados, artesanos, festivales`;

        const completion = await groq.chat.completions.create({
          messages: [{ role: "user", content: extractPrompt }],
          model: "llama-3.1-8b-instant",
          temperature: 0.35,
          response_format: { type: "json_object" },
        });
        const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");

        // Save all places to DB
        const allItems: any[] = activeDias.flatMap((d) =>
          ((parsed[d] ?? []) as any[]).map((i: any) => ({ ...i, _day: d }))
        );
        const savable = allItems.filter(
          (i) => i?.nombre && typeof i.lat === "number" && i.lat !== 0 && typeof i.lng === "number" && i.lng !== 0
        );
        if (savable.length > 0 && writeDb) {
          send({ type: "progress", step: 5, message: `Guardando ${savable.length} lugares en la base de datos...` });
        }

        const savedByName = new Map<string, Place>();
        if (writeDb) {
          for (const item of allItems) {
            if (!item?.nombre) continue;
            const saved = await upsertPlace(writeDb, item, ciudadDisplay);
            if (saved) savedByName.set(item.nombre, saved);
          }
        }

        send({ type: "progress", step: 6, message: `Armando tu itinerario de fin de semana...` });

        const buildStops = (raw: any[], day: DayKey): ResolvedStop[] => {
          if (!Array.isArray(raw)) return [];
          return raw
            .filter((item: any) => item?.nombre)
            .map((item: any, idx: number) => {
              const savedPlace = savedByName.get(item.nombre);
              const cat = (VALID_CATS.has(item.categoria) ? item.categoria : "cultura") as CategoryId;
              const place: Place = savedPlace ?? {
                id: `gen-${day}-${idx}`,
                name: item.nombre,
                description: item.descripcion ?? "",
                category: cat,
                latitude: typeof item.lat === "number" && item.lat !== 0 ? item.lat : 0,
                longitude: typeof item.lng === "number" && item.lng !== 0 ? item.lng : 0,
                photos: [],
                town: ciudadDisplay,
                state: "",
                tags: [],
                importance_score: 65,
                created_at: new Date().toISOString(),
              };
              const referenceUrl = isValidUrl(item.source_url)
                ? item.source_url
                : mapsUrl(item.nombre, ciudadDisplay);
              const referenceName = isValidUrl(item.source_url)
                ? safeHostname(item.source_url)
                : "Google Maps";

              return { order: idx + 1, hora: item.hora ?? "", razon: item.razon ?? "", day, place, referenceUrl, referenceName } as ResolvedStop;
            });
        };

        // Build each selected day, deduplicating across days
        const usedNames = new Set<string>();
        const builtByDay: Record<string, ResolvedStop[]> = {};

        for (const day of activeDias) {
          const raw = buildStops(parsed[day] ?? [], day);
          const deduped = raw
            .filter((s) => {
              const name = (s.place?.name ?? "").toLowerCase();
              if (name && usedNames.has(name)) return false;
              if (name) usedNames.add(name);
              return true;
            })
            .map((s, i) => ({ ...s, order: i + 1 }));
          builtByDay[day] = deduped;
        }

        const totalStops = Object.values(builtByDay).reduce((sum, arr) => sum + arr.length, 0);

        if (totalStops === 0) {
          send({ type: "error", message: "No pudimos generar un itinerario para esta ciudad" });
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
          viernes: builtByDay.viernes ?? [],
          sabado: builtByDay.sabado ?? [],
          domingo: builtByDay.domingo ?? [],
          friDate: weekend.friStart.toISOString().slice(0, 10).replace(/-/g, ""),
          satDate: weekend.satStart.toISOString().slice(0, 10).replace(/-/g, ""),
          sunDate: weekend.sunEnd.toISOString().slice(0, 10).replace(/-/g, ""),
          friLabel: weekend.friLabel,
          satLabel: weekend.satLabel,
          sunLabel: weekend.sunLabel,
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
