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
}

const isDENUE = (id: string) => id.startsWith('denue-');

export default function PlaceCard({ place, compact = false, highlight = false, pickReason }: PlaceCardProps) {
  const category = CATEGORIES.find((c) => c.id === place.category);
  const verified = isDENUE(place.id);

  /* ── Compact (lista en Home) ─────────────────── */
  if (compact) {
    return (
      <Link href={`/lugar/${place.id}`}>
        <motion.div
          whileHover={{ backgroundColor: "var(--bg-subtle)" }}
          whileTap={{ scale: 0.99 }}
          className="flex gap-3 rounded-xl px-3 py-2.5 transition-colors cursor-pointer"
          style={{ border: "1px solid var(--border)" }}
        >
          <div
            className="w-14 h-14 rounded-lg bg-cover bg-center shrink-0"
            style={{ backgroundImage: `url(${place.photos[0]})` }}
          />
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <p className="font-semibold text-sm leading-snug truncate" style={{ color: "var(--text)" }}>
              {place.name}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
              {place.town}, {place.state}
            </p>
            <span
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium w-fit rounded-full px-2 py-0.5"
              style={{ background: `${category?.color}18`, color: category?.color }}
            >
              {category?.icon} {category?.name}
            </span>
          </div>
        </motion.div>
      </Link>
    );
  }

  /* ── Full card (Explore grid) ────────────────── */
  return (
    <Link href={`/lugar/${place.id}`}>
      <motion.article
        whileHover={{ y: -3, boxShadow: "0 12px 40px rgba(0,0,0,0.10)" }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl overflow-hidden cursor-pointer"
        style={{
          border: highlight ? "2px solid var(--terracota)" : "1px solid var(--border)",
          boxShadow: highlight ? "0 4px 20px rgba(196,98,45,0.15)" : "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        {/* Foto 16:9 */}
        <div className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${place.photos[0]})`, background: place.photos[0] ? undefined : "var(--bg-muted)" }}
          />
          <span
            className="absolute top-3 left-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
            style={{ background: `${category?.color}DD`, backdropFilter: "blur(4px)" }}
          >
            {category?.icon} {category?.name}
          </span>
          {verified && (
            <span
              className="absolute top-3 right-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.92)", color: "#2D7D62", backdropFilter: "blur(4px)" }}
              title="Verificado por INEGI/DENUE"
            >
              ✓ INEGI
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <h3
            className="font-semibold text-base leading-snug mb-1"
            style={{ color: "var(--text)" }}
          >
            {place.name}
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            📍 {place.town}, {place.state}
          </p>

          {/* AI pick reason — shown when AI selected this place */}
          {pickReason ? (
            <p className="text-sm leading-relaxed italic" style={{ color: "var(--terracota)" }}>
              &ldquo;{pickReason}&rdquo;
            </p>
          ) : (
            <p className="text-sm leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
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
        </div>
      </motion.article>
    </Link>
  );
}
