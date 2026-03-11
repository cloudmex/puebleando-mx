"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Place, CategoryId } from "@/types";
import PlaceCard from "@/components/ui/PlaceCard";
import CategoryFilter from "@/components/ui/CategoryFilter";
import BottomDrawer from "@/components/ui/BottomDrawer";

const MapView = dynamic(() => import("@/components/map/MapView"), { ssr: false });

interface HomeClientProps {
  places: Place[];
}

export default function HomeClient({ places }: HomeClientProps) {
  const [selected, setSelected] = useState<CategoryId | null>(null);
  const [highlighted, setHighlighted] = useState<Place | null>(null);

  const filtered = selected ? places.filter((p) => p.category === selected) : places;

  return (
    <main
      className="fixed inset-0 flex flex-col"
      style={{ paddingTop: "var(--topbar-h)" }}
    >
      <div className="flex-1">
        <MapView places={filtered} onPlaceClick={setHighlighted} />
      </div>

      <BottomDrawer
        label="Lugares"
        count={filtered.length}
        filterSlot={<CategoryFilter selected={selected} onSelect={setSelected} />}
      >
        {highlighted && (
          <motion.div
            key={highlighted.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3"
          >
            <p className="label-muted mb-2" style={{ color: "var(--terracota)" }}>
              Seleccionado
            </p>
            <PlaceCard place={highlighted} compact />
            <div className="my-3" style={{ borderBottom: "1px solid var(--border)" }} />
          </motion.div>
        )}
        <div className="flex flex-col gap-2">
          {filtered.map((place) => (
            <PlaceCard key={place.id} place={place} compact />
          ))}
        </div>
      </BottomDrawer>
    </main>
  );
}
