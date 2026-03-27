"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Place, Route } from "@/types";
import { CATEGORIES } from "@/lib/data";
import { getRoutes, createRoute, addPlaceToRoute, canCreateRouteFree, canAddStopFree, FREE_STOPS_LIMIT } from "@/lib/routeStore";
import Toast from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { getApiAuthHeader } from "@/lib/apiAuth";

interface Props {
  place: Place;
}

export default function LugarDetailView({ place }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const category = CATEGORIES.find((c) => c.id === place.category);

  const [photoIdx, setPhotoIdx] = useState(0);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [addedToRoute, setAddedToRoute] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");
  const [showAuthGate, setShowAuthGate] = useState(false);

  useEffect(() => {
    if (!showRouteModal) return;
    async function load() {
      if (user) {
        try {
          const headers = await getApiAuthHeader();
          const res = await fetch("/api/routes", { headers });
          if (res.ok) { setRoutes((await res.json()).routes ?? []); return; }
        } catch { /* fall through */ }
      }
      setRoutes(getRoutes());
    }
    load();
  }, [showRouteModal, user]);

  const handleAddToRoute = useCallback(async (routeId: string) => {
    if (!user && !canAddStopFree(routeId)) {
      setShowRouteModal(false);
      setShowAuthGate(true);
      return;
    }
    const updated = addPlaceToRoute(routeId, place);
    if (user && updated) {
      try {
        const headers = await getApiAuthHeader();
        await fetch(`/api/routes/${routeId}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ stops: updated.stops }),
        });
      } catch { /* non-fatal */ }
    }
    setAddedToRoute(routeId);
    setTimeout(() => {
      setShowRouteModal(false);
      setAddedToRoute(null);
      setToast(true);
    }, 700);
  }, [place, user]);

  const handleNewRoute = useCallback(async () => {
    if (!newRouteName.trim()) return;
    if (!user && !canCreateRouteFree()) {
      setShowRouteModal(false);
      setIsCreatingRoute(false);
      setNewRouteName("");
      setShowAuthGate(true);
      return;
    }
    const route = createRoute(newRouteName.trim());
    if (user) {
      try {
        const headers = await getApiAuthHeader();
        await fetch("/api/routes", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id: route.id, name: route.name, description: route.description, stops: route.stops, created_at: route.created_at }),
        });
      } catch { /* non-fatal */ }
    }
    handleAddToRoute(route.id);
    setIsCreatingRoute(false);
    setNewRouteName("");
  }, [handleAddToRoute, newRouteName, user]);

  return (
    <main style={{ minHeight: "100dvh", background: "var(--bg)", paddingTop: "calc(var(--topbar-h) + var(--safe-top))" }}>

      {/* ── Galería ───────────────────────── */}
      <div className="relative overflow-hidden" style={{ height: "40dvh", minHeight: 250, maxHeight: 400 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={photoIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${place.photos[photoIdx]})` }}
          />
        </AnimatePresence>
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.08) 40%, transparent 70%)" }} />

        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 flex items-center justify-center rounded-full font-bold text-white"
          style={{ width: 44, height: 44, background: "rgba(0,0,0,0.38)", backdropFilter: "blur(6px)", fontSize: "1.1rem" }}
          aria-label="Regresar"
        >
          ←
        </button>

        <span
          className="cat-badge absolute top-4 right-4 z-10"
          style={{ background: `${category?.color}DD` }}
        >
          {category?.icon} {category?.name}
        </span>

        {place.photos.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
            {place.photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setPhotoIdx(i)}
                aria-label={`Foto ${i + 1}`}
                style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <span
                  className="block rounded-full transition-all"
                  style={{
                    width: i === photoIdx ? 20 : 6,
                    height: 6,
                    background: i === photoIdx ? "white" : "rgba(255,255,255,0.45)",
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Contenido ─────────────────────── */}
      <motion.div
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.08 }}
        className="px-5 pt-5"
        style={{ paddingBottom: "calc(var(--bottomnav-h) + var(--safe-bottom) + 88px)" }}
      >
        <h1
          className="font-bold mb-1"
          style={{ color: "var(--text)", fontFamily: "Playfair Display, serif", fontSize: "1.6rem", lineHeight: 1.2 }}
        >
          {place.name}
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          📍 {place.town}, {place.state}
        </p>

        <div className="mexican-stripe rounded-full mb-5" style={{ width: 40, opacity: 0.65 }} />

        <p className="leading-relaxed mb-5" style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          {place.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {place.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>

        <div
          className="rounded-xl px-4 py-3.5"
          style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
        >
          <p className="label-muted mb-2">Ubicación</p>
          <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{place.town}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{place.state}, México</p>
          <p className="text-xs mt-1 font-mono" style={{ color: "var(--text-muted)" }}>
            {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
          </p>
        </div>

        {/* ── Referencia ────────────────────── */}
        <div style={{ marginTop: 16 }}>
          <p className="label-muted mb-2">Ver en mapa</p>
          {(() => {
            const hasCoords = place.latitude !== 0 && place.longitude !== 0;
            const mapsUrl = hasCoords
              ? `https://maps.google.com/?q=${place.latitude},${place.longitude}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.town}, ${place.state}`)}`;
            const label = hasCoords ? `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}` : `${place.name}, ${place.town}`;
            return (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: "var(--r-lg)",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  textDecoration: "none",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--terracota)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-subtle)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg)";
                }}
              >
                <div style={{
                  flexShrink: 0, width: 36, height: 36, borderRadius: "var(--r-sm)",
                  background: "var(--bg-subtle)", border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--terracota)",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C9.24 2 7 4.24 7 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
                    <circle cx="12" cy="7" r="2" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                    Google Maps
                  </div>
                  <div style={{ fontSize: "0.73rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {label}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </a>
            );
          })()}
        </div>

        {/* ── Fuente ─────────────────────────── */}
        {(() => {
          const isDENUE = place.id.startsWith("denue-");
          const isOSM = place.id.startsWith("osm-");
          if (!isDENUE && !isOSM) return null;

          let sourceHref = "";
          let sourceName = "";
          let sourceLabel = "";

          if (isDENUE) {
            const denueId = place.id.replace("denue-", "");
            sourceHref = `https://www.inegi.org.mx/app/mapa/denue/?cp=${denueId}`;
            sourceName = "INEGI / DENUE";
            sourceLabel = "Directorio Nacional de Unidades Económicas";
          } else {
            // osm-node-12345 or osm-way-12345
            const parts = place.id.split("-"); // ["osm","node","12345"]
            const osmType = parts[1] ?? "node";
            const osmId = parts[2] ?? "";
            sourceHref = `https://www.openstreetmap.org/${osmType}/${osmId}`;
            sourceName = "OpenStreetMap";
            sourceLabel = "Datos geográficos colaborativos";
          }

          return (
            <div style={{ marginTop: 16 }}>
              <p className="label-muted mb-2">Fuente de datos</p>
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: "var(--r-lg)",
                  border: "1px solid var(--border)", background: "var(--bg)",
                  textDecoration: "none", transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--jade)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-subtle)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg)";
                }}
              >
                <div style={{
                  flexShrink: 0, width: 36, height: 36, borderRadius: "var(--r-sm)",
                  background: "#2D7D6215", border: "1px solid #2D7D6230",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#2D7D62", fontWeight: 700, fontSize: "0.7rem",
                }}>
                  ✓
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                    {sourceName}
                  </div>
                  <div style={{ fontSize: "0.73rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {sourceLabel}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </a>
            </div>
          );
        })()}

        {user && (
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <Link
              href={`/contribuir/reclamar/place/${place.id}`}
              style={{ fontSize: "0.825rem", color: "var(--text-muted)", textDecoration: "none" }}
            >
              ¿Es tuyo este lugar?{" "}
              <span style={{ color: "var(--terracota)", fontWeight: 600 }}>Reclamarlo →</span>
            </Link>
          </div>
        )}
      </motion.div>

      {/* ── Sticky CTA ────────────────────── */}
      <div
        className="fixed left-0 right-0 z-30 px-5 py-3"
        style={{
          bottom: "calc(var(--bottomnav-h) + var(--safe-bottom))",
          background: "linear-gradient(to top, white 85%, transparent)",
          paddingTop: 20,
          paddingBottom: 12
        }}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowRouteModal(true)}
          className="btn-primary"
        >
          📍 Agregar a ruta
        </motion.button>
      </div>

      {/* ── Modal rutas ───────────────────── */}
      <AnimatePresence>
        {showRouteModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRouteModal(false)}
              className="fixed inset-0 bg-black z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="fixed left-0 right-0 z-50 px-5 pt-4 pb-8"
              style={{
                bottom: "var(--bottomnav-h)",
                background: "white",
                borderRadius: "var(--r-xl) var(--r-xl) 0 0",
                borderTop: "1px solid var(--border)",
                boxShadow: "var(--shadow-sheet)",
              }}
            >
              <div className="w-8 h-1 rounded-full mx-auto mb-4"
                style={{ background: "var(--border-strong)" }} />
              <h2
                className="font-bold mb-4"
                style={{ color: "var(--text)", fontFamily: "Playfair Display, serif", fontSize: "1.2rem" }}
              >
                Agregar a ruta
              </h2>

              {isCreatingRoute ? (
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Nombre de la ruta..."
                    value={newRouteName}
                    onChange={(e) => setNewRouteName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNewRoute()}
                    className="w-full rounded-xl px-4 text-sm outline-none mb-2"
                    style={{
                      height: 44,
                      border: `1.5px solid ${newRouteName ? "var(--terracota)" : "var(--border)"}`,
                      background: "var(--bg-subtle)",
                      color: "var(--text)",
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsCreatingRoute(false)}
                      className="flex-1 py-2 rounded-xl font-semibold text-sm"
                      style={{ background: "var(--bg-muted)", color: "var(--text-secondary)" }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleNewRoute}
                      disabled={!newRouteName.trim()}
                      className="flex-1 py-2 rounded-xl font-semibold text-white text-sm"
                      style={{ background: "var(--jade)", opacity: newRouteName.trim() ? 1 : 0.6 }}
                    >
                      Crear
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (!user && !canCreateRouteFree()) {
                      setShowRouteModal(false);
                      setShowAuthGate(true);
                      return;
                    }
                    setIsCreatingRoute(true);
                  }}
                  className="w-full mb-4 py-3 rounded-xl font-semibold text-white text-sm"
                  style={{ background: "var(--jade)", minHeight: 44 }}
                >
                  + Nueva ruta
                </button>
              )}

              {routes.length > 0 && (
                <>
                  <p className="label-muted mb-2">Mis rutas</p>
                  <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                    {routes.map((route) => {
                      const done = addedToRoute === route.id;
                      return (
                        <motion.button
                          key={route.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleAddToRoute(route.id)}
                          className="flex items-center justify-between w-full px-4 rounded-xl border text-left transition-colors"
                          style={{
                            minHeight: 52,
                            borderColor: done ? "var(--jade)" : "var(--border)",
                            background: done ? "var(--jade)" : "var(--bg-subtle)",
                            color: done ? "white" : "var(--text)",
                          }}
                        >
                          <div>
                            <p className="font-semibold text-sm">{route.name}</p>
                            <p className="text-xs mt-0.5" style={{ opacity: 0.6 }}>
                              {route.stops.length} paradas
                            </p>
                          </div>
                          {done && <span className="font-bold">✓</span>}
                        </motion.button>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Auth gate modal ────────────── */}
      <AnimatePresence>
        {showAuthGate && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthGate(false)}
              className="fixed inset-0 bg-black z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="fixed left-0 right-0 z-50 px-5 pt-5 pb-8"
              style={{
                bottom: "var(--bottomnav-h)",
                background: "white",
                borderRadius: "var(--r-xl) var(--r-xl) 0 0",
                borderTop: "1px solid var(--border)",
                boxShadow: "var(--shadow-sheet)",
              }}
            >
              <div className="w-8 h-1 rounded-full mx-auto mb-4"
                style={{ background: "var(--border-strong)" }} />
              <div className="text-center mb-5">
                <p className="text-3xl mb-3">🗺️</p>
                <h2
                  className="font-bold mb-2"
                  style={{ color: "var(--text)", fontFamily: "Playfair Display, serif", fontSize: "1.2rem" }}
                >
                  Crea tu cuenta para seguir armando rutas
                </h2>
                <p className="text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Sin cuenta puedes guardar hasta {FREE_STOPS_LIMIT} paradas en una ruta.
                  Regístrate para crear rutas ilimitadas y no perderlas.
                </p>
              </div>
              <Link
                href="/auth/registro"
                className="btn-primary block text-center mb-3"
                style={{ textDecoration: "none" }}
              >
                Crear cuenta gratis
              </Link>
              <div className="flex items-center justify-center gap-1">
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>¿Ya tienes cuenta?</span>
                <Link
                  href="/auth/login"
                  className="text-sm font-semibold"
                  style={{ color: "var(--terracota)", textDecoration: "none" }}
                >
                  Inicia sesión
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Toast message="Lugar agregado a la ruta" show={toast} onHide={() => setToast(false)} />
    </main>
  );
}
