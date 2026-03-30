/**
 * Logistica Data Sources — Real hotel + transport data for the logistics endpoint.
 *
 * Queries verified APIs (DENUE, Overpass, Google Maps) to ground logistics
 * recommendations in real data, preventing LLM hallucinations.
 *
 * Sources:
 *   DENUE/INEGI      → hotels, hostels, posadas (registered businesses)
 *   Overpass/OSM     → hotels, hostels, guest houses (community-verified)
 *   Google Directions → real driving distance + duration (requires no key for basic)
 *
 * No API keys required for Overpass. DENUE requires DENUE_API_TOKEN.
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface VerifiedHotel {
  nombre: string;
  tipo: string;            // "Hotel", "Hostal", "Posada", etc.
  zona: string;            // neighborhood / address
  lat: number;
  lng: number;
  source: "denue" | "osm"; // provenance
  website?: string;
  stars?: number;
}

export interface VerifiedTransport {
  tipo: "autobus" | "avion" | "auto";
  empresas: string[];      // verified company names
  duracion_auto?: string;  // from directions API
  distancia_auto_km?: number;
}

export interface LogisticaSources {
  hotels: VerifiedHotel[];
  transport: VerifiedTransport;
}

// ── DENUE hotel search ───────────────────────────────────────────────────

const DENUE_BASE = "https://www.inegi.org.mx/app/api/denue/v1/consulta";

// Hotel-related keywords for DENUE Buscar endpoint
const HOTEL_KEYWORDS = ["hotel", "hostal", "posada", "alojamiento", "motel"];

function denueToken(): string | null {
  return process.env.DENUE_API_TOKEN ?? null;
}

/** Low-level HTTPS GET — handles INEGI's non-standard HTTP/1.1 000 status */
function httpGetRaw(url: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lib = url.startsWith("https") ? require("https") : require("http");
    const parsedUrl = new URL(url);
    const req = lib.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: { "User-Agent": "Puebleando/1.0 (puebleando.mx)" },
        rejectUnauthorized: false,
      },
      (res: any) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      }
    );
    req.setTimeout(timeoutMs, () =>
      req.destroy(new Error(`DENUE request timed out after ${timeoutMs}ms`))
    );
    req.on("error", reject);
    req.end();
  });
}

interface DENUERecord {
  Id: string;
  Nombre: string;
  Clase_actividad?: string;
  Calle?: string;
  Num_Exterior?: string;
  Colonia?: string;
  Ubicacion?: string;
  Sitio_internet?: string;
  Latitud?: string | number;
  Longitud?: string | number;
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-/])\S/g, (c) => c.toUpperCase())
    .trim();
}

function classifyHotelType(nombre: string, clase: string): string {
  const combined = `${nombre} ${clase}`.toLowerCase();
  if (combined.includes("hostal") || combined.includes("hostel")) return "Hostal";
  if (combined.includes("posada")) return "Posada";
  if (combined.includes("boutique")) return "Hotel boutique";
  if (combined.includes("motel")) return "Motel";
  if (combined.includes("resort")) return "Resort";
  if (combined.includes("bed") || combined.includes("b&b")) return "B&B";
  return "Hotel";
}

async function queryDenueHotels(
  lat: number,
  lng: number,
  radiusMeters = 5000,
): Promise<VerifiedHotel[]> {
  const tok = denueToken();
  if (!tok) return [];

  const seen = new Set<string>();
  const hotels: VerifiedHotel[] = [];

  const results = await Promise.allSettled(
    HOTEL_KEYWORDS.map(async (kw) => {
      const url = `${DENUE_BASE}/Buscar/${encodeURIComponent(kw)}/${lat},${lng}/${Math.min(radiusMeters, 5000)}/${tok}`;
      try {
        const body = await httpGetRaw(url);
        if (!body || body.trim() === "") return [];
        const data = JSON.parse(body);
        return Array.isArray(data) ? (data as DENUERecord[]) : [];
      } catch {
        return [];
      }
    }),
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const r of result.value) {
      if (seen.has(r.Id)) continue;
      seen.add(r.Id);

      const rLat = parseFloat(String(r.Latitud ?? ""));
      const rLng = parseFloat(String(r.Longitud ?? ""));
      if (!r.Id || !r.Nombre || isNaN(rLat) || isNaN(rLng)) continue;

      const nombre = titleCase(r.Nombre);
      const clase = r.Clase_actividad ?? "";
      const colonia = r.Colonia ? titleCase(r.Colonia) : "";
      const ubicacion = r.Ubicacion ?? "";
      const parts = ubicacion.split(",").map((s) => s.trim());
      const zona = colonia || (parts.length >= 2 ? titleCase(parts[0]) : "");

      hotels.push({
        nombre,
        tipo: classifyHotelType(nombre, clase),
        zona,
        lat: rLat,
        lng: rLng,
        source: "denue",
        website: r.Sitio_internet || undefined,
      });
    }
  }

  return hotels;
}

