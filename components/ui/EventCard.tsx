"use client";

import { motion } from "framer-motion";
import { Event } from "@/types/events";
import { CATEGORIES } from "@/lib/data";

interface EventCardProps {
  event: Event;
  compact?: boolean;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso.split("T")[0];
  }
}

export default function EventCard({ event, compact = false }: EventCardProps) {
  const cat = CATEGORIES.find((c) => c.id === event.category);
  const location = [event.venue_name, event.city, event.state]
    .filter(Boolean)
    .join(", ") || "Ubicación pendiente";

  /* ── Compact (lista en Home / highlighted) ──────────────────────── */
  if (compact) {
    return (
      <a
        href={`/evento/${event.slug}`}
      >
        <motion.div
          whileHover={{ backgroundColor: "var(--bg-subtle)" }}
          whileTap={{ scale: 0.99 }}
          className="flex gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors"
          style={{ border: "1px solid var(--border)" }}
        >
          {/* Thumbnail */}
          <div className="w-14 h-14 rounded-lg shrink-0 overflow-hidden bg-bg-muted flex items-center justify-center">
            {event.image_url ? (
              <img
                src={event.image_url}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl">{cat?.icon ?? "📅"}</span>
            )}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <p
              className="font-semibold text-sm leading-snug truncate"
              style={{ color: "var(--text)" }}
            >
              {event.title}
            </p>
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: "var(--text-muted)" }}
            >
              {location}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5"
                style={{
                  background: `${cat?.color ?? "var(--maiz)"}18`,
                  color: cat?.color ?? "var(--maiz)",
                }}
              >
                {cat?.icon ?? "📅"} {formatDate(event.start_date)}
              </span>
              {event.source_name && (
                <span
                  className="text-[10px] truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  {event.source_name}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </a>
    );
  }

  /* ── Full card (lista en BottomDrawer) ──────────────────────────── */
  return (
    <a
      href={`/evento/${event.slug}`}
      className="group block"
    >
      <motion.article
        whileHover={{ y: -3, boxShadow: "0 12px 40px rgba(0,0,0,0.10)" }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl overflow-hidden"
        style={{
          border: "1px solid var(--border)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        {/* Image 16:9 */}
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: "16/9", background: "var(--bg-muted)" }}
        >
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">
              {cat?.icon ?? "📅"}
            </div>
          )}

          {/* Category badge */}
          <span
            className="absolute top-3 left-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
            style={{
              background: `${cat?.color ?? "#E8B84B"}DD`,
              backdropFilter: "blur(4px)",
            }}
          >
            {cat?.icon ?? "📅"} {cat?.name ?? "Evento"}
          </span>

          {/* Date badge */}
          <span className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs font-bold bg-white/90 backdrop-blur-sm text-text">
            {formatDate(event.start_date)}
          </span>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3
            className="font-semibold text-base leading-snug mb-1 group-hover:text-terracota transition-colors"
            style={{ color: "var(--text)" }}
          >
            {event.title}
          </h3>

          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            📍 {location}
          </p>

          {event.short_description && (
            <p
              className="text-sm leading-relaxed line-clamp-2 mb-3"
              style={{ color: "var(--text-secondary)" }}
            >
              {event.short_description}
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-zinc-50">
            <div className="flex items-center gap-2">
              {event.is_free && (
                <span
                  className="text-[10px] font-bold rounded-full px-2 py-0.5"
                  style={{ background: "var(--jade)/10", color: "var(--jade)" }}
                >
                  Gratis
                </span>
              )}
              {event.price_text && !event.is_free && (
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {event.price_text}
                </span>
              )}
            </div>
            {event.source_name && (
              <span
                className="text-[10px] font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                vía {event.source_name}
              </span>
            )}
          </div>
        </div>
      </motion.article>
    </a>
  );
}
