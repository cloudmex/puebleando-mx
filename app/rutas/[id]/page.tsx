"use client";
import { use, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Route, RouteStop, getStopId, getStopImage, getStopName, getStopCategory } from "@/types";
import { getRoute } from "@/lib/routeStore";
import RouteBuilder from "@/components/route/RouteBuilder";
import { useAuth } from "@/components/auth/AuthProvider";
import { getApiAuthHeader } from "@/lib/apiAuth";
import { CATEGORIES } from "@/lib/data";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

/** Build a Mapbox Static Image URL for the route cover */
function buildCoverUrl(route: Route): string | null {
  if (!MAPBOX_TOKEN) return null;
  const stops = route.stops;

  if (stops.length === 0) return null;

  // Collect coordinates from stops
  const coords = stops
    .map((s) => {
      const item = s.type === "place" ? s.place : s.event;
      if (!item) return null;
      const lat = (item as any).latitude;
      const lng = (item as any).longitude;
      if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;
      return { lat, lng };
    })
    .filter(Boolean) as { lat: number; lng: number }[];

  if (coords.length === 0) return null;

  // Build pin markers
  const pins = coords
    .map((c, i) => `pin-l-${i + 1}+C4622D(${c.lng},${c.lat})`)
    .join(",");

  // If single point, center on it; otherwise auto-fit
  if (coords.length === 1) {
    return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${pins}/${coords[0].lng},${coords[0].lat},11,0/800x300@2x?access_token=${MAPBOX_TOKEN}&attribution=false&logo=false`;
  }

  return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${pins}/auto/800x300@2x?padding=60&access_token=${MAPBOX_TOKEN}&attribution=false&logo=false`;
}

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
    title: "Agrega otra parada",
    description: "Necesitas al menos 2 paradas para armar tu recorrido",
    cta: "Explorar lugares",
    href: "/explorar",
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
  if (stops.length === 0) return 0;  // Need to add places
  if (stops.length === 1) return 1;  // Need at least one more + reorder
  return 2; // Ready to go
}

export default function RutaDetailPage({ params }: Props) {
  const { id } = use(params);
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
          <Link href="/rutas" className="text-sm font-semibold"
            style={{ color: "var(--primary)", textDecoration: "none" }}>
            ← Mis rutas
          </Link>
        </div>
      </main>
    );
  }

  const activeStep = getActiveStep(route.stops);
  const categories = [...new Set(route.stops.map((s) => getStopCategory(s)))];
  const coverUrl = buildCoverUrl(route);

  return (
    <main style={{ minHeight: "100vh", background: "var(--surface)", paddingTop: "var(--topbar-h)" }}>

      {/* Header with cover image */}
      <div style={{ position: "relative" }}>
        {/* Cover image (map or gradient fallback) */}
        <div
          style={{
            height: coverUrl ? 200 : 120,
            backgroundImage: coverUrl
              ? `url(${coverUrl})`
              : "linear-gradient(135deg, var(--dark) 0%, #2D4A3E 50%, var(--terracota) 100%)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            position: "relative",
          }}
        >
          {/* Gradient overlay for text readability */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: coverUrl
                ? "linear-gradient(to top, rgba(26,20,16,0.85) 0%, rgba(26,20,16,0.3) 50%, rgba(0,0,0,0.1) 100%)"
                : "linear-gradient(to top, rgba(26,20,16,0.7) 0%, transparent 100%)",
            }}
          />

          {/* Back button */}
          <Link
            href="/rutas"
            className="absolute top-4 left-4 z-10 flex items-center gap-1.5 text-sm"
            style={{
              color: "white",
              minHeight: 36,
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              textDecoration: "none",
              borderRadius: "var(--r-full)",
              padding: "0 14px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Mis rutas
          </Link>

          {/* Route info overlaid on cover */}
          <div
            className="absolute bottom-0 left-0 right-0 px-5 pb-4"
            style={{ zIndex: 5 }}
          >
            <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--maiz)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
              Itinerario
            </p>
            <h1
              className="display-md"
              style={{ color: "white", marginBottom: 4, textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
            >
              {route.name}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.8)" }}>
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
            <>
              {/* Pueblear con chofer CTA */}
              <Link
                href={`/choferes?ruta=${route.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  minHeight: 52,
                  borderRadius: "var(--r-full)",
                  background: "linear-gradient(135deg, var(--primary), var(--primary-container))",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.93rem",
                  textDecoration: "none",
                  boxShadow: "0 6px 20px rgba(156,61,42,0.25)",
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>🚗</span>
                Pueblear con chofer personal
              </Link>

              <a
                href={`https://www.google.com/maps/dir/${route.stops
                  .map((s) => {
                    const p = s.type === "place" ? s.place : s.event;
                    if (!p) return "";
                    const lat = (p as any).latitude;
                    const lng = (p as any).longitude;
                    if (lat != null && lng != null) return `${lat},${lng}`;
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
            </>
          )}
        </div>
      </div>
    </main>
  );
}
