"use client";
import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Route, RouteStop, getStopId, getStopImage, getStopName, getStopCategory } from "@/types";
import { getRoute } from "@/lib/routeStore";
import RouteBuilder from "@/components/route/RouteBuilder";
import { useAuth } from "@/components/auth/AuthProvider";
import { getApiAuthHeader } from "@/lib/apiAuth";
import { CATEGORIES } from "@/lib/data";

interface Props {
  params: Promise<{ id: string }>;
}

/** Guided steps for building a route */
const GUIDE_STEPS = [
  {
    icon: "📍",
    title: "Agrega lugares",
    description: "Explora y agrega al menos 2 paradas a tu ruta",
    cta: "Explorar lugares",
    href: "/explorar",
  },
  {
    icon: "🔄",
    title: "Ordena tu recorrido",
    description: "Arrastra las paradas para definir el orden de visita",
    cta: null,
    href: null,
  },
  {
    icon: "🗺️",
    title: "Listo para viajar",
    description: "Tu itinerario esta armado. Abre cada parada para ver como llegar",
    cta: null,
    href: null,
  },
];

function getActiveStep(stops: RouteStop[]): number {
  if (stops.length === 0) return 0;
  if (stops.length === 1) return 0; // Still needs more stops
  return 2; // Ready
}

