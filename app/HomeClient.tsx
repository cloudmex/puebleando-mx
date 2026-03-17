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

  const [selectedCat, setSelectedCat] = useState<CategoryId | null>(null);
  const [highlighted, setHighlighted] = useState<Place | Event | null>(null);
  const [mapState, setMapState] = useState<{
    latitude: number;
    longitude: number;
    zoom: number;
    bounds?: { sw: [number, number]; ne: [number, number] };
  }>({
    latitude: 20.5,
    longitude: -101.5,
    zoom: 5.2,
  });
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const refreshData = async () => {
    setIsDiscovering(true);
    try {
      const geoRes = await fetch(`/api/geocoding/reverse?lat=${mapState.latitude}&lng=${mapState.longitude}`);
      const geoData = await geoRes.json();
      const locationName = mapState.zoom < 6 ? "México" : (geoData.location || "México");

      const discRes = await fetch("/api/scraping/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: locationName }),
      });
      const discData = await discRes.json();

      if (discData.success && discData.sources?.length > 0) {
        await Promise.all(
          discData.sources.map((src: any) =>
            fetch("/api/scraping/crawl", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sourceId: src.id }),
            }).then(r => r.json()).catch(() => null)
          )
        );
      }
    } catch (err) {
      console.error("[HomeClient] Discovery error:", err);
    } finally {
      setIsDiscovering(false);
      startTransition(() => { router.refresh(); });
    }
  };

  const q = searchQuery.trim().toLowerCase();

  // Places: category + text filter
  const filteredPlaces = places.filter((p) => {
    if (selectedCat && p.category !== selectedCat) return false;
    if (q) {
      return (
        p.name.toLowerCase().includes(q) ||
        p.town.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Events: category + text + geographic filter
  const filteredEvents = events.filter((e) => {
    if (selectedCat && e.category !== selectedCat) return false;
    if (q) {
      const match =
        e.title.toLowerCase().includes(q) ||
        (e.venue_name ?? "").toLowerCase().includes(q) ||
        (e.city ?? "").toLowerCase().includes(q) ||
        (e.state ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    if (mapState?.bounds && mapState.zoom > 6) {
      const { sw, ne } = mapState.bounds;
      const inLat = e.latitude !== undefined && e.latitude >= sw[1] && e.latitude <= ne[1];
      const inLng = e.longitude !== undefined && e.longitude >= sw[0] && e.longitude <= ne[0];
      return inLat && inLng;
    }
    return true;
  });

  const totalCount = filteredPlaces.length + filteredEvents.length;

  return (
    <main
      className="fixed inset-0 flex flex-col"
      style={{ paddingTop: "var(--topbar-h)" }}
    >
      {/* Refresh / AI discovery button */}
      <div className="absolute top-20 left-4 z-10 flex flex-col items-center gap-2">
        <button
          onClick={refreshData}
          disabled={isPending || isDiscovering}
          className="w-10 h-10 flex items-center justify-center bg-white/80 backdrop-blur-md rounded-full shadow-popup border border-border hover:bg-white transition-all disabled:opacity-50"
          title="Buscar nuevos eventos con IA"
        >
          <svg
            className={`w-5 h-5 text-zinc-900 ${(isPending || isDiscovering) ? "animate-spin" : ""}`}
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
          places={filteredPlaces}
          events={filteredEvents}
          onItemClick={setHighlighted}
          onStateChange={setMapState}
        />
      </div>

      <BottomDrawer
        label="Explorar"
        count={totalCount}
        filterSlot={<CategoryFilter selected={selectedCat} onSelect={setSelectedCat} />}
      >
        {/* Highlighted item from map click */}
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

        {/* Search */}
        <div className="mb-4 relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar lugares y eventos..."
            className="w-full px-4 py-2.5 text-sm rounded-xl outline-none"
            style={{
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold"
              style={{ color: "var(--text-muted)" }}
            >
              ×
            </button>
          )}
        </div>

        {/* Unified list: events (time-sensitive, full cards) then places (compact) */}
        {totalCount === 0 ? (
          <div className="py-12 px-6 text-center">
            <div className="text-4xl mb-4">📍</div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">
              {q ? "Sin resultados" : "No hay nada aquí todavía"}
            </h3>
            <p className="text-zinc-500 text-sm mb-6">
              {q
                ? `No encontramos nada para "${searchQuery}". Prueba otra búsqueda.`
                : "Dale al botón de refrescar para que la IA busque carteleras locales."}
            </p>
            {!q && (
              <button onClick={refreshData} className="btn-primary">
                Buscar con IA
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
            {filteredPlaces.map((place) => (
              <PlaceCard key={place.id} place={place} compact />
            ))}
          </div>
        )}
      </BottomDrawer>
    </main>
  );
}
