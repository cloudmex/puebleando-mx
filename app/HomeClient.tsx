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

  const refreshData = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const filteredPlaces = selectedCat ? places.filter((p) => p.category === selectedCat) : places;
  const filteredEvents = selectedCat ? events.filter((e) => e.category === selectedCat) : events;

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
      <button
        onClick={refreshData}
        disabled={isPending}
        className="absolute top-32 left-4 z-10 w-10 h-10 flex items-center justify-center bg-white/80 backdrop-blur-md rounded-full shadow-popup border border-border hover:bg-white transition-all disabled:opacity-50"
        title="Actualizar datos"
      >
        <svg 
          className={`w-5 h-5 text-zinc-900 ${isPending ? 'animate-spin' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={2.5}
        >
          {isPending ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          )}
        </svg>
      </button>

      <div className="flex-1">
        <MapView
          places={view === "lugares" ? filteredPlaces : []}
          events={view === "eventos" ? filteredEvents : []}
          onItemClick={setHighlighted}
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
          ) : (
            filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))
          )}
        </div>
      </BottomDrawer>
    </main>
  );
}
