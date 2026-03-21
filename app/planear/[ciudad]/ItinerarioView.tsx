"use client";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ResolvedStop } from "@/app/api/weekend-plan/route";

const ItineraryMap = dynamic(() => import("@/components/map/ItineraryMap"), { ssr: false });

const CAT_ICONS: Record<string, string> = {
  gastronomia: "🍽️", cultura: "🎭", naturaleza: "🌿",
  mercados: "🛍️", artesanos: "🪴", festivales: "🎉",
};

type PlanData = { ciudad: string; resumen: string; sabado: ResolvedStop[]; domingo: ResolvedStop[] };

// ── Animated step list shown during loading ───────────────────────────────
function ProgressList({ steps }: { steps: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320 }}>
      {steps.map((msg, i) => {
        const isCurrent = i === steps.length - 1;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: isCurrent ? 1 : 0.5,
              transition: "opacity 0.3s",
            }}
          >
            {isCurrent ? (
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--terracota)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ flexShrink: 0 }}
              >
                <circle cx="8" cy="8" r="7" stroke="#2D7D62" strokeWidth="1.5" />
                <path d="M5 8l2 2 4-4" stroke="#2D7D62" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span
              style={{
                fontSize: "0.85rem",
                color: isCurrent ? "var(--text)" : "var(--text-muted)",
                fontWeight: isCurrent ? 500 : 400,
              }}
            >
              {msg}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stop card ─────────────────────────────────────────────────────────────
