"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Place, CategoryId } from "@/types";
import { Event } from "@/types/events";
import PlaceCard from "@/components/ui/PlaceCard";
import EventCard from "@/components/ui/EventCard";
import CategoryFilter from "@/components/ui/CategoryFilter";
import BottomDrawer from "@/components/ui/BottomDrawer";

const MapView = dynamic(() => import("@/components/map/MapView"), { ssr: false });

// City-level fallback coordinates for events without precise lat/lng
const _na = (s?: string) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const CITY_COORDS: Record<string, [number, number]> = {
  "puerto vallarta": [20.6534, -105.2253], "vallarta": [20.6534, -105.2253],
  "sayulita": [20.8694, -105.4033],
  "punta de mita": [20.7810, -105.5309], "bucerias": [20.7517, -105.3285],
  "bahia de banderas": [20.7000, -105.3000], "nuevo vallarta": [20.7214, -105.2970],
  "guadalajara": [20.6597, -103.3496], "tlaquepaque": [20.6414, -103.3131],
  "ciudad de mexico": [19.4326, -99.1332], "cdmx": [19.4326, -99.1332],
  "mexico city": [19.4326, -99.1332], "df": [19.4326, -99.1332],
  "cancun": [21.1619, -86.8515], "tulum": [20.2116, -87.4654],
  "playa del carmen": [20.6296, -87.0739], "chetumal": [18.5001, -88.3000],
  "oaxaca": [17.0669, -96.7203],
  "san cristobal de las casas": [16.7369, -92.6376],
  "mazatlan": [23.2494, -106.4111],
  "monterrey": [25.6866, -100.3161],
  "merida": [20.9674, -89.5926],
  "san jose del cabo": [23.0596, -109.6889], "cabo san lucas": [22.8905, -109.9167],
  "los cabos": [22.8905, -109.9167], "la paz": [24.1426, -110.3128],
  "guanajuato": [21.0190, -101.2574], "san miguel de allende": [20.9144, -100.7452],
  "queretaro": [20.5888, -100.3899], "puebla": [19.0414, -98.2063],
  "veracruz": [19.1738, -96.1342], "xalapa": [19.5438, -96.9102],
  "tijuana": [32.5149, -117.0382], "hermosillo": [29.0729, -110.9559],
  "chihuahua": [28.6329, -106.0691], "durango": [24.0277, -104.6532],
  "morelia": [19.7060, -101.1950], "cuernavaca": [18.9261, -99.2307],
  "acapulco": [16.8531, -99.8237], "zihuatanejo": [17.6392, -101.5516],
  "manzanillo": [19.1040, -104.3380], "colima": [19.2452, -103.7241],
  "tepic": [21.5042, -104.8945], "nayarit": [21.7514, -104.8455],
  "leon": [21.1236, -101.6824], "aguascalientes": [21.8853, -102.2916],
  "san luis potosi": [22.1565, -100.9855], "zacatecas": [22.7709, -102.5832],
  "saltillo": [25.4232, -101.0053], "torreon": [25.5428, -103.4068],
  "campeche": [19.8301, -90.5349], "villahermosa": [17.9892, -92.9475],
  "tuxtla gutierrez": [16.7521, -93.1151],
};
function eventCityCoords(e: Event): [number, number] | null {
  for (const field of [e.city, e.state]) {
    if (!field) continue;
    const norm = _na(field);
    if (CITY_COORDS[norm]) return CITY_COORDS[norm];
    for (const [k, v] of Object.entries(CITY_COORDS)) {
      if (norm.includes(k) || k.includes(norm)) return v;
    }
  }
  return null;
}

interface HomeClientProps {
  places: Place[];
  events: Event[];
}

