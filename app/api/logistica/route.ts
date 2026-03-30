import Groq from "groq-sdk";
import { GeocodingService } from "@/lib/scraping/geocoding";
import {
  gatherLogisticaSources,
  BUS_COMPANIES,
  AIRLINES,
  getRelevantBusCompanies,
  getRelevantAirlines,
  normalizeState,
  type VerifiedHotel,
} from "@/lib/scraping/logistica-sources";

// ── Types ────────────────────────────────────────────────────────────────

export type LogisticaTransporte = {
  tipo: "avion" | "autobus" | "auto";
  nombre: string;
  duracion: string;
  costo_aprox: string;
  tip: string;
  booking_url: string;
  booking_label: string;
  verified: boolean;
};

export type LogisticaHospedaje = {
  tipo: string;
  nombre: string;
  zona: string;
  costo_aprox: string;
  tip: string;
  booking_url: string;
  booking_label: string;
  verified: boolean;
  source?: "denue" | "osm";
  website?: string;
};

export type LogisticaResponse = {
  origen: string;
  destino: string;
  distancia_km: number;
  transporte: LogisticaTransporte[];
  hospedaje: LogisticaHospedaje[];
};

// ── Helpers ──────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function slug(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function encUri(s: string): string {
  return encodeURIComponent(s);
}

// ── Booking URL generators ───────────────────────────────────────────────

function transportBookingUrl(
  tipo: string,
  nombre: string,
  origen: string,
  destino: string,
  origenCoords: [number, number],
  destinoCoords: [number, number],
): { url: string; label: string } {
  if (tipo === "avion") {
    const lower = nombre.toLowerCase();
    if (lower.includes("volaris")) return { url: "https://www.volaris.com/", label: "Reservar en Volaris" };
    if (lower.includes("vivaaerobus") || lower.includes("viva aerobus")) return { url: "https://www.vivaaerobus.com/", label: "Reservar en VivaAerobus" };
    if (lower.includes("aerom")) return { url: "https://www.aeromexico.com/", label: "Reservar en Aeroméxico" };
    return { url: `https://www.google.com/travel/flights?q=vuelos+de+${encUri(origen)}+a+${encUri(destino)}`, label: "Buscar vuelos" };
  }

  if (tipo === "autobus") {
    // Match against known companies
    const lower = nombre.toLowerCase();
    const match = BUS_COMPANIES.find((c) => lower.includes(c.name.toLowerCase()));
    if (match) return { url: match.url, label: `Reservar en ${match.name}` };
    return { url: `https://www.busbud.com/es/autobus-${slug(origen)}-${slug(destino)}`, label: "Buscar autobuses" };
  }

  // Auto
  return {
    url: `https://www.google.com/maps/dir/${origenCoords[0]},${origenCoords[1]}/${destinoCoords[0]},${destinoCoords[1]}`,
    label: "Ver ruta en Google Maps",
  };
}

function hospedajeBookingUrl(
  hotel: { nombre: string; tipo: string; website?: string },
  destino: string,
): { url: string; label: string } {
  // Prefer direct website if available
  if (hotel.website) {
    return { url: hotel.website, label: "Reservar en sitio oficial" };
  }

  const lower = hotel.tipo.toLowerCase();
  if (lower.includes("airbnb")) {
    return { url: `https://www.airbnb.mx/s/${encUri(destino)}--México/homes`, label: "Buscar en Airbnb" };
  }

  // Search Booking.com with the specific hotel name
  const q = encUri(`${hotel.nombre} ${destino} Mexico`);
  return { url: `https://www.booking.com/searchresults.es.html?ss=${q}&lang=es`, label: "Reservar en Booking.com" };
}

