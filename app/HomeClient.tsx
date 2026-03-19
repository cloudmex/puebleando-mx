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

interface HomeClientProps {
  places: Place[];
  events: Event[];
}

export default function HomeClient({ places, events }: HomeClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
    latitude: 20.5,
    longitude: -101.5,
    zoom: 5.2,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  const [isDiscovering, setIsDiscovering] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasZoomedForCurrentResults, setHasZoomedForCurrentResults] = useState(false);

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
    let inBounds = true;
    if (mapState?.bounds && mapState.zoom > 6) {
      const { sw, ne } = mapState.bounds;
      inBounds = (e.latitude !== undefined && e.latitude >= sw[1] && e.latitude <= ne[1]) &&
                 (e.longitude !== undefined && e.longitude >= sw[0] && e.longitude <= ne[0]);
    }
    if (searchQueryLower) {
      const textMatch = e.title.toLowerCase().includes(searchQueryLower) || 
                        (e.venue_name ?? "").toLowerCase().includes(searchQueryLower) || 
                        (e.city ?? "").toLowerCase().includes(searchQueryLower) || 
                        (e.state ?? "").toLowerCase().includes(searchQueryLower);
      
      // When searching, only show items that strictly match the text
      return textMatch;
    }
    return inBounds;
  });

  const totalCount = filteredPlaces.length + filteredEvents.length;

  // --- HANDLERS ---
  const [discoveryStatus, setDiscoveryStatus] = useState<string>("");
  const lastDiscoveryTerm = useRef<string>("");

  const refreshData = async (targetLocation?: string, force: boolean = false, attempt: number = 1) => {
    const term = targetLocation?.trim().toLowerCase() || "";
    if (!force && term && term === lastDiscoveryTerm.current && attempt === 1) return;
    if (term) lastDiscoveryTerm.current = term;

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

      // Deep Discovery loop
      if (totalNewEvents < 5 && attempt < 4) {
          console.log(`[Home] Solo se encontraron ${totalNewEvents} eventos en el intento 1. Iniciando búsqueda profunda...`);
          setDiscoveryStatus("Pocos eventos encontrados. Realizando búsqueda profunda de más páginas web...");
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
          places={filteredPlaces} 
          events={filteredEvents} 
          viewState={mapState} 
          onItemClick={setHighlighted} 
          onStateChange={setMapState} 
        />
      </div>

      <BottomDrawer 
        label={isDiscovering ? (discoveryStatus || "Descubriendo...") : "Explorar"} 
        count={totalCount} 
        showLoading={isDiscovering} 
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
