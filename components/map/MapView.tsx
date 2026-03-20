"use client";
import { useRef, useCallback, useState } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import { motion } from "framer-motion";
import Link from "next/link";
import { Place } from "@/types";
import { Event } from "@/types/events";
import { CATEGORIES } from "@/lib/data";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import "mapbox-gl/dist/mapbox-gl.css";

function formatDateShort(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}


const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

/* Sayulita, Nayarit */
const DEFAULT_VIEW = {
  latitude: 20.8694,
  longitude: -105.4033,
  zoom: 13,
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
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [popup, setPopup] = useState<Place | Event | null>(null);

  console.log(`[MapView] Token present: ${!!MAPBOX_TOKEN}. VIEWSTATE:`, JSON.stringify(viewState || DEFAULT_VIEW));

  const handleMarkerClick = useCallback(
    (item: Place | Event) => {
      onItemClick?.(item);
      setPopup(item);
      const lng = item.longitude;
      const lat = item.latitude;
      if (lng != null && lat != null && !isNaN(lng) && !isNaN(lat)) {
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 13, duration: 1000 });
      }
    },
    [onItemClick]
  );

  return (
    <div className="relative w-full h-full bg-zinc-100 min-h-[300px]">
      <Map
        ref={mapRef}
        initialViewState={(viewState || DEFAULT_VIEW) as any}
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
          setTimeout(() => { mapRef.current?.resize(); setMapLoaded(true); }, 100);
        }}
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

        {/* Popup card */}
        {mapLoaded && popup && popup.latitude != null && popup.longitude != null && (
          <Popup
            latitude={popup.latitude}
            longitude={popup.longitude}
            anchor="bottom"
            offset={20}
            closeButton={true}
            closeOnClick={false}
            onClose={() => setPopup(null)}
            style={{ padding: 0, maxWidth: "260px" }}
          >
            <div style={{ borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--bg)", fontFamily: "inherit" }}>
              {/* Image */}
              {("photos" in popup ? popup.photos?.[0] : (popup as Event).image_url) && (
                <img
                  src={"photos" in popup ? popup.photos[0] : (popup as Event).image_url!}
                  alt={"name" in popup ? popup.name : (popup as Event).title}
                  style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }}
                />
              )}
              <div style={{ padding: "10px 12px 12px" }}>
                {(popup as any)._approxLocation && (
                  <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-muted)", borderRadius: "var(--r-full)", padding: "2px 7px", display: "inline-block", marginBottom: 4 }}>
                    📍 Ubicación aproximada
                  </span>
                )}
                <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 13, color: "var(--text)", lineHeight: 1.3 }}>
                  {"name" in popup ? popup.name : (popup as Event).title}
                </p>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--text-muted)" }}>
                  {"town" in popup
                    ? `${popup.town}, ${popup.state}`
                    : [(popup as Event).venue_name, (popup as Event).city].filter(Boolean).join(" · ")}
                </p>
                {"start_date" in popup && (
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--terracota)", fontWeight: 600 }}>
                    {formatDateShort((popup as Event).start_date)}
                  </p>
                )}
                {(("short_description" in popup && (popup as Event).short_description) || popup.description) && (
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    {("short_description" in popup && (popup as Event).short_description)
                      ? (popup as Event).short_description
                      : (popup as Place).description}
                  </p>
                )}
                <Link
                  href={"slug" in popup ? `/eventos/${(popup as Event).slug}` : `/lugar/${popup.id}`}
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--terracota)", textDecoration: "none" }}
                >
                  {"slug" in popup ? "Ver evento →" : "Ver lugar →"}
                </Link>
              </div>
            </div>
          </Popup>
        )}

        {/* Places Markers */}
        {mapLoaded && places.filter(p => p.latitude != null && p.longitude != null && !isNaN(p.latitude) && !isNaN(p.longitude)).map((place) => {
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
        {mapLoaded && (() => {
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

      </Map>
    </div>
  );
}