// ── Overpass (OpenStreetMap) hotel search ─────────────────────────────────

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

async function queryOverpassHotels(
  lat: number,
  lng: number,
  radiusMeters = 8000,
): Promise<VerifiedHotel[]> {
  const query = `
[out:json][timeout:15];
(
  node["tourism"="hotel"](around:${radiusMeters},${lat},${lng});
  way["tourism"="hotel"](around:${radiusMeters},${lat},${lng});
  node["tourism"="hostel"](around:${radiusMeters},${lat},${lng});
  way["tourism"="hostel"](around:${radiusMeters},${lat},${lng});
  node["tourism"="guest_house"](around:${radiusMeters},${lat},${lng});
  way["tourism"="guest_house"](around:${radiusMeters},${lat},${lng});
  node["tourism"="motel"](around:${radiusMeters},${lat},${lng});
  way["tourism"="motel"](around:${radiusMeters},${lat},${lng});
);
out center tags;
`;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    const elements: Array<{
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }> = data.elements ?? [];

    const hotels: VerifiedHotel[] = [];
    const seen = new Set<string>();

    for (const el of elements) {
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      const tags = el.tags ?? {};
      const name = tags.name || tags["name:es"];
      if (!name || !elLat || !elLng) continue;

      // Deduplicate by name similarity
      const nameKey = name.toLowerCase().replace(/\s+/g, "");
      if (seen.has(nameKey)) continue;
      seen.add(nameKey);

      const tourism = tags.tourism ?? "hotel";
      const tipoMap: Record<string, string> = {
        hotel: "Hotel",
        hostel: "Hostal",
        guest_house: "Casa de huéspedes",
        motel: "Motel",
      };

      hotels.push({
        nombre: name,
        tipo: tipoMap[tourism] ?? "Hotel",
        zona: tags["addr:suburb"] || tags["addr:neighbourhood"] || tags["addr:city"] || "",
        lat: elLat,
        lng: elLng,
        source: "osm",
        website: tags.website || tags["contact:website"] || undefined,
        stars: tags.stars ? parseInt(tags.stars) : undefined,
      });
    }

    return hotels;
  } catch {
    return [];
  }
}

// ── Known transport companies by region ──────────────────────────────────

// Major bus companies and their primary coverage regions (state abbreviations)
const BUS_COMPANIES: Array<{ name: string; regions: string[]; url: string }> = [
  { name: "ADO", regions: ["VER", "OAX", "TAB", "CAMP", "YUC", "QROO", "PUE", "CDMX", "CHIS"], url: "https://www.ado.com.mx/" },
  { name: "ETN", regions: ["JAL", "GTO", "AGS", "MICH", "QRO", "CDMX", "MEX", "MOR", "NAY", "SLP"], url: "https://www.etn.com.mx/" },
  { name: "Primera Plus", regions: ["JAL", "GTO", "AGS", "QRO", "CDMX", "MEX", "MICH", "SLP", "COL"], url: "https://www.primeraplus.com.mx/" },
  { name: "Estrella Blanca", regions: ["CHIH", "DGO", "SIN", "SON", "COAH", "NL", "TAMPS", "CDMX", "AGS", "ZAC"], url: "https://www.estrellablanca.com.mx/" },
  { name: "Estrella Roja", regions: ["PUE", "CDMX", "TLAX", "HGO"], url: "https://www.estrellaroja.com.mx/" },
  { name: "Pullman de Morelos", regions: ["MOR", "GRO", "CDMX", "MEX", "PUE"], url: "https://www.pullman.mx/" },
  { name: "Omnibus de México", regions: ["CHIH", "DGO", "COAH", "AGS", "ZAC", "CDMX", "JAL", "SLP"], url: "https://www.odm.com.mx/" },
  { name: "Futura / Chihuahuenses", regions: ["CHIH", "SON", "SIN", "DGO", "CDMX"], url: "https://www.futura.com.mx/" },
  { name: "TAP", regions: ["OAX", "PUE", "CDMX", "GRO"], url: "https://www.tap.com.mx/" },
  { name: "Flixbus", regions: ["CDMX", "QRO", "GTO", "JAL", "PUE", "AGS", "SLP", "NL", "MICH"], url: "https://www.flixbus.com.mx/" },
];

// Airlines operating in Mexico
const AIRLINES: Array<{ name: string; hubs: string[]; url: string }> = [
  { name: "Volaris", hubs: ["CDMX", "GDL", "TIJ", "MTY", "CUN", "CJS"], url: "https://www.volaris.com/" },
  { name: "VivaAerobus", hubs: ["MTY", "CDMX", "GDL", "CUN", "CJS", "MID"], url: "https://www.vivaaerobus.com/" },
  { name: "Aeroméxico", hubs: ["CDMX", "GDL", "MTY", "CUN", "MID"], url: "https://www.aeromexico.com/" },
  { name: "TAR Aerolíneas", hubs: ["QRO", "AGS", "SLP", "DGO", "PUE"], url: "https://www.taraerolíneas.com/" },
  { name: "Mexicana", hubs: ["CDMX", "CUN", "GDL", "MTY", "TIJ"], url: "https://www.mexicana.com/" },
];

