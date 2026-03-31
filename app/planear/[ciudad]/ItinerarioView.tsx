"use client";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ResolvedStop, DayKey } from "@/app/api/weekend-plan/route";
import type { LogisticaResponse } from "@/app/api/logistica/route";
import { useAuth } from "@/components/auth/AuthProvider";
import Toast from "@/components/ui/Toast";
import { createRouteWithStops } from "@/lib/routeStore";
import { getApiAuthHeader } from "@/lib/apiAuth";
import type { RouteStop } from "@/types";

const ItineraryMap = dynamic(() => import("@/components/map/ItineraryMap"), { ssr: false });

const CAT_ICONS: Record<string, string> = {
  gastronomia: "🍽️", cultura: "🎭", naturaleza: "🌿",
  mercados: "🛍️", artesanos: "🪴", festivales: "🎉",
  deportes: "⚽",
};

function horaToMinutes(hora: string): number {
  const match = hora.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 9999;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = (match[3] ?? "").toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  else if (ampm === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function sortByHora(stops: ResolvedStop[]): ResolvedStop[] {
  return [...stops]
    .sort((a, b) => horaToMinutes(a.hora) - horaToMinutes(b.hora))
    .map((s, i) => ({ ...s, order: i + 1 }));
}

function stopKey(stop: ResolvedStop): string {
  return stop.place?.id ?? stop.event?.id ?? `${stop.day}-${stop.order}`;
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <circle cx="4" cy="3.5" r="1.2" /><circle cx="4" cy="7" r="1.2" /><circle cx="4" cy="10.5" r="1.2" />
      <circle cx="10" cy="3.5" r="1.2" /><circle cx="10" cy="7" r="1.2" /><circle cx="10" cy="10.5" r="1.2" />
    </svg>
  );
}

const DAY_CONFIG: Record<DayKey, { color: string; icsColor: string }> = {
  viernes: { color: "#1A8FA0", icsColor: "#1A8FA0" },
  sabado:  { color: "#9c3d2a", icsColor: "#9c3d2a" },
  domingo: { color: "#1a5c52", icsColor: "#1a5c52" },
};

type PlanData = {
  ciudad: string;
  resumen: string;
  descripcion?: string;
  clima?: string;
  vestimenta?: string;
  tips?: string[];
  dias: DayKey[];
  viernes: ResolvedStop[];
  sabado: ResolvedStop[];
  domingo: ResolvedStop[];
  friDate: string; // YYYYMMDD
  satDate: string;
  sunDate: string;
  friLabel: string;
  satLabel: string;
  sunLabel: string;
};

// ── ICS calendar generation ───────────────────────────────────────────────
function parseHora(hora: string): { h: number; m: number } {
  const match = hora.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return { h: 12, m: 0 };
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = (match[3] ?? "").toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  else if (ampm === "AM" && h === 12) h = 0;
  return { h, m };
}

function toICSDate(isoOrCustom: string): string {
  const d = new Date(isoOrCustom);
  return d.toISOString().replace(/[-:]/g, "").replace(".000", "").slice(0, 15) + "Z";
}

function generateICS(plan: PlanData): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Puebleando//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const dateStrByDay: Record<DayKey, string> = {
    viernes: plan.friDate,
    sabado: plan.satDate,
    domingo: plan.sunDate,
  };
  const allStops: Array<ResolvedStop & { dateStr: string }> = plan.dias.flatMap((d) =>
    plan[d].map((s) => ({ ...s, dateStr: dateStrByDay[d] }))
  );

  for (const stop of allStops) {
    const esc = (s: string) => s.replace(/[\\;,\n]/g, " ").trim();
    const name = esc(stop.place?.name ?? stop.event?.title ?? "Parada");
    const location = esc(stop.event?.venue_name ?? stop.place?.town ?? plan.ciudad);
    const description = esc(stop.razon);

    let dtStart: string;
    let dtEnd: string;

    if (stop.event?.start_date) {
      dtStart = toICSDate(stop.event.start_date);
      const endMs = new Date(stop.event.start_date).getTime() + 2 * 60 * 60 * 1000;
      dtEnd = toICSDate(new Date(endMs).toISOString());
    } else {
      const { h, m } = parseHora(stop.hora);
      const ymd = stop.dateStr; // YYYYMMDD
      dtStart = `${ymd}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
      dtEnd = `${ymd}T${String(Math.min(h + 2, 23)).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
    }

    lines.push(
      "BEGIN:VEVENT",
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${name}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadICS(plan: PlanData) {
  const ics = generateICS(plan);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `puebleando-${plan.ciudad.toLowerCase().replace(/\s+/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Animated step list shown during loading ───────────────────────────────
function ProgressList({ steps }: { steps: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320 }}>
      {steps.map((msg, i) => {
        const isCurrent = i === steps.length - 1;
        return (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 10, opacity: isCurrent ? 1 : 0.5, transition: "opacity 0.3s" }}
          >
            {isCurrent ? (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--terracota)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="7" stroke="#2D7D62" strokeWidth="1.5" />
                <path d="M5 8l2 2 4-4" stroke="#2D7D62" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span style={{ fontSize: "0.85rem", color: isCurrent ? "var(--text)" : "var(--text-muted)", fontWeight: isCurrent ? 500 : 400 }}>
              {msg}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── External link icon ────────────────────────────────────────────────────
function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ── Stop card ─────────────────────────────────────────────────────────────
function StopCard({
  stop, isHighlighted, onHighlight, color, dragHandleProps, isDragging, onHoraEdit,
}: {
  stop: ResolvedStop;
  isHighlighted: boolean;
  onHighlight: () => void;
  color: string;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  onHoraEdit?: (hora: string) => void;
}) {
  const router = useRouter();
  const [editingHora, setEditingHora] = useState(false);
  const horaInputRef = useRef<HTMLInputElement>(null);

  const name = stop.place?.name ?? stop.event?.title ?? "Parada";
  const location = stop.place
    ? `${stop.place.town}${stop.place.state ? `, ${stop.place.state}` : ""}`
    : `${stop.event?.city ?? ""}${stop.event?.state ? `, ${stop.event.state}` : ""}`;
  const category = stop.place?.category ?? stop.event?.category ?? "";
  const image = stop.place?.photos?.[0] ?? stop.event?.image_url;
  const detailHref = stop.event
    ? `/evento/${stop.event.id}`
    : stop.place && !stop.place.id.startsWith("gen-")
    ? `/lugar/${stop.place.id}`
    : null;

  const isGoogleMaps = stop.referenceName === "Google Maps";

  const commitHora = (val: string) => {
    const trimmed = val.trim();
    if (trimmed && trimmed !== stop.hora) onHoraEdit?.(trimmed);
    setEditingHora(false);
  };

  return (
    <div
      onClick={onHighlight}
      style={{
        display: "flex", gap: 10, alignItems: "flex-start",
        padding: "14px 0",
        cursor: "pointer", textAlign: "left", width: "100%",
        borderRadius: "var(--r-md)",
        outline: isHighlighted ? `2px solid ${color}` : "none",
        outlineOffset: 2,
        opacity: isDragging ? 0.4 : 1,
        transition: "outline 0.2s, opacity 0.15s",
        background: isDragging ? "var(--surface-container-low)" : undefined,
      }}
    >
      {/* Drag handle */}
      <div
        {...dragHandleProps}
        onClick={(e) => e.stopPropagation()}
        aria-label="Arrastrar para reordenar"
        role="button"
        tabIndex={0}
        style={{
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, minHeight: 44, marginTop: 0, color: "var(--outline)",
          cursor: "grab", touchAction: "none",
          ...(dragHandleProps?.style ?? {}),
        }}
      >
        <GripIcon />
      </div>

      {/* Badge */}
      <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", background: color, color: "#fff", fontWeight: 700, fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
        {stop.order}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)" }}>{name}</span>
          {category && <span style={{ fontSize: "0.85rem" }}>{CAT_ICONS[category] ?? "📍"}</span>}
        </div>

        {/* Time — tappable to edit */}
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
          {stop.hora && (
            editingHora ? (
              <input
                ref={horaInputRef}
                type="text"
                defaultValue={stop.hora}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => commitHora(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") commitHora((e.target as HTMLInputElement).value);
                  if (e.key === "Escape") setEditingHora(false);
                }}
                style={{
                  width: 72, fontSize: "0.75rem", fontWeight: 700,
                  color, border: `1.5px solid ${color}`, borderRadius: 6,
                  padding: "1px 5px", outline: "none", background: "#fff",
                }}
              />
            ) : (
              <span
                onClick={(e) => { e.stopPropagation(); setEditingHora(true); }}
                title="Toca para editar la hora"
                style={{
                  color, fontWeight: 700, cursor: "text",
                  borderBottom: `1px dashed ${color}44`,
                  paddingBottom: 1,
                }}
              >
                {stop.hora}
              </span>
            )
          )}
          {location && <span>{location}</span>}
        </div>

        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4, marginBottom: 6 }}>
          {stop.razon}
        </div>

        {/* Footer: source link + maps link + detail link */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Source link (news site, Ticketmaster, etc.) — shown only when it's NOT just Google Maps */}
          {stop.referenceUrl && !isGoogleMaps && (
            <a
              href={stop.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: "0.7rem", color: "var(--jade)",
                textDecoration: "none", fontWeight: 500,
              }}
            >
              <ExternalIcon />
              {stop.referenceName}
            </a>
          )}
          {/* Google Maps link — always shown when available */}
          {stop.mapsUrl && (
            <a
              href={stop.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: "0.7rem", color: "var(--text-muted)",
                textDecoration: "none", fontWeight: 400,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C9.24 2 7 4.24 7 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
                <circle cx="12" cy="7" r="2" fill="currentColor" stroke="none" />
              </svg>
              Maps
            </a>
          )}
          {detailHref && (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(detailHref); }}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 400,
                marginLeft: "auto",
              }}
            >
              Ver detalle →
            </button>
          )}
        </div>
      </div>

      {/* Thumbnail */}
      {image && (
        <div style={{ flexShrink: 0, width: 52, height: 52, borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--bg-muted)" }}>
          <img src={image} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
    </div>
  );
}

// ── Sortable wrapper ───────────────────────────────────────────────────────
function SortableStopCard(props: Omit<React.ComponentProps<typeof StopCard>, "dragHandleProps" | "isDragging"> & { id: string }) {
  const { id, ...rest } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <StopCard {...rest} isDragging={isDragging} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

// ── Bottom Sheet overlay ──────────────────────────────────────────────────
function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 900,
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(2px)",
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: "relative",
          background: "var(--bg)",
          borderRadius: "20px 20px 0 0",
          maxHeight: "75dvh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
          animation: "slideUp 0.25s ease-out",
        }}
      >
        {/* Handle + header */}
        <div style={{ padding: "12px 20px 8px", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)", margin: "0 auto 10px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>{title}</h3>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)", fontSize: "1.2rem", lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        </div>
        {/* Content */}
        <div style={{ overflowY: "auto", padding: "8px 20px 24px", flex: 1 }}>
          {children}
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}

// ── Tips sheet content ────────────────────────────────────────────────────
function TipsSheetContent({ plan }: { plan: PlanData }) {
  const hasTips = plan.tips && plan.tips.length > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {plan.descripcion && (
        <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
          {plan.descripcion}
        </p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {plan.clima && (
          <div style={{ flex: "1 1 140px", background: "var(--bg-subtle)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 4 }}>Clima</div>
            <div style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.5 }}>{plan.clima}</div>
          </div>
        )}
        {plan.vestimenta && (
          <div style={{ flex: "1 1 140px", background: "var(--bg-subtle)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 4 }}>Vestimenta</div>
            <div style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.5 }}>{plan.vestimenta}</div>
          </div>
        )}
      </div>
      {hasTips && (
        <div>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 10 }}>Tips para disfrutar mejor</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {plan.tips!.map((tip, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                <span style={{ color: "var(--terracota)", fontWeight: 700, flexShrink: 0 }}>•</span>
                {tip}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Logistics CTA + card ────────────────────────────────────────────────
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const TRANSPORT_ICONS: Record<string, string> = {
  avion: "✈️", autobus: "🚌", auto: "🚗",
};
const TRANSPORT_LABELS: Record<string, string> = {
  avion: "Avión", autobus: "Autobús", auto: "Auto",
};

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place&language=es&limit=1&access_token=${MAPBOX_TOKEN}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.features?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

// ── Logistics sheet content ───────────────────────────────────────────────
function LogisticaSheetContent({ logistica, logisticaState, ciudad, onFetch }: {
  logistica: LogisticaResponse | null;
  logisticaState: "idle" | "detecting" | "loading";
  ciudad: string;
  onFetch: () => void;
}) {
  if (logisticaState === "detecting") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0", justifyContent: "center" }}>
        <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terracota)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
        <span style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>Detectando tu ubicación...</span>
      </div>
    );
  }

  if (logisticaState === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0", justifyContent: "center" }}>
        <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terracota)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
        <span style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>Buscando rutas...</span>
      </div>
    );
  }

  if (!logistica) {
    return (
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: 16 }}>
          Necesitamos tu ubicación para sugerir cómo llegar a {ciudad}.
        </p>
        <button
          onClick={onFetch}
          style={{
            padding: "12px 28px",
            borderRadius: "var(--r-full)",
            background: "linear-gradient(135deg, var(--terracota), #a84e20)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.9rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          Permitir ubicación
        </button>
      </div>
    );
  }

  const bookingBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    padding: "7px 14px",
    borderRadius: "var(--r-full)",
    background: "linear-gradient(135deg, var(--terracota), #a84e20)",
    color: "#fff",
    fontWeight: 600,
    fontSize: "0.75rem",
    border: "none",
    cursor: "pointer",
    textDecoration: "none",
    transition: "opacity 0.15s",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "var(--text-muted)" }}>
        Desde <strong style={{ color: "var(--text)" }}>{logistica.origen}</strong> · ~{logistica.distancia_km} km
      </div>

      {logistica.transporte.length > 0 && (
        <div>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 10 }}>Cómo llegar</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {logistica.transporte.map((t, i) => (
              <div key={i} style={{ background: "var(--bg-subtle)", borderRadius: "var(--r-md)", padding: "14px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{TRANSPORT_ICONS[t.tipo] ?? "🚀"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
                        {t.nombre || (TRANSPORT_LABELS[t.tipo] ?? t.tipo)}
                      </span>
                      {t.verified && (
                        <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "var(--jade)", background: "rgba(45,125,98,0.1)", padding: "2px 7px", borderRadius: "var(--r-full)", whiteSpace: "nowrap" }}>
                          Verificado
                        </span>
                      )}
                    </div>
                    {t.nombre && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 3 }}>
                        {TRANSPORT_LABELS[t.tipo] ?? t.tipo} · {t.duracion}
                      </div>
                    )}
                    {!t.nombre && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 3 }}>{t.duracion}</div>
                    )}
                    <div style={{ fontSize: "0.85rem", color: "var(--terracota)", fontWeight: 600, marginBottom: 3 }}>{t.costo_aprox}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{t.tip}</div>
                    {t.booking_url && (
                      <a
                        href={t.booking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={bookingBtnStyle}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        {t.booking_label || "Reservar en sitio externo"}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {logistica.hospedaje.length > 0 && (
        <div>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 10 }}>Dónde hospedarte</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {logistica.hospedaje.map((h, i) => (
              <div key={i} style={{ background: "var(--bg-subtle)", borderRadius: "var(--r-md)", padding: "14px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>🏨</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
                        {h.nombre || h.tipo}
                      </span>
                      {h.verified && (
                        <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "var(--jade)", background: "rgba(45,125,98,0.1)", padding: "2px 7px", borderRadius: "var(--r-full)", whiteSpace: "nowrap" }}>
                          {h.source === "denue" ? "INEGI" : h.source === "osm" ? "OSM" : "Verificado"}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 3 }}>
                      {h.nombre ? `${h.tipo} · ` : ""}{h.zona}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--terracota)", fontWeight: 600, marginBottom: 3 }}>{h.costo_aprox}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{h.tip}</div>
                    {h.booking_url && (
                      <a
                        href={h.booking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={bookingBtnStyle}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        {h.booking_label || "Reservar en sitio externo"}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Convert itinerary stops to route stops ────────────────────────────────
function itineraryToRouteStops(
  plan: PlanData,
  editedStops: Partial<Record<DayKey, ResolvedStop[]>>
): RouteStop[] {
  const stops: RouteStop[] = [];
  let idx = 0;
  for (const day of plan.dias) {
    const dayStops = editedStops[day] ?? plan[day] ?? [];
    for (const s of dayStops) {
      if (s.place) {
        stops.push({ type: "place", place: s.place, order_index: idx++ });
      } else if (s.event) {
        stops.push({ type: "event", event: s.event, order_index: idx++ });
      }
    }
  }
  return stops;
}

// ── Action bar ────────────────────────────────────────────────────────────
function ActionBar({ plan, onRefresh, hasTips, hasLogistica, onOpenTips, onOpenLogistica, onSaveAsRoute, savingRoute, routeSaved }: {
  plan: PlanData;
  onRefresh: () => void;
  hasTips: boolean;
  hasLogistica: boolean;
  onOpenTips: () => void;
  onOpenLogistica: () => void;
  onSaveAsRoute: () => void;
  savingRoute: boolean;
  routeSaved: boolean;
}) {
  const pillStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 12px",
    border: "none",
    borderRadius: "var(--r-full)",
    cursor: "pointer",
    fontSize: "0.76rem",
    fontWeight: 600,
    transition: "transform 0.1s",
  };

  const iconBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    border: "none",
    borderRadius: "50%",
    background: "var(--bg-subtle)",
    cursor: "pointer",
    color: "var(--text-muted)",
    flexShrink: 0,
  };

  return (
    <div
      className="no-print"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 16px",
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        overflowX: "auto",
      }}
    >
      {/* Feature pills */}
      {hasTips && (
        <button
          style={{ ...pillStyle, background: "linear-gradient(135deg, rgba(26,92,82,0.1), rgba(26,92,82,0.05))", color: "var(--jade)" }}
          onClick={onOpenTips}
        >
          <span style={{ fontSize: "0.85rem" }}>💡</span>
          Tips
        </button>
      )}
      <button
        style={{
          ...pillStyle,
          background: hasLogistica
            ? "linear-gradient(135deg, rgba(196,98,45,0.12), rgba(196,98,45,0.05))"
            : "linear-gradient(135deg, rgba(196,98,45,0.08), rgba(196,98,45,0.03))",
          color: "var(--terracota)",
        }}
        onClick={onOpenLogistica}
      >
        <span style={{ fontSize: "0.85rem" }}>🧳</span>
        {hasLogistica ? "Logística" : "¿Cómo llego?"}
      </button>
      <button
        style={{
          ...pillStyle,
          background: routeSaved
            ? "linear-gradient(135deg, rgba(45,125,98,0.15), rgba(45,125,98,0.08))"
            : "linear-gradient(135deg, rgba(156,61,42,0.12), rgba(156,61,42,0.05))",
          color: routeSaved ? "var(--jade)" : "var(--primary)",
          opacity: savingRoute ? 0.6 : 1,
          cursor: routeSaved ? "default" : "pointer",
        }}
        onClick={onSaveAsRoute}
        disabled={savingRoute || routeSaved}
        aria-label="Guardar como ruta"
      >
        <span style={{ fontSize: "0.85rem" }}>{routeSaved ? "✓" : "📌"}</span>
        {savingRoute ? "Guardando..." : routeSaved ? "Ruta guardada" : "Guardar ruta"}
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Utility icons */}
      <button style={iconBtnStyle} onClick={() => downloadICS(plan)} title="Guardar en calendario" aria-label="Guardar en calendario">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
      <button style={iconBtnStyle} onClick={() => window.print()} title="Imprimir" aria-label="Imprimir">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
      </button>
      <button style={iconBtnStyle} onClick={onRefresh} title="Regenerar agenda" aria-label="Regenerar agenda">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
        </svg>
      </button>
    </div>
  );
}

// ── Print-only full itinerary ──────────────────────────────────────────────
function StopPrintItem({ stop, color }: { stop: ResolvedStop; color: string }) {
  const name = stop.place?.name ?? stop.event?.title ?? "Parada";
  const venue = stop.event?.venue_name ?? "";
  const location = !venue
    ? stop.place
      ? `${stop.place.town}${stop.place.state ? `, ${stop.place.state}` : ""}`
      : `${stop.event?.city ?? ""}${stop.event?.state ? `, ${stop.event.state}` : ""}`
    : "";
  const cat = stop.place?.category ?? stop.event?.category ?? "";

  return (
    <div className="pb-stop">
      <div className="pb-stop-left">
        <div className="pb-stop-num" style={{ background: color }}>{stop.order}</div>
        {stop.hora && <div className="pb-stop-hora" style={{ color }}>{stop.hora}</div>}
        <div className="pb-stop-line" />
      </div>
      <div className="pb-stop-body">
        <div className="pb-stop-name">
          {CAT_ICONS[cat] && <span className="pb-stop-icon">{CAT_ICONS[cat]}</span>}
          {name}
        </div>
        {(venue || location) && (
          <div className="pb-stop-venue">{venue || location}</div>
        )}
        <div className="pb-stop-razon">{stop.razon}</div>
        {stop.referenceUrl && (
          <div className="pb-stop-ref">{stop.referenceName}: {stop.referenceUrl}</div>
        )}
      </div>
    </div>
  );
}

function PrintContent({ plan }: { plan: PlanData }) {
  const today = new Date().toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="pb-print">
      {/* Header */}
      <header className="pb-header">
        <div className="pb-header-brand">Puebleando</div>
        <h1 className="pb-header-city">{plan.ciudad}</h1>
        <p className="pb-header-dates">
          {plan.dias.map((d) => ({ viernes: plan.friLabel, sabado: plan.satLabel, domingo: plan.sunLabel }[d])).join(" · ")}
        </p>
        {plan.resumen && <p className="pb-header-resumen">{plan.resumen}</p>}
      </header>

      {/* Tricolor stripe */}
      <div className="pb-stripe" />

      {/* Days — one column per selected day */}
      <div className="pb-days" style={{ gridTemplateColumns: `repeat(${plan.dias.length}, 1fr)` }}>
        {plan.dias.map((day) => {
          const labelMap: Record<DayKey, string> = {
            viernes: plan.friLabel,
            sabado: plan.satLabel,
            domingo: plan.sunLabel,
          };
          const col = DAY_CONFIG[day].icsColor;
          return (
            <section key={day} className="pb-day">
              <div className="pb-day-label">
                <span className="pb-day-dot" style={{ background: col }} />
                <h2>{labelMap[day]}</h2>
              </div>
              {(plan[day] ?? []).map((stop) => (
                <StopPrintItem key={stop.order} stop={stop} color={col} />
              ))}
            </section>
          );
        })}
      </div>

      {/* Footer */}
      <footer className="pb-footer">
        <span className="pb-footer-logo">Puebleando</span>
        <span>puebleando.mx</span>
        <span>Generado el {today}</span>
      </footer>
    </div>
  );
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — same weekend, same plan

function planCacheKey(ciudad: string, contexto: string, dias: DayKey[]) {
  return `pw-plan|${ciudad.toLowerCase()}|${contexto.slice(0, 120).toLowerCase()}|${dias.slice().sort().join(",")}`;
}

function readCache(key: string): PlanData | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { plan, cachedAt } = JSON.parse(raw);
    if (Date.now() - cachedAt > CACHE_TTL_MS) { sessionStorage.removeItem(key); return null; }
    return plan as PlanData;
  } catch { return null; }
}

function writeCache(key: string, plan: PlanData) {
  try { sessionStorage.setItem(key, JSON.stringify({ plan, cachedAt: Date.now() })); } catch { /* quota exceeded */ }
}

// ── Main view ─────────────────────────────────────────────────────────────
export default function ItinerarioView({
  ciudad,
  contexto = "",
  dias: diasProp,
}: {
  ciudad: string;
  contexto?: string;
  dias?: string[];
}) {
  const dias = (
    (diasProp ?? ["sabado", "domingo"]).filter((d) =>
      ["viernes", "sabado", "domingo"].includes(d)
    ) as DayKey[]
  );
  const initialDay = dias[0] ?? "sabado";
  const cacheKey = planCacheKey(ciudad, contexto, dias);

  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [activeDay, setActiveDay] = useState<DayKey>(initialDay);
  const [highlighted, setHighlighted] = useState<number | undefined>();
  const [editedStops, setEditedStops] = useState<Partial<Record<DayKey, ResolvedStop[]>>>({});
  const [logistica, setLogistica] = useState<LogisticaResponse | null>(null);
  const [logisticaState, setLogisticaState] = useState<"idle" | "detecting" | "loading">("idle");
  const [origenName, setOrigenName] = useState<string | null>(null);
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState<"tips" | "logistica" | null>(null);
  const [savingRoute, setSavingRoute] = useState(false);
  const [routeSaved, setRouteSaved] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const didFetch = useRef(false);
  const didGeoAttempt = useRef(false);

  // Auto-detect geolocation on mount
  useEffect(() => {
    if (didGeoAttempt.current) return;
    didGeoAttempt.current = true;
    if (!navigator.geolocation) return;
    setLogisticaState("detecting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        if (name) setOrigenName(name);
        setLogisticaState("idle");
      },
      () => setLogisticaState("idle"),
      { timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  const fetchLogistica = async () => {
    if (origenName) {
      setLogisticaState("loading");
      try {
        const res = await fetch("/api/logistica", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origen: origenName, destino: ciudad }),
        });
        if (!res.ok) throw new Error("fetch failed");
        const data: LogisticaResponse = await res.json();
        setLogistica(data);
      } catch { /* ignore */ }
      setLogisticaState("idle");
    } else if (navigator.geolocation) {
      setLogisticaState("detecting");
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (name) {
            setOrigenName(name);
            setLogisticaState("loading");
            try {
              const res = await fetch("/api/logistica", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ origen: name, destino: ciudad }),
              });
              if (!res.ok) throw new Error("fetch failed");
              const data: LogisticaResponse = await res.json();
              setLogistica(data);
            } catch { /* ignore */ }
          }
          setLogisticaState("idle");
        },
        () => setLogisticaState("idle"),
        { timeout: 8000 }
      );
    }
  };

  const handleSaveAsRoute = async () => {
    if (!plan || savingRoute || routeSaved) return;
    setSavingRoute(true);

    const routeName = `Fin de semana en ${plan.ciudad}`;
    const routeDescription = plan.resumen ?? "";
    const stops = itineraryToRouteStops(plan, editedStops);

    if (stops.length === 0) {
      setToastMsg("No hay paradas guardables en el itinerario");
      setShowToast(true);
      setSavingRoute(false);
      return;
    }

    try {
      let routeId: string;

      if (user) {
        const headers = await getApiAuthHeader();
        const res = await fetch("/api/routes", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ name: routeName, description: routeDescription, stops }),
        });
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        routeId = data.route.id;
      } else {
        const route = createRouteWithStops(routeName, routeDescription, stops);
        routeId = route.id;
      }

      setRouteSaved(true);
      setToastMsg("Ruta guardada");
      setShowToast(true);
      setTimeout(() => router.push(`/rutas/${routeId}`), 1200);
    } catch {
      setToastMsg("Error al guardar la ruta");
      setShowToast(true);
    } finally {
      setSavingRoute(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    // Restore from cache instantly — no LLM call needed
    const cached = readCache(cacheKey);
    if (cached) {
      setPlan(cached);
      setState("ready");
      return;
    }

    (async () => {
      try {
        const response = await fetch("/api/weekend-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ciudad, contexto, dias }),
        });

        if (!response.body) throw new Error("No response body");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.type === "progress") {
                setProgressSteps((prev) => [...prev, msg.message]);
              } else if (msg.type === "ready") {
                const newPlan: PlanData = {
                  ciudad: msg.ciudad,
                  resumen: msg.resumen,
                  descripcion: msg.descripcion ?? "",
                  clima: msg.clima ?? "",
                  vestimenta: msg.vestimenta ?? "",
                  tips: Array.isArray(msg.tips) ? msg.tips : [],
                  dias: Array.isArray(msg.dias) ? msg.dias : dias,
                  viernes: msg.viernes ?? [],
                  sabado: msg.sabado ?? [],
                  domingo: msg.domingo ?? [],
                  friDate: msg.friDate ?? "",
                  satDate: msg.satDate ?? "",
                  sunDate: msg.sunDate ?? "",
                  friLabel: msg.friLabel ?? "Viernes",
                  satLabel: msg.satLabel ?? "Sábado",
                  sunLabel: msg.sunLabel ?? "Domingo",
                };
                writeCache(cacheKey, newPlan);
                setPlan(newPlan);
                setState("ready");
              } else if (msg.type === "error") {
                setState("error");
              }
            } catch { /* malformed line */ }
          }
        }
      } catch {
        setState("error");
      }
    })();
  }, [ciudad]);

  // Sort stops chronologically when a new plan arrives
  useEffect(() => {
    if (!plan) return;
    const sorted: Partial<Record<DayKey, ResolvedStop[]>> = {};
    for (const day of plan.dias) sorted[day] = sortByHora(plan[day] ?? []);
    setEditedStops(sorted);
  }, [plan?.ciudad, plan?.dias.join()]);

  // Persist user-edited stops back to sessionStorage cache
  const persistEdits = (day: DayKey, stops: ResolvedStop[]) => {
    if (!plan) return;
    const updatedPlan: PlanData = { ...plan, [day]: stops };
    writeCache(cacheKey, updatedPlan);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setEditedStops((prev) => {
      const current = prev[activeDay] ?? [];
      const oldIdx = current.findIndex((s) => stopKey(s) === active.id);
      const newIdx = current.findIndex((s) => stopKey(s) === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      const reordered = arrayMove(current, oldIdx, newIdx).map((s, i) => ({ ...s, order: i + 1 }));
      persistEdits(activeDay, reordered);
      return { ...prev, [activeDay]: reordered };
    });
  };

  const handleHoraEdit = (day: DayKey, stopId: string, newHora: string) => {
    setEditedStops((prev) => {
      const current = prev[day] ?? [];
      const updated = current.map((s) => stopKey(s) === stopId ? { ...s, hora: newHora } : s);
      persistEdits(day, updated);
      return { ...prev, [day]: updated };
    });
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 24, padding: "0 32px" }}>
        <div style={{ textAlign: "center" }}>
          <svg className="animate-spin" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--terracota)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px" }}>
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
            Descubriendo <span style={{ color: "var(--terracota)" }}>{ciudad}</span>
          </p>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Esto puede tomar unos segundos</p>
        </div>
        {progressSteps.length > 0 && <ProgressList steps={progressSteps} />}
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16, textAlign: "center", padding: "0 32px" }}>
        <span style={{ fontSize: "3rem" }}>😕</span>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>Algo salió mal</h2>
        <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>No pudimos generar el itinerario. Intenta de nuevo.</p>
        <Link href="/" style={{ marginTop: 8, padding: "10px 24px", borderRadius: "var(--r-full)", background: "linear-gradient(135deg, var(--primary), var(--primary-container))", color: "#fff", fontWeight: 600, fontSize: "0.9rem", textDecoration: "none" }}>
          Volver
        </Link>
      </div>
    );
  }

  // (Auth gate removed — unauthenticated users now see the full itinerary
  //  and can save routes to localStorage. A banner below encourages sign-up.)

  // ── Ready ────────────────────────────────────────────────────────────────
  const activeDayStops = editedStops[activeDay] ?? plan![activeDay] ?? [];
  const color = DAY_CONFIG[activeDay]?.color ?? "#C4622D";
  const allStops = (plan?.dias ?? []).flatMap((d) => editedStops[d] ?? plan![d] ?? []);
  const hasMap = activeDayStops.some(
    (s) => (s.place?.latitude && s.place.latitude !== 0) || s.event?.latitude != null
  );

  return (
    <>
      {/* Screen view */}
      <div className="no-print" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Thin resumen */}
        {plan?.resumen && (
          <div style={{ padding: "10px 16px", fontSize: "0.82rem", color: "var(--text-secondary)", fontStyle: "italic", borderBottom: "1px solid var(--border)" }}>
            {plan.resumen}
          </div>
        )}

        {/* Sign-up banner for unauthenticated users */}
        {!authLoading && !user && (
          <div
            className="no-print"
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 16px",
              background: "linear-gradient(135deg, rgba(156,61,42,0.06), rgba(26,92,82,0.04))",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <p style={{ flex: 1, fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4, margin: 0 }}>
              Tu ruta se guarda solo en este dispositivo.{" "}
              <span style={{ color: "var(--primary)", fontWeight: 600 }}>Crea una cuenta para no perderla.</span>
            </p>
            <a
              href={`/auth/registro?redirect=/planear/${encodeURIComponent(ciudad)}`}
              style={{
                flexShrink: 0, padding: "7px 14px", borderRadius: "var(--r-full)",
                background: "linear-gradient(135deg, var(--primary), var(--primary-container))",
                color: "#fff", fontWeight: 700, fontSize: "0.72rem", textDecoration: "none",
              }}
            >
              Crear cuenta
            </a>
          </div>
        )}

        {/* Action bar with pill triggers */}
        <ActionBar
          plan={plan!}
          hasTips={!!(plan!.descripcion || plan!.clima || plan!.vestimenta || (plan!.tips && plan!.tips.length > 0))}
          hasLogistica={!!logistica}
          onOpenTips={() => setSheetOpen("tips")}
          onOpenLogistica={() => {
            setSheetOpen("logistica");
            // Auto-fetch if we have origin but no data yet
            if (origenName && !logistica && logisticaState === "idle") fetchLogistica();
          }}
          onRefresh={() => {
            try { sessionStorage.removeItem(cacheKey); } catch {}
            didFetch.current = false;
            setState("loading");
            setProgressSteps([]);
            setPlan(null);
            didFetch.current = false;
            window.location.reload();
          }}
          onSaveAsRoute={handleSaveAsRoute}
          savingRoute={savingRoute}
          routeSaved={routeSaved}
        />

        {/* Day tabs — only show selected days */}
        {plan!.dias.length > 1 && (
          <div style={{ display: "flex", background: "var(--surface)" }}>
            {plan!.dias.map((day) => {
              const isActive = activeDay === day;
              const count = (plan![day] ?? []).length;
              const dayColor = DAY_CONFIG[day].color;
              const labelMap: Record<DayKey, string> = {
                viernes: plan!.friLabel,
                sabado: plan!.satLabel,
                domingo: plan!.sunLabel,
              };
              return (
                <button
                  key={day}
                  onClick={() => { setActiveDay(day); setHighlighted(undefined); }}
                  style={{
                    flex: 1, padding: "14px 0", minHeight: 48, background: "none", border: "none", cursor: "pointer",
                    fontWeight: isActive ? 700 : 500, fontSize: "0.85rem",
                    color: isActive ? dayColor : "var(--text-muted)",
                    borderBottom: isActive ? `2.5px solid ${dayColor}` : "2.5px solid transparent",
                    transition: "all 0.2s",
                  }}
                >
                  {labelMap[day]} <span style={{ fontSize: "0.73rem", opacity: 0.7 }}>({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Split view: list + map */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }} className="md:flex-row">
          <div style={{ width: "100%", height: hasMap ? "50%" : "100%", overflowY: "auto", padding: "0 16px" }} className={hasMap ? "md:w-[45%] md:h-full" : "md:w-full md:h-full"}>
            {activeDayStops.length === 0 ? (
              <p style={{ padding: "24px 0", color: "var(--text-muted)", fontSize: "0.88rem", textAlign: "center" }}>Sin paradas para este día</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={activeDayStops.map(stopKey)} strategy={verticalListSortingStrategy}>
                  {activeDayStops.map((stop) => (
                    <SortableStopCard
                      id={stopKey(stop)}
                      key={stopKey(stop)}
                      stop={stop}
                      isHighlighted={highlighted === stop.order}
                      onHighlight={() => setHighlighted(highlighted === stop.order ? undefined : stop.order)}
                      color={color}
                      onHoraEdit={(hora) => handleHoraEdit(activeDay, stopKey(stop), hora)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
          {hasMap && (
            <div style={{ width: "100%", height: "50%" }} className="md:w-[55%] md:h-full">
              <ItineraryMap
                stops={allStops}
                activeDay={activeDay}
                highlightedOrder={highlighted}
                onStopClick={(s) => setHighlighted(s.order)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom sheet overlays */}
      <BottomSheet open={sheetOpen === "tips"} onClose={() => setSheetOpen(null)} title="Info del destino">
        <TipsSheetContent plan={plan!} />
      </BottomSheet>
      <BottomSheet open={sheetOpen === "logistica"} onClose={() => setSheetOpen(null)} title="Logística de viaje">
        <LogisticaSheetContent
          logistica={logistica}
          logisticaState={logisticaState}
          ciudad={ciudad}
          onFetch={fetchLogistica}
        />
      </BottomSheet>

      {/* Print-only view */}
      <PrintContent plan={plan!} />

      <Toast
        message={toastMsg}
        show={showToast}
        onHide={() => setShowToast(false)}
        type={toastMsg.startsWith("Error") || toastMsg.startsWith("No hay") ? "error" : "success"}
      />
    </>
  );
}
