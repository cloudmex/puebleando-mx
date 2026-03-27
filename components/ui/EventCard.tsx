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

  /* ── Compact ──────────────────────── */
  if (compact) {
    return (
      <a href={`/evento/${event.slug}`}>
        <motion.div
          whileHover={{ backgroundColor: "var(--surface-container-low)" }}
          whileTap={{ scale: 0.99 }}
          className="flex gap-3.5 rounded-2xl px-3.5 py-3 cursor-pointer transition-colors"
          style={{ background: "var(--surface-container-lowest)" }}
        >
          <div className="w-14 h-14 rounded-xl shrink-0 overflow-hidden flex items-center justify-center"
            style={{ background: "var(--surface-container-high)" }}>
            {event.image_url ? (
              <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">{cat?.icon ?? "📅"}</span>
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <p className="font-semibold text-sm leading-snug truncate" style={{ color: "var(--on-surface)" }}>
              {event.title}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
              {location}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-0.5"
                style={{ background: `${cat?.color ?? "var(--maiz)"}14`, color: cat?.color ?? "var(--maiz)" }}
              >
                {cat?.icon ?? "📅"} {formatDate(event.start_date)}
              </span>
              {event.source_name && (
                <span className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                  {event.source_name}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </a>
    );
  }

  /* ── Full card ──────────────────────────── */
  return (
    <a href={`/evento/${event.slug}`} className="group block">
      <motion.article
        whileHover={{ y: -4, boxShadow: "var(--shadow-card-hover)" }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.2 }}
        className="rounded-3xl overflow-hidden"
        style={{
          background: "var(--surface-container-lowest)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Image */}
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: "16/10", background: "var(--surface-container-high)" }}
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

          <span
            className="cat-badge absolute top-3 left-3"
            style={{ background: `${cat?.color ?? "#E8B84B"}CC` }}
          >
            {cat?.icon ?? "📅"} {cat?.name ?? "Evento"}
          </span>

          <span
            className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs font-bold"
            style={{ background: "rgba(255,255,255,0.9)", color: "var(--on-surface)", backdropFilter: "blur(8px)" }}
          >
            {formatDate(event.start_date)}
          </span>
        </div>

        {/* Info */}
        <div className="p-4 pb-5">
          <h3
            className="font-bold text-base leading-snug mb-1"
            style={{ color: "var(--on-surface)", fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}
          >
            {event.title}
          </h3>

          <p className="text-xs mb-2.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--tertiary)" stroke="none">
              <path d="M12 2C9.24 2 7 4.24 7 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
            </svg>
            {location}
          </p>

          {event.short_description && (
            <p className="text-sm leading-relaxed line-clamp-2 mb-3" style={{ color: "var(--on-surface-variant)" }}>
              {event.short_description}
            </p>
          )}

          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-2">
              {event.is_free && (
                <span
                  className="text-[10px] font-bold rounded-full px-2.5 py-0.5"
                  style={{ background: "var(--tertiary-container)", color: "var(--tertiary)" }}
                >
                  Gratis
                </span>
              )}
              {event.price_text && !event.is_free && (
                <span className="text-[11px] font-medium" style={{ color: "var(--on-surface-variant)" }}>
                  {event.price_text}
                </span>
              )}
            </div>
            {event.source_name && (
              <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                vía {event.source_name}
              </span>
            )}
          </div>
        </div>
      </motion.article>
    </a>
  );
}