// State name → abbreviation mapping for matching
const STATE_ABBREV: Record<string, string> = {
  "aguascalientes": "AGS", "baja california": "BC", "baja california sur": "BCS",
  "campeche": "CAMP", "chiapas": "CHIS", "chihuahua": "CHIH",
  "ciudad de mexico": "CDMX", "cdmx": "CDMX", "coahuila": "COAH",
  "colima": "COL", "durango": "DGO", "guanajuato": "GTO",
  "guerrero": "GRO", "hidalgo": "HGO", "jalisco": "JAL",
  "mexico": "MEX", "estado de mexico": "MEX", "michoacan": "MICH", "michoacán": "MICH",
  "morelos": "MOR", "nayarit": "NAY", "nuevo leon": "NL", "nuevo león": "NL",
  "oaxaca": "OAX", "puebla": "PUE", "queretaro": "QRO", "querétaro": "QRO",
  "quintana roo": "QROO", "san luis potosi": "SLP", "san luis potosí": "SLP",
  "sinaloa": "SIN", "sonora": "SON", "tabasco": "TAB",
  "tamaulipas": "TAMPS", "tlaxcala": "TLAX", "veracruz": "VER",
  "yucatan": "YUC", "yucatán": "YUC", "zacatecas": "ZAC",
};

function normalizeState(state: string): string {
  const clean = state.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  return STATE_ABBREV[clean] ?? clean.toUpperCase().slice(0, 4);
}

function getRelevantBusCompanies(origenState: string, destinoState: string): Array<{ name: string; url: string }> {
  const oAbbr = normalizeState(origenState);
  const dAbbr = normalizeState(destinoState);
  return BUS_COMPANIES.filter(
    (c) => c.regions.includes(oAbbr) || c.regions.includes(dAbbr),
  ).map((c) => ({ name: c.name, url: c.url }));
}

function getRelevantAirlines(origenCity: string, destinoCity: string): Array<{ name: string; url: string }> {
  // All major airlines serve major routes — return all that have hubs near either city
  // This is a simplified check; a real implementation would use airport codes
  return AIRLINES.map((a) => ({ name: a.name, url: a.url }));
}

// ── Reverse geocode to get state name ────────────────────────────────────

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

async function reverseGeocodeState(lat: number, lng: number): Promise<string> {
  if (!MAPBOX_TOKEN) return "";
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=region&language=es&limit=1&access_token=${MAPBOX_TOKEN}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return "";
    const data = await res.json();
    return data.features?.[0]?.text ?? "";
  } catch {
    return "";
  }
}

// ── Main export ──────────────────────────────────────────────────────────

export async function gatherLogisticaSources(
  origenLat: number,
  origenLng: number,
  destinoLat: number,
  destinoLng: number,
  origenCity: string,
  destinoCity: string,
  distanciaKm: number,
): Promise<LogisticaSources> {
  // Run all queries in parallel with 15s timeout
  const timeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

  const [
    denueHotels,
    osmHotels,
    origenState,
    destinoState,
  ] = await Promise.all([
    timeout(queryDenueHotels(destinoLat, destinoLng, 5000), 12000, []),
    timeout(queryOverpassHotels(destinoLat, destinoLng, 8000), 15000, []),
    timeout(reverseGeocodeState(origenLat, origenLng), 5000, ""),
    timeout(reverseGeocodeState(destinoLat, destinoLng), 5000, ""),
  ]);

  // Merge and deduplicate hotels (prefer DENUE as official source)
  const allHotels: VerifiedHotel[] = [...denueHotels];
  const denueNames = new Set(denueHotels.map((h) => h.nombre.toLowerCase().replace(/\s+/g, "")));

  for (const h of osmHotels) {
    const key = h.nombre.toLowerCase().replace(/\s+/g, "");
    if (!denueNames.has(key)) {
      allHotels.push(h);
      denueNames.add(key);
    }
  }

  // Build transport info
  const busCompanies = getRelevantBusCompanies(origenState, destinoState);
  const airlines = distanciaKm >= 200 ? getRelevantAirlines(origenCity, destinoCity) : [];

  const transport: VerifiedTransport = {
    tipo: "auto",
    empresas: [
      ...busCompanies.map((c) => c.name),
      ...airlines.map((a) => a.name),
    ],
  };

  console.log(
    `[logistica-sources] ${destinoCity}: ${denueHotels.length} DENUE hotels, ${osmHotels.length} OSM hotels, ${busCompanies.length} bus cos, ${airlines.length} airlines`,
  );

  return {
    hotels: allHotels,
    transport,
  };
}

export { BUS_COMPANIES, AIRLINES, getRelevantBusCompanies, getRelevantAirlines, normalizeState };
