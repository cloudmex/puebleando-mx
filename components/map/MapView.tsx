"use client";
import { useRef, useCallback, useState } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import { motion, AnimatePresence } from "framer-motion";
import { Place } from "@/types";
import { Event } from "@/types/events";
import { CATEGORIES } from "@/lib/data";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
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
  bearing: 0,
  pitch: 0,
  padding: { top: 0, bottom: 0, left: 0, right: 0 },
};

interface MapViewProps {
  places: Place[];
  events: Event[];
  onItemClick?: (item: Place | Event) => void;
  viewState?: { 
    latitude: number; 
    longitude: number; 
    zoom: number; 
    bearing: number; 
    pitch: number; 
    padding: { top: number; bottom: number; left: number; right: number } 
  };
  onStateChange?: (state: { 
    latitude: number; 
    longitude: number; 
    zoom: number; 
    bearing: number; 
    pitch: number; 
    padding: { top: number; bottom: number; left: number; right: number }; 
    bounds?: { sw: [number, number], ne: [number, number] } 
  }) => void;
  useIcons?: boolean;
}

function MarkerPin({ id, color, icon, useIcons = false }: { id: string; color: string; icon?: string; useIcons?: boolean }) {
  return (
    <div
      className="place-marker flex items-center justify-center rounded-full text-base border-2 border-white shadow-md transition-transform hover:scale-110"
      style={{ width: 34, height: 34, background: color, color: "white" }}
    >
      {useIcons ? <CategoryIcon id={id} size={18} /> : <span>{icon}</span>}
    </div>
  );
}

export default function MapView({ places, events, onItemClick, viewState, onStateChange, useIcons = false }: MapViewProps) {
  const [popup, setPopup] = useState<Place | Event | null>(null);
  const mapRef = useRef<any>(null);

  console.log(`[MapView] Token present: ${!!MAPBOX_TOKEN}. VIEWSTATE:`, JSON.stringify(viewState || DEFAULT_VIEW));

  const handleMarkerClick = useCallback(
    (item: Place | Event) => {
      setPopup(item);
      onItemClick?.(item);
      mapRef.current?.flyTo({
        center: [item.longitude!, item.latitude!],
        zoom: 13,
        duration: 1000,
      });
    },
    [onItemClick]
  );

  return (
    <div className="relative w-full h-full bg-zinc-100 min-h-[300px]">
      <Map
        ref={mapRef}
        viewState={(viewState || DEFAULT_VIEW) as any}
        onMove={(e) => {
          onStateChange?.({
            latitude: e.viewState.latitude,
            longitude: e.viewState.longitude,
            zoom: e.viewState.zoom,
            bearing: e.viewState.bearing,
            pitch: e.viewState.pitch,
            padding: { 
              top: e.viewState.padding?.top || 0, 
              bottom: e.viewState.padding?.bottom || 0, 
              left: e.viewState.padding?.left || 0, 
              right: e.viewState.padding?.right || 0 
            },
          });
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: "100%", height: "100%" }}
        trackResize={true}
        onError={(e) => console.error("[MapView] ERROR:", e.error.message)}
        onLoad={() => {
          console.log("[MapView] Style Loaded Successfully");
          setTimeout(() => mapRef.current?.resize(), 100);
        }}
        onClick={() => setPopup(null)}
        onMoveEnd={() => {
          const bounds = mapRef.current?.getBounds();
          const center = mapRef.current?.getCenter();
          const zoom = mapRef.current?.getZoom();
          const bearing = mapRef.current?.getBearing();
          const pitch = mapRef.current?.getPitch();
          const padding = mapRef.current?.getPadding();
          
          if (bounds && center && zoom !== undefined) {
            onStateChange?.({
              latitude: center.lat,
              longitude: center.lng,
              zoom: zoom,
              bearing: bearing || 0,
              pitch: pitch || 0,
              padding: {
                top: padding?.top || 0,
                bottom: padding?.bottom || 0,
                left: padding?.left || 0,
                right: padding?.right || 0
              },
              bounds: {
                sw: [bounds.getWest(), bounds.getSouth()],
                ne: [bounds.getEast(), bounds.getNorth()]
              }
            });
          }
        }}
      >
        <NavigationControl position="top-right" />

        {/* Places Markers */}
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
                <MarkerPin id={place.category} color={cat?.color ?? "var(--terracota)"} icon={cat?.icon ?? "📍"} useIcons={useIcons} />
              </motion.div>
            </Marker>
          );
        })}

        {/* Events Markers with Jitter for overlaps */}
        {(() => {
          const coordCounts: Record<string, number> = {};
          return events.filter(e => e.latitude && e.longitude).map((event) => {
            const key = `${event.latitude!.toFixed(5)},${event.longitude!.toFixed(5)}`;
            const count = coordCounts[key] || 0;
            coordCounts[key] = count + 1;

            const offsetLat = count > 0 ? (Math.sin(count * 1.5) * 0.00012) : 0;
            const offsetLng = count > 0 ? (Math.cos(count * 1.5) * 0.00012) : 0;

            const cat = CATEGORIES.find((c) => c.id === event.category);
            return (
              <Marker
                key={event.id}
                latitude={event.latitude! + offsetLat}
                longitude={event.longitude! + offsetLng}
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
                  <MarkerPin id={event.category || ""} color={cat?.color ?? "var(--maiz)"} icon={cat?.icon ?? "📅"} useIcons={useIcons} />
                </motion.div>
              </Marker>
            );
          });
        })()}

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
                    <p className="text-[11px] mt-1 font-medium flex items-center gap-1.5" style={{ color: "var(--maiz)" }}>
                      {useIcons ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                      ) : "📅"}
                      {formatDateShort((popup as Event).start_date)}
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
    </div>
  );
}
