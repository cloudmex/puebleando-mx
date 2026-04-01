"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import Map, { Marker, Source, Layer, type MapRef } from "react-map-gl/mapbox";
import type { ResolvedStop, DayKey } from "@/app/api/weekend-plan/route";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

interface ItineraryMapProps {
  stops: ResolvedStop[];
  activeDay: DayKey;
  onStopClick?: (stop: ResolvedStop) => void;
  highlightedOrder?: number;
}

function getCoords(stop: ResolvedStop): [number, number] | null {
  let lat = stop.place?.latitude ?? stop.event?.latitude;
  let lng = stop.place?.longitude ?? stop.event?.longitude;
  
  if (typeof lat === "string") lat = parseFloat(lat);
  if (typeof lng === "string") lng = parseFloat(lng);

  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;
  // Fallback 0,0 coordinates mean unlocated, do not map them at null island.
  if (lat === 0 && lng === 0) return null;

  return [lng, lat];
}

export default function ItineraryMap({
  stops,
  activeDay,
  onStopClick,
  highlightedOrder,
}: ItineraryMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const onLoad = useCallback(() => setMapLoaded(true), []);
  const dayStops = stops.filter((s) => s.day === activeDay);
  const color = activeDay === "sabado" ? "#C4622D" : "#2D7D62";

  // GeoJSON line connecting all stops with coords
  const coordsWithData = dayStops.map(getCoords);
  const lineCoords = coordsWithData.filter((c): c is [number, number] => c !== null);

  const lineGeoJSON: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: lineCoords },
  };

  // Fit map to all stops on activeDay change
  useEffect(() => {
    if (!mapRef.current || lineCoords.length === 0) return;
    if (lineCoords.length === 1) {
      mapRef.current.flyTo({ center: lineCoords[0], zoom: 13, duration: 800 });
      return;
    }
    const lngs = lineCoords.map((c) => c[0]);
    const lats = lineCoords.map((c) => c[1]);
    mapRef.current.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 72, duration: 800, maxZoom: 14 }
    );
  }, [activeDay, stops.length]);

  // Default center: Mexico
  const defaultCenter =
    (lineCoords as [number, number][]).length > 0
      ? { latitude: (lineCoords as [number, number][])[0][1], longitude: (lineCoords as [number, number][])[0][0] }
      : { latitude: 20.6597, longitude: -103.3496 };

  // Calculate jittered coordinates for overlapping stops
  const jitteredStops = dayStops.map((stop) => {
    const coords = getCoords(stop);
    if (!coords) return { stop, coords: null };
    return { stop, coords };
  });

  const coordGroups = new globalThis.Map<string, Array<{ stop: ResolvedStop; coords: [number, number] | null }>>();
  jitteredStops.forEach((item) => {
    if (!item.coords) return;
    const key = `${item.coords[0].toFixed(5)},${item.coords[1].toFixed(5)}`;
    if (!coordGroups.has(key)) coordGroups.set(key, []);
    coordGroups.get(key)!.push(item);
  });

  coordGroups.forEach((group: Array<{ stop: ResolvedStop; coords: [number, number] | null }>) => {
    if (group.length > 1) {
      // Apply circular radial offset
      const radius = 0.0015; // roughly 150m
      group.forEach((item, index: number) => {
        if (!item.coords) return;
        const angle = (index / group.length) * Math.PI * 2;
        item.coords[0] += Math.cos(angle) * (radius / Math.cos(item.coords[1] * Math.PI / 180));
        item.coords[1] += Math.sin(angle) * radius;
      });
    }
  });

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{ ...defaultCenter, zoom: 12 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      attributionControl={false}
      onLoad={onLoad}
    >
      {/* Route line — only render after map is loaded */}
      {mapLoaded && lineCoords.length > 1 && (
        <Source id="route-line" type="geojson" data={lineGeoJSON}>
          <Layer
            id="route-line-layer"
            type="line"
            paint={{
              "line-color": color,
              "line-width": 3,
              "line-opacity": 0.7,
              "line-dasharray": [2, 1.5],
            }}
          />
        </Source>
      )}

      {/* Numbered markers — only render after map is loaded to avoid appendChild crash */}
      {mapLoaded && jitteredStops.map(({ stop, coords }) => {
        if (!coords) return null;
        const isHighlighted = stop.order === highlightedOrder;
        const label = stop.place?.name ?? stop.event?.title ?? "";
        return (
          <Marker
            key={`${stop.day}-${stop.order}`}
            longitude={coords[0]}
            latitude={coords[1]}
            anchor="center"
            onClick={(e: { originalEvent: MouseEvent }) => {
              e.originalEvent.stopPropagation();
              onStopClick?.(stop);
            }}
          >
            <div
              title={label}
              style={{
                width: isHighlighted ? 36 : 30,
                height: isHighlighted ? 36 : 30,
                borderRadius: "50%",
                background: color,
                border: `3px solid ${isHighlighted ? "#fff" : "rgba(255,255,255,0.8)"}`,
                boxShadow: isHighlighted
                  ? `0 0 0 3px ${color}, 0 4px 12px rgba(0,0,0,0.3)`
                  : "0 2px 8px rgba(0,0,0,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: isHighlighted ? "0.85rem" : "0.75rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
                transform: isHighlighted ? "scale(1.15)" : "scale(1)",
              }}
            >
              {stop.order}
            </div>
          </Marker>
        );
      })}
    </Map>
  );
}
