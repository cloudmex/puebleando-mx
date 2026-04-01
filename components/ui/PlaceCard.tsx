"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Place } from "@/types";
import { CATEGORIES } from "@/lib/data";

interface PlaceCardProps {
  place: Place;
  compact?: boolean;
  highlight?: boolean;   // featured AI pick
  pickReason?: string;   // AI-generated reason
  /** Shows a "Sugerido para: X" badge on the card */
  vibeBadge?: string;    // e.g. "Vida nocturna", "Gastronomía"
}

const isDENUE = (id: string) => id.startsWith('denue-');

export default function PlaceCard({ place, compact = false, highlight = false, pickReason, vibeBadge }: PlaceCardProps) {
  const category = CATEGORIES.find((c) => c.id === place.category);
  const verified = isDENUE(place.id);

  /* ── Compact (list item) ─────────────────── */
  if (compact) {
    return (
      <Link href={`/lugar/${place.id}`}>
        <motion.div
          whileHover={{ backgroundColor: "var(--surface-container-low)" }}
          whileTap={{ scale: 0.99 }}
          className="flex gap-3.5 rounded-2xl px-3.5 py-3 transition-colors cursor-pointer"
          style={{ background: "var(--surface-container-lowest)" }}
        >
          <div
            className="w-14 h-14 rounded-xl bg-cover bg-center shrink-0 flex items-center justify-center"
            style={{
              backgroundImage: place.photos[0] ? `url(${place.photos[0]})` : undefined,
              background: place.photos[0] ? undefined : "var(--surface-container-high)",
            }}
          >
            {!place.photos[0] && <span style={{ fontSize: "1.2rem" }}>{category?.icon ?? "📍"}</span>}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <p className="font-semibold text-sm leading-snug truncate" style={{ color: "var(--on-surface)" }}>
              {place.name}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
              {place.town}, {place.state}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span
                className="inline-flex items-center gap-1 text-xs font-medium w-fit rounded-full px-2.5 py-0.5"
                style={{ background: `${category?.color}14`, color: category?.color }}
              >
                {category?.icon} {category?.name}
              </span>
              {vibeBadge && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5"
                  style={{ background: "var(--tertiary-container)", color: "var(--tertiary)" }}
                >
                  Ideal
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    );
  }

  /* ── Full card (editorial grid) ────────────────── */
  return (
    <Link href={`/lugar/${place.id}`}>
      <motion.article
        whileHover={{ y: -4, boxShadow: "var(--shadow-card-hover)" }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.2 }}
        className="rounded-3xl overflow-hidden cursor-pointer"
        style={{
          background: "var(--surface-container-lowest)",
          boxShadow: highlight ? "0 4px 24px rgba(156,61,42,0.15)" : "var(--shadow-card)",
        }}
      >
        {/* Photo */}
        <div className="relative overflow-hidden" style={{ aspectRatio: "16/10" }}>
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 hover:scale-105 flex items-center justify-center"
            style={place.photos[0]
              ? { backgroundImage: `url(${place.photos[0]})` }
              : { background: "var(--surface-container-high)" }
            }
          >
            {!place.photos[0] && <span style={{ fontSize: "2rem", opacity: 0.5 }}>{category?.icon ?? "📍"}</span>}
          </div>
          <span
            className="cat-badge absolute top-3 left-3"
            style={{ background: `${category?.color}CC` }}
          >
            {category?.icon} {category?.name}
          </span>
          {highlight && (
            <span
              className="absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--primary-container))",
                color: "white",
              }}
            >
              Top Pick
            </span>
          )}
          {verified && !highlight && (
            <span
              className="absolute top-3 right-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.92)", color: "var(--secondary)", backdropFilter: "blur(4px)" }}
              title="Verificado por INEGI/DENUE"
            >
              INEGI
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-4 pb-5">
          <h3
            className="font-bold text-base leading-snug mb-1"
            style={{ color: "var(--on-surface)", fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}
          >
            {place.name}
          </h3>
          <p className="text-xs mb-3 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--tertiary)" stroke="none">
              <path d="M12 2C9.24 2 7 4.24 7 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
            </svg>
            {place.town}, {place.state}
          </p>

          {pickReason ? (
            <p className="text-sm leading-relaxed italic" style={{ color: "var(--primary)" }}>
              &ldquo;{pickReason}&rdquo;
            </p>
          ) : (
            <p className="text-sm leading-relaxed line-clamp-2" style={{ color: "var(--on-surface-variant)" }}>
              {place.description}
            </p>
          )}

          {place.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {place.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          )}

          {vibeBadge && (
            <div
              className="flex items-center gap-1.5 mt-3 text-xs font-semibold rounded-full px-3 py-1.5 w-fit"
              style={{ background: "var(--tertiary-container)", color: "var(--tertiary)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Sugerido para: {vibeBadge}
            </div>
          )}
        </div>
      </motion.article>
    </Link>
  );
}
