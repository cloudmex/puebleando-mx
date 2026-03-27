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

const ItineraryMap = dynamic(() => import("@/components/map/ItineraryMap"), { ssr: false });

const CAT_ICONS: Record<string, string> = {
  gastronomia: "🍽️", cultura: "🎭", naturaleza: "🌿",
  mercados: "🛍️", artesanos: "🪴", festivales: "🎉",
};

function horaToMinutes(hora: string): number {
  const match = hora.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 9999;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
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
  sabado:  { color: "#C4622D", icsColor: "#C4622D" },
  domingo: { color: "#2D7D62", icsColor: "#2D7D62" },
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
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = (match[3] ?? "").toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  else if (ampm === "AM" && h === 12) h = 0;
  return { h, m };
}

function toICSDate(isoOrCustom: string): string {
  // Convert ISO datetime to ICS format: 20260321T200000Z
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
        padding: "12px 0", borderBottom: "1px solid var(--border)",
        cursor: "pointer", textAlign: "left", width: "100%",
        borderRadius: isHighlighted ? "var(--r-md)" : 0,
        outline: isHighlighted ? `2px solid ${color}` : "none",
        outlineOffset: 2,
        opacity: isDragging ? 0.4 : 1,
        transition: "outline 0.2s, opacity 0.15s",
        background: isDragging ? "var(--bg-subtle)" : undefined,
      }}
    >
      {/* Drag handle */}
      <div
        {...dragHandleProps}
        onClick={(e) => e.stopPropagation()}
        style={{
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          width: 20, marginTop: 7, color: "var(--border-strong)",
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

// ── Tips card ─────────────────────────────────────────────────────────────
function TipsCard({ plan }: { plan: PlanData }) {
  const [open, setOpen] = useState(false);
  const hasTips = plan.tips && plan.tips.length > 0;
  const hasContent = plan.descripcion || plan.clima || plan.vestimenta || hasTips;
  if (!hasContent) return null;

  return (
    <div
      className="no-print"
      style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}
    >
      {/* Summary row — always visible, tap to expand */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "9px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          overflow: "hidden",
        }}
      >
        {plan.clima && (
          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
            {plan.clima.split(",")[0]}
          </span>
        )}
        {plan.vestimenta && (
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
            👕 {plan.vestimenta.split(".")[0]}
          </span>
        )}
        <span style={{ fontSize: "0.72rem", color: "var(--terracota)", fontWeight: 600, whiteSpace: "nowrap", marginLeft: "auto", flexShrink: 0 }}>
          {hasTips ? `${plan.tips!.length} tips` : "Detalles"} {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Expanded */}
      {open && (
        <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
          {plan.descripcion && (
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
              {plan.descripcion}
            </p>
          )}

          {/* Clima + Vestimenta pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {plan.clima && (
              <div style={{ flex: "1 1 140px", background: "#fff", borderRadius: "var(--r-md)", padding: "10px 12px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Clima</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text)", lineHeight: 1.4 }}>{plan.clima}</div>
              </div>
            )}
            {plan.vestimenta && (
              <div style={{ flex: "1 1 140px", background: "#fff", borderRadius: "var(--r-md)", padding: "10px 12px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Vestimenta</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text)", lineHeight: 1.4 }}>👕 {plan.vestimenta}</div>
              </div>
            )}
          </div>

          {/* Tips */}
          {hasTips && (
            <div style={{ background: "#fff", borderRadius: "var(--r-md)", padding: "10px 12px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
                Tips para disfrutar mejor
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {plan.tips!.map((tip, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    <span style={{ color: "var(--terracota)", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>•</span>
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Action bar ────────────────────────────────────────────────────────────
function ActionBar({ plan, onRefresh }: { plan: PlanData; onRefresh: () => void }) {
  const btnStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "8px 12px",
    border: "1.5px solid var(--border)",
    borderRadius: "var(--r-sm)",
    background: "var(--bg)",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 500,
    color: "var(--text-secondary)",
    transition: "border-color 0.15s, color 0.15s",
  };

  return (
    <div
      className="no-print"
      style={{
        display: "flex",
        gap: 8,
        padding: "8px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-subtle)",
      }}
    >
      <button style={btnStyle} onClick={() => downloadICS(plan)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        Guardar en calendario
      </button>
      <button style={btnStyle} onClick={() => window.print()}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        Imprimir / PDF
      </button>
      <button
        style={{ ...btnStyle, flex: "none", padding: "8px 10px" }}
        onClick={onRefresh}
        title="Regenerar agenda"
      >
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
  const isLast = false; // handled via CSS :last-child

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
  try { sessionStorage.setItem(key, JSON.stringify({ plan, cachedAt: Date.now() })); } catch {}
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
  const didFetch = useRef(false);

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
        <Link href="/" style={{ marginTop: 8, padding: "10px 24px", borderRadius: "var(--r-full)", background: "var(--terracota)", color: "#fff", fontWeight: 600, fontSize: "0.9rem", textDecoration: "none" }}>
          Volver
        </Link>
      </div>
    );
  }

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
        {plan?.resumen && (
          <div style={{ padding: "12px 20px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)", fontSize: "0.85rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
            {plan.resumen}
          </div>
        )}

        <TipsCard plan={plan!} />

        <ActionBar
        plan={plan!}
        onRefresh={() => {
          try { sessionStorage.removeItem(cacheKey); } catch {}
          didFetch.current = false;
          setState("loading");
          setProgressSteps([]);
          setPlan(null);
          // Re-trigger the effect by toggling the ref and calling the fetch manually
          didFetch.current = false;
          window.location.reload();
        }}
      />

        {/* Day tabs — only show selected days */}
        {plan!.dias.length > 1 && (
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
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
                    flex: 1, padding: "12px 0", background: "none", border: "none", cursor: "pointer",
                    fontWeight: isActive ? 700 : 500, fontSize: "0.82rem",
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
            <div style={{ width: "100%", height: "50%", borderTop: "1px solid var(--border)" }} className="md:w-[55%] md:h-full md:border-t-0 md:border-l">
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

      {/* Print-only view */}
      <PrintContent plan={plan!} />
    </>
  );
}