// ── Main handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const origen: string = (body?.origen ?? "").trim();
  const destino: string = (body?.destino ?? "").trim();

  if (!origen || !destino) {
    return Response.json({ error: "origen and destino are required" }, { status: 400 });
  }

  // Geocode both cities
  const [origenCoords, destinoCoords] = await Promise.all([
    GeocodingService.geocode(`${origen}, México`),
    GeocodingService.geocode(`${destino}, México`),
  ]);

  if (!origenCoords || !destinoCoords) {
    return Response.json({ error: "No se pudieron ubicar las ciudades" }, { status: 422 });
  }

  const distanciaKm = Math.round(
    haversineKm(origenCoords[0], origenCoords[1], destinoCoords[0], destinoCoords[1]),
  );

  // ══════════════════════════════════════════════════════════════════════
  // PHASE 1 — Gather verified data from DENUE, Overpass, known companies
  // Runs in parallel with the LLM call for speed
  // ══════════════════════════════════════════════════════════════════════

  const sourcesPromise = gatherLogisticaSources(
    origenCoords[0], origenCoords[1],
    destinoCoords[0], destinoCoords[1],
    origen, destino, distanciaKm,
  );

  // ══════════════════════════════════════════════════════════════════════
  // PHASE 2 — LLM call with verified data context
  // The LLM MUST pick from verified hotels and companies, not invent them
  // ══════════════════════════════════════════════════════════════════════

  let transportModes: string;
  if (distanciaKm < 200) {
    transportModes = "solo auto y autobús (NO avión — la distancia es muy corta)";
  } else if (distanciaKm < 500) {
    transportModes = "auto, autobús, y avión solo si hay vuelos directos conocidos";
  } else {
    transportModes = "avión como primera opción, luego autobús. Auto solo si es práctico";
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });

  try {
    // Wait for verified sources
    const sources = await sourcesPromise;

    // Build hotel list for LLM context (max 15 to avoid token overflow)
    const topHotels = sources.hotels.slice(0, 15);
    const hotelList = topHotels.length > 0
      ? topHotels
          .map((h, i) => `  ${i + 1}. "${h.nombre}" (${h.tipo}, zona: ${h.zona || "centro"}, fuente: ${h.source === "denue" ? "INEGI" : "OpenStreetMap"}${h.website ? `, web: ${h.website}` : ""})`)
          .join("\n")
      : "  (No se encontraron hoteles verificados — sugiere opciones genéricas por tipo)";

    // Build transport company list
    const busCompanies = sources.transport.empresas.filter((e) =>
      BUS_COMPANIES.some((c) => c.name === e),
    );
    const airlineNames = sources.transport.empresas.filter((e) =>
      AIRLINES.some((a) => a.name === e),
    );

    const prompt = `Eres un experto en viajes por México. Genera recomendaciones de transporte y hospedaje.

ORIGEN: ${origen}
DESTINO: ${destino}
DISTANCIA: ~${distanciaKm} km en línea recta

══════════════════════════════════════════
DATOS VERIFICADOS — DEBES usar SOLO estos:
══════════════════════════════════════════

HOTELES VERIFICADOS en ${destino} (fuentes: INEGI/DENUE + OpenStreetMap):
${hotelList}

EMPRESAS DE AUTOBÚS que operan en la zona:
  ${busCompanies.length > 0 ? busCompanies.join(", ") : "Buscar opciones en BusBud/RedCoach"}

${distanciaKm >= 200 ? `AEROLÍNEAS con vuelos en México:\n  ${airlineNames.join(", ") || "Volaris, VivaAerobus, Aeroméxico"}` : ""}

══════════════════════════════════════════
INSTRUCCIONES
══════════════════════════════════════════

TRANSPORTE — Sugiere opciones: ${transportModes}
Cada opción:
{
  "tipo": "avion"|"autobus"|"auto",
  "nombre": "NOMBRE EXACTO de la lista de empresas verificadas arriba",
  "duracion": "Xh aprox",
  "costo_aprox": "$X-$Y MXN",
  "tip": "consejo práctico (terminal exacta, horarios, etc.)"
}

HOSPEDAJE — Elige 3 opciones de la LISTA DE HOTELES VERIFICADOS arriba.
${topHotels.length > 0 ? "SOLO puedes recomendar hoteles que aparecen en la lista." : "Como no hay hoteles verificados, sugiere tipos genéricos (Hotel en centro, Hostal, Airbnb)."}
Cada opción:
{
  "tipo": "Hotel|Hostal|Posada|etc",
  "nombre": "NOMBRE EXACTO de la lista verificada",
  "zona": "zona/colonia donde está",
  "costo_aprox": "$X-$Y MXN/noche",
  "tip": "por qué es buena opción"
}

Responde SOLO con JSON, sin markdown:
{
  "transporte": [...],
  "hospedaje": [...]
}

REGLAS ESTRICTAS:
- NO inventes nombres de hoteles ni empresas
- USA SOLO los nombres de la lista verificada
- Costos REALISTAS en pesos mexicanos
- Si no hay suficientes hoteles verificados, completa con tipos genéricos (ej: "Airbnb en centro histórico") pero márcalos con nombre genérico`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");

    // ══════════════════════════════════════════════════════════════════
    // PHASE 3 — Post-process: verify LLM output against source data
    // ══════════════════════════════════════════════════════════════════

    // Build lookup sets for verification
    const verifiedHotelNames = new Set(
      topHotels.map((h) => h.nombre.toLowerCase().replace(/\s+/g, "")),
    );
    const verifiedHotelMap = new Map<string, VerifiedHotel>(
      topHotels.map((h) => [h.nombre.toLowerCase().replace(/\s+/g, ""), h]),
    );
    const verifiedCompanyNames = new Set(
      sources.transport.empresas.map((e) => e.toLowerCase()),
    );

    // Process transport — verify each company exists
    const transporte: LogisticaTransporte[] = (
      Array.isArray(parsed.transporte) ? parsed.transporte : []
    ).map((t: any) => {
      const nombre = t.nombre ?? "";
      const isVerified =
        t.tipo === "auto" ||
        verifiedCompanyNames.has(nombre.toLowerCase()) ||
        [...verifiedCompanyNames].some((c) => nombre.toLowerCase().includes(c));

      const { url, label } = transportBookingUrl(
        t.tipo, nombre, origen, destino, origenCoords, destinoCoords,
      );

      return {
        tipo: t.tipo,
        nombre: nombre || (t.tipo === "auto" ? "Ruta en auto" : t.tipo),
        duracion: t.duracion ?? "",
        costo_aprox: t.costo_aprox ?? "",
        tip: t.tip ?? "",
        booking_url: url,
        booking_label: label,
        verified: isVerified,
      };
    });

    // Process hospedaje — verify each hotel exists in our data
    const hospedaje: LogisticaHospedaje[] = (
      Array.isArray(parsed.hospedaje) ? parsed.hospedaje : []
    ).map((h: any) => {
      const nombre = h.nombre ?? "";
      const nameKey = nombre.toLowerCase().replace(/\s+/g, "");
      const matchedHotel = verifiedHotelMap.get(nameKey) ??
        [...verifiedHotelMap.values()].find(
          (vh) => nameKey.includes(vh.nombre.toLowerCase().replace(/\s+/g, "")) ||
                  vh.nombre.toLowerCase().replace(/\s+/g, "").includes(nameKey),
        );
      const isVerified = !!matchedHotel;

      const { url, label } = hospedajeBookingUrl(
        {
          nombre,
          tipo: h.tipo ?? "",
          website: matchedHotel?.website,
        },
        destino,
      );

      return {
        tipo: h.tipo ?? matchedHotel?.tipo ?? "Hotel",
        nombre: matchedHotel?.nombre ?? nombre,
        zona: matchedHotel?.zona || h.zona || "",
        costo_aprox: h.costo_aprox ?? "",
        tip: h.tip ?? "",
        booking_url: url,
        booking_label: label,
        verified: isVerified,
        source: matchedHotel?.source,
        website: matchedHotel?.website,
      };
    });

    // If LLM returned too few verified hotels, supplement with raw verified data
    const verifiedCount = hospedaje.filter((h) => h.verified).length;
    if (verifiedCount < 2 && topHotels.length > 0) {
      const usedNames = new Set(hospedaje.map((h) => h.nombre.toLowerCase()));
      for (const vh of topHotels) {
        if (usedNames.has(vh.nombre.toLowerCase())) continue;
        if (hospedaje.length >= 5) break;

        const { url, label } = hospedajeBookingUrl(
          { nombre: vh.nombre, tipo: vh.tipo, website: vh.website },
          destino,
        );

        hospedaje.push({
          tipo: vh.tipo,
          nombre: vh.nombre,
          zona: vh.zona,
          costo_aprox: "",
          tip: `${vh.tipo} verificado en ${vh.zona || destino} (${vh.source === "denue" ? "Registro INEGI" : "OpenStreetMap"})`,
          booking_url: url,
          booking_label: label,
          verified: true,
          source: vh.source,
          website: vh.website,
        });
      }
    }

    const result: LogisticaResponse = {
      origen,
      destino,
      distancia_km: distanciaKm,
      transporte,
      hospedaje,
    };

    return Response.json(result);
  } catch (err: any) {
    console.error("[logistica] error:", err.message);
    return Response.json({ error: "Error generando recomendaciones" }, { status: 500 });
  }
}
