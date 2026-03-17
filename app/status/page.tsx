"use client";

import { useEffect, useState, useCallback } from "react";

type ServiceResult = {
  ok: boolean;
  message: string;
  latency?: number;
  places?: number;
  events?: number;
  sources?: number;
  jobs?: number;
};

type StatusData = {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  services: {
    postgres: ServiceResult;
    supabase: ServiceResult;
    mapbox: ServiceResult;
    scraping: ServiceResult;
  };
};

function StatusBadge({ status }: { status: "ok" | "degraded" | "error" }) {
  const map = {
    ok: { label: "Operacional", bg: "#d1fae5", color: "#065f46", dot: "#10b981" },
    degraded: { label: "Degradado", bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
    error: { label: "Error", bg: "#fee2e2", color: "#991b1b", dot: "#ef4444" },
  };
  const s = map[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: "var(--r-full)",
        background: s.bg,
        color: s.color,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: s.dot,
          display: "inline-block",
          ...(status === "ok" ? { boxShadow: `0 0 0 3px ${s.dot}33` } : {}),
        }}
      />
      {s.label}
    </span>
  );
}

function ServiceCard({ name, result }: { name: string; result: ServiceResult }) {
  const details: string[] = [];
  if (result.latency !== undefined) details.push(`${result.latency}ms`);
  if (result.places !== undefined) details.push(`${result.places} lugares`);
  if (result.events !== undefined) details.push(`${result.events} eventos`);
  if (result.sources !== undefined) details.push(`${result.sources} fuentes`);
  if (result.jobs !== undefined) details.push(`${result.jobs} jobs`);

  return (
    <div
      style={{
        background: "var(--bg)",
        border: `1px solid ${result.ok ? "var(--border)" : "#fca5a5"}`,
        borderRadius: "var(--r-md)",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: result.ok ? "#10b981" : "#ef4444",
          flexShrink: 0,
          boxShadow: result.ok ? "0 0 0 3px #10b98133" : "0 0 0 3px #ef444433",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 15 }}>{name}</div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
          {result.message}
          {details.length > 0 && (
            <span style={{ marginLeft: 8, color: "var(--text-secondary)" }}>
              · {details.join(" · ")}
            </span>
          )}
        </div>
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: result.ok ? "#065f46" : "#991b1b",
          background: result.ok ? "#d1fae5" : "#fee2e2",
          padding: "2px 10px",
          borderRadius: "var(--r-full)",
          flexShrink: 0,
        }}
      >
        {result.ok ? "OK" : "Error"}
      </span>
    </div>
  );
}

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/status");
      const json = await res.json();
      setData(json);
      setLastCheck(new Date());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const services = data
    ? [
        { name: "PostgreSQL (local)", result: data.services.postgres },
        { name: "Supabase", result: data.services.supabase },
        { name: "Mapbox", result: data.services.mapbox },
        { name: "Scraping", result: data.services.scraping },
      ]
    : [];

  return (
    <div
      style={{
        paddingTop: "calc(var(--topbar-h) + 24px)",
        paddingBottom: "calc(var(--bottomnav-h) + 24px)",
        minHeight: "100dvh",
        background: "var(--bg-subtle)",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
              Estado del sistema
            </h1>
            {data && <StatusBadge status={data.status} />}
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
            Verifica que todos los servicios estén funcionando correctamente.
          </p>
        </div>

        {/* Services */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {loading && !data
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 68,
                    borderRadius: "var(--r-md)",
                    background: "var(--bg-muted)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
              ))
            : services.map((s) => (
                <ServiceCard key={s.name} name={s.name} result={s.result} />
              ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {lastCheck
              ? `Verificado ${lastCheck.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : loading
              ? "Verificando…"
              : ""}
          </span>
          <button
            onClick={check}
            disabled={loading}
            className="btn-ghost"
            style={{ fontSize: 14, opacity: loading ? 0.5 : 1 }}
          >
            {loading ? "Verificando…" : "Actualizar"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