export default function HomeClient({ places, events }: HomeClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [selectedCat, setSelectedCat] = useState<CategoryId | null>(null);
  const [highlighted, setHighlighted] = useState<Place | Event | null>(null);
  
  const [mapState, setMapState] = useState<{
    latitude: number;
    longitude: number;
    zoom: number;
    bearing: number;
    pitch: number;
    padding: { top: number; bottom: number; left: number; right: number };
    bounds?: { sw: [number, number]; ne: [number, number] };
  }>({
    latitude: 20.8694,
    longitude: -105.4033,
    zoom: 13,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapingStatus, setScrapingStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");


  // Ref to only zoom once per query to allow manual panning afterwards
  const lastZoomedQuery = useRef("");

  // --- DERIVED STATE ---
  const searchQueryLower = searchQuery.trim().toLowerCase();

  const filteredPlaces = places.filter((p) => {
    if (selectedCat && p.category !== selectedCat) return false;
    let inBounds = true;
    if (mapState?.bounds && mapState.zoom > 6) {
      const { sw, ne } = mapState.bounds;
      inBounds = (p.latitude !== undefined && p.latitude >= sw[1] && p.latitude <= ne[1]) &&
                 (p.longitude !== undefined && p.longitude >= sw[0] && p.longitude <= ne[0]);
    }
    if (searchQueryLower) {
      const textMatch = p.name.toLowerCase().includes(searchQueryLower) || p.town.toLowerCase().includes(searchQueryLower) || p.state.toLowerCase().includes(searchQueryLower) || p.tags.some((t) => t.toLowerCase().includes(searchQueryLower));
      return textMatch;
    }
    return inBounds;
  });

  const filteredEvents = events.filter((e) => {
    if (selectedCat && e.category !== selectedCat) return false;
    if (searchQueryLower) {
      return e.title.toLowerCase().includes(searchQueryLower) ||
             (e.venue_name ?? "").toLowerCase().includes(searchQueryLower) ||
             (e.city ?? "").toLowerCase().includes(searchQueryLower) ||
             (e.state ?? "").toLowerCase().includes(searchQueryLower);
    }
    // Events without coordinates: always show in list (MapView already skips them as markers)
    if (e.latitude == null || e.longitude == null) return true;
    // Events with coordinates: filter by visible map bounds
    if (mapState?.bounds && mapState.zoom > 6) {
      const { sw, ne } = mapState.bounds;
      return e.latitude >= sw[1] && e.latitude <= ne[1] &&
             e.longitude >= sw[0] && e.longitude <= ne[0];
    }
    return true;
  });

  const totalCount = filteredPlaces.length + filteredEvents.length;

  // Importance threshold by zoom: lower zoom = only high-importance markers shown
  const zoom = mapState?.zoom ?? 13;
  const minImportance = zoom <= 6 ? 80 : zoom <= 9 ? 55 : zoom <= 12 ? 30 : 0;

  // Events for the map: events without coords are distributed in a Fermat spiral
  // around the city center so they don't overlap. Each city group gets its own counter.
  const eventsForMap = (() => {
    const cityCounts = new Map<string, number>();
    const result: any[] = [];
    for (const e of filteredEvents) {
      if ((e.importance_score ?? 50) < minImportance) continue;
      if (e.latitude != null && e.longitude != null) { result.push(e); continue; }
      const cityBase = eventCityCoords(e as Event);
      if (!cityBase) continue; // no city match → skip, don't dump at map center
      const [baseLat, baseLng] = cityBase;
      const key = `${baseLat.toFixed(4)},${baseLng.toFixed(4)}`;
      const idx = cityCounts.get(key) ?? 0;
      cityCounts.set(key, idx + 1);
      const r = Math.sqrt(idx + 1) * 0.003; // ~330m at city zoom, fixed to avoid per-frame re-renders
      const angle = idx * 2.39996;
      result.push({ ...e, latitude: baseLat + r * Math.sin(angle), longitude: baseLng + r * Math.cos(angle), _approxLocation: true });
    }
    return result;
  })();

  const placesForMap = filteredPlaces.filter(p => (p.importance_score ?? 50) >= minImportance);

  // --- HANDLERS ---
  const [discoveryStatus, setDiscoveryStatus] = useState<string>("");
  const lastDiscoveryTerm = useRef<string>("");

  const refreshData = async (targetLocation?: string, force: boolean = false, attempt: number = 1) => {
    const term = targetLocation?.trim().toLowerCase() || "";
    if (!force && term && term === lastDiscoveryTerm.current && attempt === 1) return;
    if (term) lastDiscoveryTerm.current = term;

    setScrapingStatus(""); // cede el paso al discoveryStatus
    setIsDiscovering(true);
    setDiscoveryStatus(attempt === 1 ? "Buscando agendas locales..." : "Ampliando búsqueda profunda...");
    try {
      let locationName = targetLocation;
      if (!locationName) {
        const geoRes = await fetch(`/api/geocoding/reverse?lat=${mapState.latitude}&lng=${mapState.longitude}`);
        const geoData = await geoRes.json();
        locationName = mapState.zoom < 6 ? "México" : (geoData.location || "México");
      }
      const discRes = await fetch("/api/scraping/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: locationName, attempt }),
      });
      const discData = await discRes.json();
      
      let totalNewEvents = 0;

      if (discData.success && discData.sources?.length > 0) {
        setDiscoveryStatus(attempt === 1 ? `Extrayendo eventos de ${discData.sources.length} fuentes...` : `Extrayendo de ${discData.sources.length} fuentes nuevas...`);
        startTransition(() => { router.refresh(); });
        
        // Crawl in a controlled sequence to avoid exceeding Apify memory limits (e.g. 2 at a time)
        const CHUNK_SIZE = 2;
        for (let i = 0; i < discData.sources.length; i += CHUNK_SIZE) {
          const chunk = discData.sources.slice(i, i + CHUNK_SIZE);
          await Promise.all(chunk.map(async (src: any) => {
            try {
              const crawlRes = await fetch("/api/scraping/crawl", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sourceId: src.id }),
              });
              if (crawlRes.ok) { 
                const data = await crawlRes.json();
                if (data.newEvents) totalNewEvents += data.newEvents;
                startTransition(() => { router.refresh(); }); 
              }
            } catch (err) { console.error(`Crawl error for source ${src.id}:`, err); }
          }));
        }
      }

      // Deep Discovery: solo recurre si no se encontraron fuentes (newEvents es siempre 0 por fire-and-forget)
      const noSourcesFound = !discData.success || !discData.sources?.length;
      if (noSourcesFound && attempt < 4) {
          console.log(`[Home] No se encontraron fuentes en el intento ${attempt}. Iniciando búsqueda profunda...`);
          setDiscoveryStatus("Buscando en más directorios web...");
          await new Promise(r => setTimeout(r, 1000));
          await refreshData(targetLocation, force, attempt + 1);
      } else {
         setDiscoveryStatus("");
         setIsDiscovering(false);
         startTransition(() => { router.refresh(); });
      }

    } catch (err) { 
      console.error("Discovery error:", err); 
      setDiscoveryStatus("");
      setIsDiscovering(false);
      startTransition(() => { router.refresh(); });
    }
  };

  const runFullScraping = async () => {
    if (isScraping || isDiscovering) return;
    setIsScraping(true);
    setScrapingStatus("Detectando ubicación...");

    // Resolve current map location via reverse geocoding
    let locationName = "México";
    try {
      if (mapState.zoom >= 9) {
        const geoRes = await fetch(`/api/geocoding/reverse?lat=${mapState.latitude}&lng=${mapState.longitude}`);
        const geoData = await geoRes.json();
        locationName = geoData.location || "México";
      }
    } catch {
      // fallback to Mexico-wide if reverse geocoding fails
    }

    setScrapingStatus(`Activando canales para ${locationName}...`);

    // Fire-and-forget: APIs directas corren en background (globales para México)
    fetch("/api/scraping/eventbrite", { method: "POST" }).catch(() => {});
    fetch("/api/scraping/ticketmaster", { method: "POST" }).catch(() => {});
    fetch("/api/scraping/bandsintown", { method: "POST" }).catch(() => {});
    fetch("/api/scraping/sic-festivals", { method: "POST" }).catch(() => {});

    // Crawl existing sources for this location (runs in background, no await)
    fetch("/api/scraping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: locationName }),
    }).catch(() => {});

    // Discover NEW sources + crawl them (Serper → Apify/Cloudflare → Groq)
    setIsScraping(false);
    refreshData(locationName, true);

    // Polling periódico: los jobs de Apify/Cloudflare tardan 1-5 min en terminar.
    let polls = 0;
    const interval = setInterval(() => {
      polls++;
      startTransition(() => router.refresh());
      if (polls >= 8) clearInterval(interval); // 8 × 30s = 4 minutos
    }, 30000);
  };

  // --- SIDE EFFECTS ---

  // 1. Initial zoom on search string match (already existing data)
  useEffect(() => {
    if (searchQueryLower.length < 3 || searchQueryLower === lastZoomedQuery.current) {
      if (searchQueryLower.length < 3) lastZoomedQuery.current = "";
      return;
    }
    const timeout = setTimeout(() => {
      const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (MAPBOX_TOKEN) {
        console.log(`[Geocoding/Discovery] Auto-triggering for: ${searchQueryLower}`);
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQueryLower)}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=mx`)
          .then(res => res.json())
          .then(data => {
            if (data.features && data.features.length > 0) {
              const [lng, lat] = data.features[0].center;
              if (isNaN(lat) || isNaN(lng)) {
                console.error("[Geocoding] Invalid coordinates received:", { lat, lng });
                return;
              }
              lastZoomedQuery.current = searchQueryLower;
              setMapState(prev => ({ 
                ...prev, 
                latitude: lat, 
                longitude: lng, 
                zoom: 12.2,
                bearing: 0,
                pitch: 0,
                padding: { top: 0, bottom: 0, left: 0, right: 0 }
              }));
              refreshData(searchQueryLower);
            }
          }).catch(err => console.error("[Geocoding] ERROR:", err));
      }
    }, 1000); 
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  return (
    <main className="fixed inset-0 flex flex-col" style={{ paddingTop: "calc(var(--topbar-h) + var(--safe-top))", height: "100dvh" }}>
      <div className="flex-1 relative w-full h-full" style={{ minHeight: "300px" }}>
        <MapView
          places={placesForMap}
          events={eventsForMap}
          viewState={mapState}
          onItemClick={setHighlighted}
          onStateChange={setMapState}
        />
        <button
          onClick={runFullScraping}
          disabled={isScraping || isDiscovering}
          className="absolute z-10 flex items-center gap-2 text-sm font-semibold text-white rounded-full shadow-lg transition-all active:scale-95"
          style={{
            top: 16,
            left: 16,
            padding: "10px 16px",
            background: (isScraping || isDiscovering) ? "rgba(26,20,16,0.7)" : "rgba(26,20,16,0.88)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.12)",
            opacity: (isScraping || isDiscovering) ? 0.8 : 1,
            cursor: (isScraping || isDiscovering) ? "not-allowed" : "pointer",
          }}
        >
          {(isScraping || isDiscovering) ? (
            <>
              <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              <span>{scrapingStatus || discoveryStatus || "Actualizando..."}</span>
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              <span>Actualizar eventos</span>
            </>
          )}
        </button>
      </div>

      <BottomDrawer
        label={isDiscovering ? (discoveryStatus || "Descubriendo...") : "Explorar"}
        count={totalCount}
        showLoading={isDiscovering}
        forceOpen={!!highlighted}
        filterSlot={<CategoryFilter selected={selectedCat} onSelect={setSelectedCat} />}
      >
        <div className="mb-6">
          <div style={{ background: "var(--bg-subtle, rgba(0,0,0,0.03))", borderRadius: "16px", padding: "0 12px", display: "flex", alignItems: "center", border: "1.5px solid var(--border, rgba(0,0,0,0.05))" }}>
             <div style={{ marginRight: 10, display: "flex", alignItems: "center" }}><span style={{ fontSize: "1.2rem" }}>🔍</span></div>
             <input type="search" placeholder="Buscar lugares y eventos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ background: "transparent", border: "none", height: 44, flex: 1, fontSize: "0.95rem", outline: "none", color: "var(--text)" }} />
             {searchQuery && (
               <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.1rem", cursor: "pointer", padding: "0 4px" }}>×</button>
             )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {highlighted && (
            <motion.div key={highlighted.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="mb-4">
              <p className="label-muted mb-2" style={{ color: "var(--terracota)" }}>Seleccionado</p>
              {'name' in highlighted ? ( <PlaceCard place={highlighted as Place} compact /> ) : ( <EventCard event={highlighted as Event} compact /> )}
              <div className="my-4" style={{ borderBottom: "1px solid var(--border)" }} />
            </motion.div>
          )}
        </AnimatePresence>

        {totalCount === 0 ? (
          <div className="py-12 px-6 text-center">
            <div className="flex justify-center mb-6"><div className="w-16 h-16 rounded-2xl bg-terracota/10 flex items-center justify-center text-terracota"><span style={{ fontSize: "2rem" }}>📍</span></div></div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">{searchQueryLower ? "Sin resultados" : "No hay nada aquí todavía"}</h3>
            <p className="text-zinc-500 text-sm mb-6">{searchQueryLower ? `No encontramos nada para "${searchQuery}". Prueba otra búsqueda.` : "Escribe el nombre de una ciudad para que la IA busque agendas locales automáticamente."}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredEvents.map((event) => ( <EventCard key={event.id} event={event} /> ))}
            {filteredPlaces.map((place) => ( <PlaceCard key={place.id} place={place} compact /> ))}
          </div>
        )}
      </BottomDrawer>

      <Link
        href="/planear"
        className="fixed z-30 flex items-center gap-2"
        style={{
          bottom: "calc(var(--bottomnav-h) + var(--safe-bottom) + 216px)",
          left: "50%",
          transform: "translateX(-50%)",
          padding: "10px 20px",
          borderRadius: "9999px",
          background: "rgba(196,98,45,0.92)",
          backdropFilter: "blur(10px)",
          color: "#fff",
          fontWeight: 700,
          fontSize: "0.85rem",
          textDecoration: "none",
          boxShadow: "0 4px 20px rgba(196,98,45,0.4)",
          border: "1px solid rgba(255,255,255,0.2)",
          whiteSpace: "nowrap",
          letterSpacing: "0.01em",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        Planea mi fin de semana
      </Link>

      <Link href="/contribuir/evento" className="fixed z-30 flex items-center justify-center group" style={{ bottom: "calc(var(--bottomnav-h) + var(--safe-bottom) + 210px)", right: 24, width: 42, height: 42, borderRadius: "12px", background: "linear-gradient(135deg, #C4622D 0%, #A34E22 100%)", color: "#fff", boxShadow: "0 8px 25px rgba(196,98,45,0.35)", textDecoration: "none", transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)", border: "2px solid rgba(255,255,255,0.2)", backdropFilter: "blur(4px)" }}>
        <div className="relative flex items-center justify-center transition-transform group-hover:rotate-90 duration-500">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
      </Link>
    </main>
  );
}
