/**
 * Stadiums — Mexican football stadiums and FIFA World Cup 2026 venues.
 *
 * Provides:
 *   STADIUMS[]          — Curated list of major stadiums with coordinates
 *   WC2026_VENUES[]     — FIFA 2026 host stadiums (subset)
 *   findNearbyStadiums() — Finds stadiums within radius of a city
 *   syncStadiumsForCity() — Queries Overpass for stadium POIs + inserts as places
 *   queryStadiumEvents() — Queries Ticketmaster for sports events near stadiums
 */

import type { Place } from "../../types/index";

// ── Types ────────────────────────────────────────────────────────────────

export interface Stadium {
  id: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  capacity: number;
  team?: string;          // Liga MX team
  isWC2026: boolean;      // FIFA World Cup 2026 venue
  description: string;
}

// ── FIFA World Cup 2026 — Mexican venues ─────────────────────────────────
// Mexico hosts group stage + Round of 16 matches (June–July 2026)

export const WC2026_VENUES: Stadium[] = [
  {
    id: "stadium-azteca",
    name: "Estadio Azteca",
    city: "Ciudad de México",
    state: "Ciudad de México",
    lat: 19.3029,
    lng: -99.1505,
    capacity: 87523,
    team: "Club América / Cruz Azul",
    isWC2026: true,
    description: "Sede del Mundial 2026. Único estadio en albergar 3 mundiales (1970, 1986, 2026). Ícono del fútbol mexicano.",
  },
  {
    id: "stadium-akron",
    name: "Estadio Akron",
    city: "Guadalajara",
    state: "Jalisco",
    lat: 20.6820,
    lng: -103.4625,
    capacity: 49850,
    team: "Chivas de Guadalajara",
    isWC2026: true,
    description: "Sede del Mundial 2026. Casa de las Chivas. Diseño vanguardista con techo retráctil parcial.",
  },
  {
    id: "stadium-bbva",
    name: "Estadio BBVA",
    city: "Monterrey",
    state: "Nuevo León",
    lat: 25.6698,
    lng: -100.2462,
    capacity: 53500,
    team: "Rayados de Monterrey",
    isWC2026: true,
    description: "Sede del Mundial 2026. Estadio de clase mundial con vista al Cerro de la Silla. Casa de Rayados.",
  },
];

// ── Major Liga MX + other stadiums ───────────────────────────────────────

