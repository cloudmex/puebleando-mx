"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
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
  const [view, setView] = useState<"lugares" | "eventos">("lugares");
  const [selectedCat, setSelectedCat] = useState<CategoryId | null>(null);
  const [highlighted, setHighlighted] = useState<Place | Event | null>(null);
  const [mapState, setMapState] = useState<{ 
    latitude: number; 
    longitude: number; 
    zoom: number;
    bounds?: { sw: [number, number]; ne: [number, number] };
  } | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const refreshData = async () => {
    // 1. Initial UI feedback
    console.log("[HomeClient] Starting refresh and discovery...");

    // 2. Trigger AI Discovery based on location!
    if (mapState) {
      setIsDiscovering(true);
      try {
        console.log("[HomeClient] Triggering AI discovery for map area...");
        // Get human readable location
        const geoRes = await fetch(`/api/geocoding/reverse?lat=${mapState.latitude}&lng=${mapState.longitude}`);
        const geoData = await geoRes.json();
        const locationName = mapState.zoom < 6 ? "México" : (geoData.location || "México");

        console.log(`[HomeClient] Discovery location determined: ${locationName} (Zoom: ${mapState.zoom})`);
        
        // Auto-switch to events view so they see the result!
        if (view !== "eventos") {
          setView("eventos");
        }

        // Trigger discovery
        const discRes = await fetch("/api/scraping/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location: locationName }),
        });
        const discData = await discRes.json();

        if (discData.success && discData.sources?.length > 0) {
          console.log(`[HomeClient] Discovery found ${discData.discovered} new sources. Auto-starting parallel crawl...`);
          
          // Trigger crawls in parallel for speed
          const crawlPromises = discData.sources.map((src: any) => 
            fetch("/api/scraping/crawl", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sourceId: src.id }),
            }).then(r => r.json()).catch(err => ({ error: err.message }))
          );
          
          await Promise.all(crawlPromises);
          console.log("[HomeClient] All crawl jobs initiated/completed.");
        }
      } catch (err) {
        console.error("[HomeClient] Discovery error during refresh:", err);
      } finally {
        setIsDiscovering(false);
        // Force switch and refresh
        setView("eventos");
        startTransition(() => {
          router.refresh();
        });
      }
    }
  };

  const filteredPlaces = selectedCat ? places.filter((p) => p.category === selectedCat) : places;
  
  // Geographical + Category Filter for Events
  const filteredEvents = events.filter((e) => {
    // 1. Category Filter
    if (selectedCat && e.category !== selectedCat) return false;
    
    // 2. Geographic Filter (only if zoomed in enough)
    if (mapState?.bounds && mapState.zoom > 6) {
      const { sw, ne } = mapState.bounds;
      const inLat = e.latitude !== undefined && e.latitude >= sw[1] && e.latitude <= ne[1];
      const inLng = e.longitude !== undefined && e.longitude >= sw[0] && e.longitude <= ne[0];
      return inLat && inLng;
    }
    
    return true;
  });

  console.log(`[HomeClient] Render - View: ${view}, Events: ${events.length}`);
  if (events.length > 0) {
    console.log(`[HomeClient] Sample Event:`, JSON.stringify(events[0], null, 2));
    console.log(`[HomeClient] Selected Category: ${selectedCat}`);
    console.log(`[HomeClient] Filtered Events Count: ${filteredEvents.length}`);
  }

  return (
    <main
      className="fixed inset-0 flex flex-col"
      style={{ paddingTop: "var(--topbar-h)" }}
    >
      {/* View Toggle */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex p-1 bg-white border-2 border-zinc-200 rounded-full shadow-lg">
        <button
          onClick={() => {
            setView("lugares");
            setHighlighted(null);
          }}
          className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${view === "lugares" ? "bg-terracota text-white shadow-md" : "text-text-secondary hover:bg-bg-muted"
            }`}
        >
          Lugares
        </button>
        <button
          onClick={() => {
            setView("eventos");
            setHighlighted(null);
          }}
          className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${view === "eventos" ? "bg-maiz text-white shadow-md" : "text-text-secondary hover:bg-bg-muted"
            }`}
        >
          Eventos
        </button>
      </div>

      {/* Refresh Button */}
      <div className="absolute top-32 left-4 z-10 flex flex-col items-center gap-2">
        <button
          onClick={refreshData}
          disabled={isPending || isDiscovering}
          className="w-10 h-10 flex items-center justify-center bg-white/80 backdrop-blur-md rounded-full shadow-popup border border-border hover:bg-white transition-all disabled:opacity-50"
          title="Actualizar y buscar eventos con IA"
        >
          <svg 
            className={`w-5 h-5 text-zinc-900 ${(isPending || isDiscovering) ? 'animate-spin' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        {isDiscovering && (
          <motion.span 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-2 py-0.5 bg-maiz text-[8px] font-black uppercase tracking-widest text-white rounded-md shadow-sm"
          >
            Buscando IA
          </motion.span>
        )}
      </div>

      <div className="flex-1">
        <MapView
          places={view === "lugares" ? filteredPlaces : []}
          events={view === "eventos" ? filteredEvents : []}
          onItemClick={setHighlighted}
          onStateChange={setMapState}
        />
      </div>

      <BottomDrawer
        label={view === "lugares" ? "Lugares" : "Eventos"}
        count={view === "lugares" ? filteredPlaces.length : filteredEvents.length}
        filterSlot={<CategoryFilter selected={selectedCat} onSelect={setSelectedCat} />}
      >
        <AnimatePresence mode="wait">
          {highlighted && (
            <motion.div
              key={highlighted.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-4"
            >
              <p className="label-muted mb-2" style={{ color: "var(--terracota)" }}>
                Seleccionado
              </p>
              {'name' in highlighted ? (
                <PlaceCard place={highlighted as Place} compact />
              ) : (
                <EventCard event={highlighted as Event} compact />
              )}
              <div className="my-4" style={{ borderBottom: "1px solid var(--border)" }} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-3">
          {view === "lugares" ? (
            filteredPlaces.map((place) => (
              <PlaceCard key={place.id} place={place} compact />
            ))
          ) : filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))
          ) : (
            <div className="py-12 px-6 text-center">
              <div className="text-4xl mb-4">📍</div>
              <h3 className="text-lg font-bold text-zinc-900 mb-2">No hay eventos aquí todavía</h3>
              <p className="text-zinc-500 text-sm mb-6">Prueba a mover el mapa o dale al botón de refrescar para que la IA busque carteleras locales.</p>
              <button 
                onClick={refreshData}
                className="btn-primary"
              >
                Buscar con IA
              </button>
            </div>
          )}
        </div>
      </BottomDrawer>
    </main>
  );
}
