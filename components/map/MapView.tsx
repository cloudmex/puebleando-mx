"use client";
import { useRef, useCallback, useState } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import { motion, AnimatePresence } from "framer-motion";
import { Place } from "@/types";
import { CATEGORIES } from "@/lib/data";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

/* West-central Mexico — best density of seed places */
const DEFAULT_VIEW = {
  latitude: 20.5,
  longitude: -101.5,
  zoom: 5.2,
};

interface MapViewProps {
  places: Place[];
  onPlaceClick?: (place: Place) => void;
}

function MarkerPin({ color, icon }: { color: string; icon: string }) {
  return (
    <div
      className="place-marker flex items-center justify-center rounded-full text-base border-2 border-white shadow-md"
      style={{ width: 38, height: 38, background: color }}
    >
      {icon}
    </div>
  );
}

export default function MapView({ places, onPlaceClick }: MapViewProps) {
  const [popup, setPopup] = useState<Place | null>(null);
  const mapRef = useRef<any>(null);

  const handleMarkerClick = useCallback(
    (place: Place) => {
      setPopup(place);
      onPlaceClick?.(place);
      mapRef.current?.flyTo({
        center: [place.longitude, place.latitude],
        zoom: 11,
        duration: 700,
      });
    },
    [onPlaceClick]
  );

  return (
    <Map
      ref={mapRef}
      initialViewState={DEFAULT_VIEW}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle="mapbox://styles/mapbox/light-v11"
      style={{ width: "100%", height: "100%" }}
      onClick={() => setPopup(null)}
    >
      <NavigationControl position="top-right" />

      {places.map((place) => {
        const cat = CATEGORIES.find((c) => c.id === place.category);
        return (
          <Marker
            key={place.id}
            latitude={place.latitude}
            longitude={place.longitude}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(place);
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.18, y: -3 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
            >
              <MarkerPin color={cat?.color ?? "var(--terracota)"} icon={cat?.icon ?? "📍"} />
            </motion.div>
          </Marker>
        );
      })}

      <AnimatePresence>
        {popup && (
          <Popup
            latitude={popup.latitude}
            longitude={popup.longitude}
            anchor="bottom"
            offset={28}
            closeButton={false}
            closeOnClick={false}
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              style={{ width: 210 }}
            >
              <div
                className="bg-cover bg-center"
                style={{ height: 112, backgroundImage: `url(${popup.photos[0]})` }}
              />
              <div className="p-3" style={{ background: "white" }}>
                <p className="font-semibold text-sm leading-snug" style={{ color: "var(--text)" }}>
                  {popup.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {popup.town}, {popup.state}
                </p>
                <a
                  href={`/lugar/${popup.id}`}
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-white rounded-lg px-3 py-1.5"
                  style={{ background: "var(--terracota)" }}
                >
                  Ver lugar →
                </a>
              </div>
            </motion.div>
          </Popup>
        )}
      </AnimatePresence>
    </Map>
  );
}
