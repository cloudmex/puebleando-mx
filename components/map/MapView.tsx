"use client";
import { useRef, useCallback, useState } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import { motion, AnimatePresence } from "framer-motion";
import { Place } from "@/types";
import { Event } from "@/types/events";
import { CATEGORIES } from "@/lib/data";
import "mapbox-gl/dist/mapbox-gl.css";

function formatDateShort(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return iso.split("T")[0];
  }
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

/* West-central Mexico — best density of seed places */
const DEFAULT_VIEW = {
  latitude: 20.5,
  longitude: -101.5,
  zoom: 5.2,
};

interface MapViewProps {
  places: Place[];
  events: Event[];
  onItemClick?: (item: Place | Event) => void;
  onStateChange?: (state: { latitude: number; longitude: number; zoom: number; bounds?: { sw: [number, number], ne: [number, number] } }) => void;
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

export default function MapView({ places, events, onItemClick, onStateChange }: MapViewProps) {
  const [popup, setPopup] = useState<Place | Event | null>(null);
  const mapRef = useRef<any>(null);

  console.log(`[MapView] Rendering ${places.length} places and ${events.length} events`);
  if (events.length > 0) {
    console.log(`[MapView] Events with coords: ${events.filter(e => e.latitude && e.longitude).length}`);
  }

  const handleMarkerClick = useCallback(
    (item: Place | Event) => {
      setPopup(item);
      onItemClick?.(item);
      mapRef.current?.flyTo({
        center: [item.longitude!, item.latitude!],
        zoom: 11,
        duration: 700,
      });
    },
    [onItemClick]
  );

  return (
    <Map
      ref={mapRef}
      initialViewState={DEFAULT_VIEW}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle="mapbox://styles/mapbox/light-v11"
      style={{ width: "100%", height: "100%" }}
      onClick={() => setPopup(null)}
      onMoveEnd={(e) => {
        const bounds = mapRef.current?.getBounds();
        onStateChange?.({
          latitude: e.viewState.latitude,
          longitude: e.viewState.longitude,
          zoom: e.viewState.zoom,
          bounds: bounds ? {
            sw: [bounds.getWest(), bounds.getSouth()],
            ne: [bounds.getEast(), bounds.getNorth()]
          } : undefined
        });
      }}
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

      {events.filter(e => e.latitude && e.longitude).map((event) => {
        const cat = CATEGORIES.find((c) => c.id === event.category);
        return (
          <Marker
            key={event.id}
            latitude={event.latitude!}
            longitude={event.longitude!}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(event);
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.18, y: -3 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
            >
              <MarkerPin color={cat?.color ?? "var(--maiz)"} icon={cat?.icon ?? "📅"} />
            </motion.div>
          </Marker>
        );
      })}

      <AnimatePresence>
        {popup && (
          <Popup
            latitude={popup.latitude!}
            longitude={popup.longitude!}
            anchor="bottom"
            offset={28}
            closeButton={false}
            closeOnClick={false}
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              className="w-[210px]"
            >
              <div
                className="bg-cover bg-center"
                style={{ 
                  height: 112, 
                  backgroundImage: `url(${('photos' in popup ? popup.photos[0] : popup.image_url) || ''})` 
                }}
              />
              <div className="p-3" style={{ background: "white" }}>
                <p className="font-semibold text-sm leading-snug" style={{ color: "var(--text)" }}>
                  {'name' in popup ? popup.name : (popup as Event).title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {'town' in popup ? `${popup.town}, ${popup.state}` : (popup as Event).venue_name}
                </p>
                {!('town' in popup) && (popup as Event).start_date && (
                  <p className="text-[11px] mt-1 font-medium" style={{ color: "var(--maiz)" }}>
                    📅 {formatDateShort((popup as Event).start_date)}
                  </p>
                )}
                {!('town' in popup) && (popup as Event).short_description && (
                  <p className="text-[11px] mt-1 leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                    {(popup as Event).short_description}
                  </p>
                )}
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <a
                    href={'photos' in popup ? `/lugar/${popup.id}` : `/evento/${(popup as Event).slug}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-white rounded-lg px-3 py-1.5"
                    style={{ background: "var(--terracota)" }}
                  >
                    {'photos' in popup ? 'Ver lugar →' : 'Ver evento →'}
                  </a>
                  {!('photos' in popup) && (popup as Event).source_name && (
                    <span className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                      vía {(popup as Event).source_name}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </Popup>
        )}
      </AnimatePresence>
    </Map>
  );
}