function StopCard({
  stop,
  isHighlighted,
  onHighlight,
  color,
}: {
  stop: ResolvedStop;
  isHighlighted: boolean;
  onHighlight: () => void;
  color: string;
}) {
  const name = stop.place?.name ?? stop.event?.title ?? "Parada";
  const location = stop.place
    ? `${stop.place.town}${stop.place.state ? `, ${stop.place.state}` : ""}`
    : `${stop.event?.city ?? ""}${stop.event?.state ? `, ${stop.event.state}` : ""}`;
  const category = stop.place?.category ?? stop.event?.category ?? "";
  const image = stop.place?.photos?.[0] ?? stop.event?.image_url;

  // Detail link — only for persisted places/events
  const detailHref = stop.event
    ? `/evento/${stop.event.id}`
    : stop.place && !stop.place.id.startsWith("gen-")
    ? `/lugar/${stop.place.id}`
    : null;

  const cardStyle: React.CSSProperties = {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: "12px 0",
    borderBottom: "1px solid var(--border)",
    background: "none",
    border: "none",
    cursor: detailHref ? "pointer" : "default",
    textAlign: "left",
    width: "100%",
    borderRadius: isHighlighted ? "var(--r-md)" : 0,
    outline: isHighlighted ? `2px solid ${color}` : "none",
    outlineOffset: 2,
    transition: "outline 0.2s",
    textDecoration: "none",
    color: "inherit",
  };

  const inner = (
    <>
      {/* Order badge */}
      <div
        style={{
          flexShrink: 0,
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: color,
          color: "#fff",
          fontWeight: 700,
          fontSize: "0.78rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        {stop.order}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)" }}>{name}</span>
          {category && <span style={{ fontSize: "0.85rem" }}>{CAT_ICONS[category] ?? "📍"}</span>}
          {detailHref && (
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "auto" }}>
              Ver →
            </span>
          )}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>
          {stop.hora && <span style={{ color, fontWeight: 600, marginRight: 6 }}>{stop.hora}</span>}
          {location}
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
          {stop.razon}
        </div>
      </div>

      {/* Thumbnail */}
      {image && (
        <div
          style={{
            flexShrink: 0,
            width: 52,
            height: 52,
            borderRadius: "var(--r-sm)",
            overflow: "hidden",
            background: "var(--bg-muted)",
          }}
        >
          <img src={image} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
    </>
  );

  if (detailHref) {
    return (
      <Link href={detailHref} onClick={onHighlight} style={cardStyle}>
        {inner}
      </Link>
    );
  }

  return (
    <button onClick={onHighlight} style={cardStyle as React.CSSProperties}>
      {inner}
    </button>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────
export default function ItinerarioView({ ciudad }: { ciudad: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [activeDay, setActiveDay] = useState<"sabado" | "domingo">("sabado");
  const [highlighted, setHighlighted] = useState<number | undefined>();
  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    (async () => {
      try {
        const response = await fetch("/api/weekend-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ciudad }),
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
                setPlan({ ciudad: msg.ciudad, resumen: msg.resumen, sabado: msg.sabado, domingo: msg.domingo });
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

  // ── Loading state ───────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          gap: 24,
          padding: "0 32px",
          color: "var(--text-secondary)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <svg
            className="animate-spin"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--terracota)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ margin: "0 auto 12px" }}
          >
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
            Descubriendo <span style={{ color: "var(--terracota)" }}>{ciudad}</span>
          </p>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Esto puede tomar unos segundos
          </p>
        </div>

        {progressSteps.length > 0 && (
          <ProgressList steps={progressSteps} />
        )}
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          gap: 16,
          textAlign: "center",
          padding: "0 32px",
        }}
      >
        <span style={{ fontSize: "3rem" }}>😕</span>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>Algo salió mal</h2>
        <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          No pudimos generar el itinerario. Intenta de nuevo.
        </p>
        <Link
          href="/"
          style={{
            marginTop: 8,
            padding: "10px 24px",
            borderRadius: "var(--r-full)",
            background: "var(--terracota)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.9rem",
            textDecoration: "none",
          }}
        >
          Volver
        </Link>
      </div>
    );
  }

  // ── Ready state ─────────────────────────────────────────────────────────
  const activeDayStops = activeDay === "sabado" ? plan!.sabado : plan!.domingo;
  const allStops = [...(plan?.sabado ?? []), ...(plan?.domingo ?? [])];
  const color = activeDay === "sabado" ? "#C4622D" : "#2D7D62";
  const hasMap = activeDayStops.some(
    (s) => (s.place?.latitude && s.place.latitude !== 0) || s.event?.latitude != null
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Resumen */}
      {plan?.resumen && (
        <div
          style={{
            padding: "12px 20px",
            background: "var(--bg-subtle)",
            borderBottom: "1px solid var(--border)",
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            fontStyle: "italic",
          }}
        >
          {plan.resumen}
        </div>
      )}

      {/* Day tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
        {(["sabado", "domingo"] as const).map((day) => {
          const isActive = activeDay === day;
          const count = day === "sabado" ? plan!.sabado.length : plan!.domingo.length;
          const dayColor = day === "sabado" ? "#C4622D" : "#2D7D62";
          return (
            <button
              key={day}
              onClick={() => { setActiveDay(day); setHighlighted(undefined); }}
              style={{
                flex: 1,
                padding: "12px 0",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: isActive ? 700 : 500,
                fontSize: "0.88rem",
                color: isActive ? dayColor : "var(--text-muted)",
                borderBottom: isActive ? `2.5px solid ${dayColor}` : "2.5px solid transparent",
                transition: "all 0.2s",
              }}
            >
              {day === "sabado" ? "Sábado" : "Domingo"}{" "}
              <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Split view: list + map */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* Stop list */}
        <div style={{ width: hasMap ? "45%" : "100%", overflowY: "auto", padding: "0 16px" }}>
          {activeDayStops.length === 0 ? (
            <p style={{ padding: "24px 0", color: "var(--text-muted)", fontSize: "0.88rem", textAlign: "center" }}>
              Sin paradas para este día
            </p>
          ) : (
            activeDayStops.map((stop) => (
              <StopCard
                key={stop.order}
                stop={stop}
                isHighlighted={highlighted === stop.order}
                onHighlight={() => setHighlighted(highlighted === stop.order ? undefined : stop.order)}
                color={color}
              />
            ))
          )}
        </div>

        {/* Map */}
        {hasMap && (
          <div style={{ flex: 1, borderLeft: "1px solid var(--border)" }}>
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
  );
}
