"use client";
import { motion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RouteStop as RouteStopType, getStopId, getStopName, getStopImage, getStopCategory, getStopLocation } from "@/types";
import { CATEGORIES } from "@/lib/data";

/** Build a Google Maps directions URL from an optional origin to a destination */
function buildDirectionsUrl(
  stop: RouteStopType,
  prevStop?: RouteStopType
): string {
  const item = stop.type === "place" ? stop.place : stop.event;
  if (!item) return "#";
  const lat = (item as any).latitude;
  const lng = (item as any).longitude;
  const dest = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent((item as any).name ?? "");

  if (prevStop) {
    const prevItem = prevStop.type === "place" ? prevStop.place : prevStop.event;
    if (prevItem) {
      const pLat = (prevItem as any).latitude;
      const pLng = (prevItem as any).longitude;
      const origin = pLat != null && pLng != null ? `${pLat},${pLng}` : encodeURIComponent((prevItem as any).name ?? "");
      return `https://www.google.com/maps/dir/${origin}/${dest}`;
    }
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

interface RouteStopProps {
  stop: RouteStopType;
  index: number;
  prevStop?: RouteStopType;
  onRemove: (itemId: string) => void;
}

export default function RouteStop({ stop, index, prevStop, onRemove }: RouteStopProps) {
  const itemId = getStopId(stop);
  const name = getStopName(stop);
  const image = getStopImage(stop);
  const categoryId = getStopCategory(stop);
  const location = getStopLocation(stop);
  const category = CATEGORIES.find((c) => c.id === categoryId);
  const directionsUrl = buildDirectionsUrl(stop, prevStop);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: itemId });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
      }}
    >
      {/* Connector from previous stop */}
      {prevStop && (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 py-1.5 px-8 group"
          style={{ textDecoration: "none" }}
        >
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M12 2C9.24 2 7 4.24 7 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
            <circle cx="12" cy="7" r="1.5" fill="var(--secondary)" stroke="none" />
          </svg>
          <span
            className="text-xs font-medium group-hover:underline"
            style={{ color: "var(--secondary)" }}
          >
            Ver cómo llegar desde parada anterior
          </span>
        </a>
      )}

      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        className="flex items-center gap-3 rounded-2xl p-3.5"
        style={{ background: "var(--surface-container-lowest)", boxShadow: "var(--shadow-card)" }}
      >
        {/* Order number */}
        <div
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: stop.type === "event" ? "var(--maiz)" : "var(--terracota)" }}
        >
          {index + 1}
        </div>

        {/* Thumbnail */}
        <div
          className="shrink-0 w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center"
          style={{ background: "var(--bg-muted)" }}
        >
          {image ? (
            <img src={image} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl">
              {category?.icon ?? (stop.type === "event" ? "📅" : "📍")}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>
            {name}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {category?.icon} {category?.name ?? (stop.type === "event" ? "Evento" : "Lugar")}
            {location && ` · ${location}`}
          </p>
          {/* Directions link for first stop (no prevStop connector) */}
          {!prevStop && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1"
              style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--secondary)", textDecoration: "none" }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C9.24 2 7 4.24 7 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
              </svg>
              Cómo llegar
            </a>
          )}
        </div>

        {/* Drag handle */}
        <button
          className="shrink-0 px-1.5 text-lg cursor-grab active:cursor-grabbing transition-opacity hover:opacity-60"
          style={{ color: "var(--border-strong)" }}
          aria-label={`Reordenar ${name}`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>

        {/* Remove */}
        <button
          onClick={() => onRemove(itemId)}
          className="shrink-0 px-1.5 text-sm transition-opacity hover:opacity-60"
          style={{ color: "var(--text-muted)" }}
        >
          ✕
        </button>
      </motion.div>
    </div>
  );
}