export const STADIUMS: Stadium[] = [
  ...WC2026_VENUES,
  {
    id: "stadium-universitario",
    name: "Estadio Olímpico Universitario",
    city: "Ciudad de México",
    state: "Ciudad de México",
    lat: 19.3110,
    lng: -99.1894,
    capacity: 72000,
    team: "Pumas UNAM",
    isWC2026: false,
    description: "Patrimonio de la Humanidad (Ciudad Universitaria). Sede de los Juegos Olímpicos 1968. Casa de los Pumas.",
  },
  {
    id: "stadium-jalisco",
    name: "Estadio Jalisco",
    city: "Guadalajara",
    state: "Jalisco",
    lat: 20.6774,
    lng: -103.3668,
    capacity: 55023,
    team: "Atlas",
    isWC2026: false,
    description: "Estadio histórico de Guadalajara. Casa del Atlas. Sede de la Copa del Mundo 1970.",
  },
  {
    id: "stadium-tigres",
    name: "Estadio Universitario (El Volcán)",
    city: "Monterrey",
    state: "Nuevo León",
    lat: 25.7270,
    lng: -100.2932,
    capacity: 42000,
    team: "Tigres UANL",
    isWC2026: false,
    description: "Conocido como El Volcán por su atmósfera. Casa de los Tigres. San Nicolás de los Garza.",
  },
  {
    id: "stadium-cuauhtemoc",
    name: "Estadio Cuauhtémoc",
    city: "Puebla",
    state: "Puebla",
    lat: 19.0224,
    lng: -98.2120,
    capacity: 51726,
    team: "Club Puebla",
    isWC2026: false,
    description: "Uno de los estadios más grandes de México. Sede de partidos del Mundial 1986.",
  },
  {
    id: "stadium-leon",
    name: "Estadio León",
    city: "León",
    state: "Guanajuato",
    lat: 21.1183,
    lng: -101.6461,
    capacity: 33943,
    team: "Club León",
    isWC2026: false,
    description: "Conocido como Nou Camp. Casa de La Fiera. Centro de la cultura futbolera del Bajío.",
  },
  {
    id: "stadium-tsm",
    name: "Estadio TSM Corona",
    city: "Torreón",
    state: "Coahuila",
    lat: 25.5236,
    lng: -103.4393,
    capacity: 30000,
    team: "Santos Laguna",
    isWC2026: false,
    description: "Casa de los Guerreros del Santos Laguna en la Comarca Lagunera.",
  },
  {
    id: "stadium-victoria",
    name: "Estadio Victoria",
    city: "Aguascalientes",
    state: "Aguascalientes",
    lat: 21.9226,
    lng: -102.3070,
    capacity: 25136,
    team: "Necaxa",
    isWC2026: false,
    description: "Casa de los Rayos del Necaxa en Aguascalientes.",
  },
  {
    id: "stadium-hidalgo",
    name: "Estadio Hidalgo",
    city: "Pachuca",
    state: "Hidalgo",
    lat: 20.0770,
    lng: -98.7606,
    capacity: 30000,
    team: "Pachuca",
    isWC2026: false,
    description: "Casa de los Tuzos del Pachuca, el club más antiguo de México. La Bella Airosa.",
  },
  {
    id: "stadium-caliente",
    name: "Estadio Caliente",
    city: "Tijuana",
    state: "Baja California",
    lat: 32.5170,
    lng: -117.0250,
    capacity: 33333,
    team: "Club Tijuana",
    isWC2026: false,
    description: "Casa de los Xolos de Tijuana en la frontera norte. Experiencia única binacional.",
  },
  {
    id: "stadium-kraken",
    name: "Estadio Kraken",
    city: "Mazatlán",
    state: "Sinaloa",
    lat: 23.2494,
    lng: -106.4099,
    capacity: 25000,
    team: "Mazatlán FC",
    isWC2026: false,
    description: "Casa de Mazatlán FC. Estadio moderno en el puerto del Pacífico.",
  },
  {
    id: "stadium-morelos",
    name: "Estadio Morelos",
    city: "Morelia",
    state: "Michoacán",
    lat: 19.6834,
    lng: -101.1764,
    capacity: 35000,
    team: "Atlético Morelia",
    isWC2026: false,
    description: "Casa del Atlético Morelia. Tradición futbolera en la capital michoacana.",
  },
  {
    id: "stadium-corregidora",
    name: "Estadio La Corregidora",
    city: "Querétaro",
    state: "Querétaro",
    lat: 20.6213,
    lng: -100.4541,
    capacity: 34165,
    team: "Querétaro FC",
    isWC2026: false,
    description: "Casa de los Gallos del Querétaro. Sede de partidos del Mundial 1986.",
  },
  {
    id: "stadium-nemesio",
    name: "Estadio Nemesio Diez",
    city: "Toluca",
    state: "Estado de México",
    lat: 19.2884,
    lng: -99.6559,
    capacity: 32000,
    team: "Deportivo Toluca",
    isWC2026: false,
    description: "Conocido como La Bombonera. Casa de los Diablos Rojos del Toluca, a 2,680 msnm.",
  },
];

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

/**
 * Finds stadiums within a given radius of coordinates.
 * Returns stadiums sorted by distance (closest first).
 */