export default function RutaDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (user) {
        try {
          const headers = await getApiAuthHeader();
          const res = await fetch(`/api/routes/${id}`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (data.route) { setRoute(data.route); setLoading(false); return; }
          }
        } catch { /* fall through to localStorage */ }
      }
      const r = getRoute(id);
      if (r) setRoute(r);
      setLoading(false);
    }
    load();
  }, [id, user]);

  const handleChange = useCallback(async (updated: Route) => {
    setRoute(updated);
    if (user) {
      try {
        const headers = await getApiAuthHeader();
        await fetch(`/api/routes/${updated.id}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ stops: updated.stops }),
        });
      } catch { /* non-fatal */ }
    }
  }, [user]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center"
        style={{ paddingTop: "var(--topbar-h)", background: "var(--surface)" }}>
        <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
      </main>
    );
  }

  if (!route) {
    return (
      <main className="min-h-screen flex items-center justify-center"
        style={{ paddingTop: "var(--topbar-h)", background: "var(--surface)" }}>
        <div className="text-center px-8">
          <p className="text-5xl mb-5">🗺️</p>
          <p className="headline-md mb-2">Ruta no encontrada</p>
          <button onClick={() => router.back()} className="text-sm font-semibold"
            style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}>
            ← Regresar
          </button>
        </div>
      </main>
    );
  }

  const activeStep = getActiveStep(route.stops);
  const categories = [...new Set(route.stops.map((s) => getStopCategory(s)))];

  return (
    <main style={{ minHeight: "100vh", background: "var(--surface)", paddingTop: "var(--topbar-h)" }}>

      {/* Header */}
      <div style={{ background: "var(--surface-container-low)", paddingBottom: 20 }}>
        <div className="px-5 pt-8 pb-2">
          <button
            onClick={() => router.back()}
            className="text-sm mb-4 flex items-center gap-1.5"
            style={{ color: "var(--text-muted)", minHeight: 32, background: "none", border: "none", cursor: "pointer" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Mis rutas
          </button>
          <p className="label-sm" style={{ color: "var(--primary)", marginBottom: 8 }}>
            Itinerario
          </p>
          <h1 className="display-md" style={{ marginBottom: 4 }}>
            {route.name}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p className="body-lg" style={{ fontSize: "0.88rem" }}>
              {route.stops.length} {route.stops.length === 1 ? "parada" : "paradas"}
            </p>
            {categories.length > 0 && (
              <div style={{ display: "flex", gap: 4 }}>
                {categories.slice(0, 5).map((catId) => {
                  const cat = CATEGORIES.find((c) => c.id === catId);
                  return cat ? <span key={catId} style={{ fontSize: "0.85rem" }} title={cat.name}>{cat.icon}</span> : null;
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className="px-4 pt-5"
        style={{ paddingBottom: "calc(var(--bottomnav-h) + var(--safe-bottom) + 24px)" }}
      >
        {/* ── Guided steps (visible when route has < 2 stops) ── */}
        {route.stops.length < 2 && (
          <div
            style={{
              background: "var(--surface-container-lowest)",
              borderRadius: "var(--r-lg)",
              padding: "20px",
              marginBottom: 20,
              boxShadow: "var(--shadow-card)",
            }}
          >
            <p style={{
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "var(--primary)",
              marginBottom: 14,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}>
              Arma tu ruta en 3 pasos
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {GUIDE_STEPS.map((step, i) => {
                const isDone = i < activeStep;
                const isCurrent = i === activeStep;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      opacity: isDone ? 0.5 : isCurrent ? 1 : 0.4,
                    }}
                  >
                    {/* Step indicator */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--r-full)",
                        background: isDone
                          ? "var(--secondary)"
                          : isCurrent
                            ? "linear-gradient(135deg, var(--primary), var(--primary-container))"
                            : "var(--surface-container-high)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: isDone ? "0.75rem" : "0.9rem",
                        color: isDone || isCurrent ? "#fff" : "var(--text-muted)",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {isDone ? "✓" : step.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{
                        fontWeight: 600,
                        fontSize: "0.88rem",
                        color: isCurrent ? "var(--on-surface)" : "var(--text-muted)",
                        marginBottom: 2,
                      }}>
                        {step.title}
                      </p>
                      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                        {step.description}
                      </p>
                      {isCurrent && step.cta && step.href && (
                        <Link
                          href={step.href}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 8,
                            padding: "8px 16px",
                            borderRadius: "var(--r-full)",
                            background: "linear-gradient(135deg, var(--primary), var(--primary-container))",
                            color: "#fff",
                            fontWeight: 600,
                            fontSize: "0.78rem",
                            textDecoration: "none",
                          }}
                        >
                          {step.cta} →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Stop thumbnails (horizontal strip) ── */}
        {route.stops.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-2.5 overflow-x-auto hide-scrollbar mb-5"
          >
            {route.stops.map((stop, i) => (
              <div key={getStopId(stop)} className="flex items-center gap-2 shrink-0">
                <div
                  className="w-10 h-10 rounded-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${getStopImage(stop)})`,
                    boxShadow: "var(--shadow-card)",
                  }}
                />
                {i < route.stops.length - 1 && (
                  <div className="w-5 h-px" style={{ background: "var(--outline)" }} />
                )}
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Drag & drop route builder ── */}
        <RouteBuilder route={route} onChange={handleChange} />

        {/* ── Logistics tip (shown when >= 2 stops) ── */}
        {route.stops.length >= 2 && (
          <div
            style={{
              background: "var(--surface-container-low)",
              borderRadius: "var(--r-lg)",
              padding: "16px 18px",
              marginTop: 16,
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: "1.2rem", flexShrink: 0, marginTop: 2 }}>💡</span>
            <div>
              <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--on-surface)", marginBottom: 4 }}>
                Tip de viaje
              </p>
              <p style={{ fontSize: "0.78rem", color: "var(--on-surface-variant)", lineHeight: 1.5 }}>
                Toca cada parada para ver su ubicacion en Google Maps. Te recomendamos ordenar las paradas por cercania para ahorrar tiempo en traslados.
              </p>
            </div>
          </div>
        )}

        {/* ── Bottom actions ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
          <Link
            href="/explorar"
            className="btn-ghost justify-center"
            style={{ textDecoration: "none", minHeight: 48 }}
          >
            + Agregar mas lugares
          </Link>

          {route.stops.length >= 2 && (
            <a
              href={`https://www.google.com/maps/dir/${route.stops
                .map((s) => {
                  const p = s.type === "place" ? s.place : s.event;
                  if (!p) return "";
                  const lat = (p as any).latitude;
                  const lng = (p as any).longitude;
                  if (lat && lng) return `${lat},${lng}`;
                  return encodeURIComponent((p as any).name ?? "");
                })
                .filter(Boolean)
                .join("/")}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                minHeight: 48,
                borderRadius: "var(--r-full)",
                background: "linear-gradient(135deg, var(--secondary), #2a8a70)",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.88rem",
                textDecoration: "none",
                boxShadow: "0 4px 16px rgba(26,92,82,0.2)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C9.24 2 7 4.24 7 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
                <circle cx="12" cy="7" r="2" fill="currentColor" stroke="none" />
              </svg>
              Abrir ruta en Google Maps
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