export function findNearbyStadiums(
  lat: number,
  lng: number,
  radiusKm = 30,
): Array<Stadium & { distanceKm: number }> {
  return STADIUMS
    .map((s) => ({ ...s, distanceKm: haversineKm(lat, lng, s.lat, s.lng) }))
    .filter((s) => s.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Converts a stadium to a Place object for DB insertion / plan inclusion.
 */
export function stadiumToPlace(stadium: Stadium): Place {
  return {
    id: stadium.id,
    name: stadium.name,
    description: stadium.description,
    category: "deportes",
    latitude: stadium.lat,
    longitude: stadium.lng,
    photos: [],
    town: stadium.city,
    state: stadium.state,
    tags: [
      "deportes",
      "estadio",
      ...(stadium.isWC2026 ? ["mundial-2026", "fifa"] : []),
      ...(stadium.team ? ["liga-mx"] : []),
    ],
    importance_score: stadium.isWC2026 ? 95 : 70,
    created_at: new Date().toISOString(),
  };
}

// ── Overpass: find stadiums in OSM near coordinates ──────────────────────

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export async function queryOverpassStadiums(
  lat: number,
  lng: number,
  radiusMeters = 30000,
): Promise<Place[]> {
  const query = `
[out:json][timeout:15];
(
  node["leisure"="stadium"](around:${radiusMeters},${lat},${lng});
  way["leisure"="stadium"](around:${radiusMeters},${lat},${lng});
  node["building"="stadium"](around:${radiusMeters},${lat},${lng});
  way["building"="stadium"](around:${radiusMeters},${lat},${lng});
  node["leisure"="sports_centre"]["sport"="soccer"](around:${radiusMeters},${lat},${lng});
  way["leisure"="sports_centre"]["sport"="soccer"](around:${radiusMeters},${lat},${lng});
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
      id: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }> = data.elements ?? [];

    const places: Place[] = [];
    const seen = new Set<string>();

    for (const el of elements) {
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      const tags = el.tags ?? {};
      const name = tags.name || tags["name:es"];
      if (!name || !elLat || !elLng) continue;

      const nameKey = name.toLowerCase().replace(/\s+/g, "");
      if (seen.has(nameKey)) continue;
      seen.add(nameKey);

      // Skip if already in our curated list
      if (STADIUMS.some((s) => s.name.toLowerCase().replace(/\s+/g, "") === nameKey)) continue;

      places.push({
        id: `osm-stadium-${el.id}`,
        name,
        description: tags.description || `Estadio/recinto deportivo en ${tags["addr:city"] || "México"}`,
        category: "deportes",
        latitude: elLat,
        longitude: elLng,
        photos: [],
        town: tags["addr:city"] || "",
        state: tags["addr:state"] || "",
        tags: ["deportes", "estadio"],
        importance_score: 50,
        created_at: new Date().toISOString(),
      });
    }

    return places;
  } catch {
    return [];
  }
}

// ── Ticketmaster: sports events near stadiums ────────────────────────────

interface StadiumEvent {
  id: string;
  title: string;
  venue: string;
  date: string;          // ISO date string
  time?: string;
  category: "deportes";
  subcategory?: string;  // "futbol", "box", "beisbol", etc.
  image_url?: string;
  source_url?: string;
  lat?: number;
  lng?: number;
  city: string;
  state: string;
  description?: string;
}

const TM_SPORT_GENRES: Record<string, string> = {
  Soccer: "futbol",
  Football: "futbol americano",
  Boxing: "box",
  "Mixed Martial Arts": "mma",
  Baseball: "beisbol",
  Basketball: "basquetbol",
  Wrestling: "lucha libre",
  Tennis: "tenis",
};

export async function queryTicketmasterSports(
  city: string,
  startDate: string,
  endDate: string,
): Promise<StadiumEvent[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return [];

  // Normalize city for TM API
  const cityNorm = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tmCityMap: Record<string, string> = {
    "ciudad de mexico": "Mexico City",
    cdmx: "Mexico City",
    df: "Mexico City",
  };
  const tmCity = tmCityMap[cityNorm.toLowerCase()] ?? cityNorm;

  const params = new URLSearchParams({
    apikey: apiKey,
    countryCode: "MX",
    city: tmCity,
    classificationName: "Sports",
    startDateTime: startDate,
    endDateTime: endDate,
    size: "20",
    sort: "date,asc",
  });

  try {
    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?${params}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return [];
    const data = await res.json();

    const events: StadiumEvent[] = [];
    const embedded = data._embedded?.events;
    if (!Array.isArray(embedded)) return [];

    for (const ev of embedded) {
      const venue = ev._embedded?.venues?.[0];
      const genre = ev.classifications?.[0]?.genre?.name ?? "";
      const subcategory = TM_SPORT_GENRES[genre] ?? genre.toLowerCase() ?? "deportes";

      events.push({
        id: `tm-sport-${ev.id}`,
        title: ev.name ?? "Evento deportivo",
        venue: venue?.name ?? "",
        date: ev.dates?.start?.localDate ?? "",
        time: ev.dates?.start?.localTime,
        category: "deportes",
        subcategory,
        image_url: ev.images?.[0]?.url,
        source_url: ev.url,
        lat: venue?.location?.latitude ? parseFloat(venue.location.latitude) : undefined,
        lng: venue?.location?.longitude ? parseFloat(venue.location.longitude) : undefined,
        city: venue?.city?.name ?? city,
        state: venue?.state?.name ?? "",
        description: `${ev.name} en ${venue?.name ?? city}. ${subcategory === "futbol" ? "Partido de fútbol" : `Evento de ${subcategory}`}.`,
      });
    }

    return events;
  } catch {
    return [];
  }
}

/**
 * Gets a FIFA World Cup 2026 context string if the destination is near a WC venue.
 * Returns null if no WC venue is nearby.
 */
export function getWorldCup2026Context(lat: number, lng: number): string | null {
  const nearby = findNearbyStadiums(lat, lng, 25).filter((s) => s.isWC2026);
  if (nearby.length === 0) return null;

  const venue = nearby[0];
  return `CONTEXTO MUNDIAL 2026: ${venue.name} en ${venue.city} es sede del Mundial FIFA 2026. ` +
    `Capacidad: ${venue.capacity.toLocaleString()} personas. ${venue.description} ` +
    `Si hay eventos deportivos en la lista, priorízalos. ` +
    `Menciona la cercanía al estadio en tips si es relevante.`;
}
