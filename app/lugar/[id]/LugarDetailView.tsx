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
  const [errorToast, setErrorToast] = useState(false);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");
  const [showAuthGate, setShowAuthGate] = useState(false);

  // Close modals on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showRouteModal) setShowRouteModal(false);
        if (showAuthGate) setShowAuthGate(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showRouteModal, showAuthGate]);

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
    let success = true;
    if (user) {
      try {
        const headers = await getApiAuthHeader();
        const res = await fetch(`/api/routes/${routeId}`, { headers });
        if (res.ok) {
          const { route: current } = await res.json();
          const stops = current?.stops ?? [];
          const alreadyExists = stops.some((s: any) => (s.place?.id ?? s.event?.id ?? s.event?.slug) === place.id);
          if (!alreadyExists) {
            const newStops = [...stops, { type: "place", place, order_index: stops.length }];
            const patchRes = await fetch(`/api/routes/${routeId}`, {
              method: "PATCH",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({ stops: newStops }),
            });
            if (!patchRes.ok) success = false;
          }
        } else {
          success = false;
        }
      } catch {
        success = false;
      }
    } else {
      addPlaceToRoute(routeId, place);
    }
    if (success) {
      setAddedToRoute(routeId);
      setTimeout(() => {
        setShowRouteModal(false);
        setAddedToRoute(null);
        setToast(true);
      }, 700);
    } else {
      setShowRouteModal(false);
      setErrorToast(true);
    }
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
    const tempId = `r_${Date.now()}`;
    if (user) {
      try {
        const headers = await getApiAuthHeader();
        const res = await fetch("/api/routes", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id: tempId, name: newRouteName.trim(), description: "", stops: [], created_at: new Date().toISOString() }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("[routes] Create route failed:", err);
        }
      } catch (err) {
        console.error("[routes] Create route error:", err);
      }
      handleAddToRoute(tempId);
    } else {
      const route = createRoute(newRouteName.trim());
      handleAddToRoute(route.id);
    }
    setIsCreatingRoute(false);
    setNewRouteName("");
  }, [handleAddToRoute, newRouteName, user]);

  return (
    <main style={{ minHeight: "100dvh", background: "var(--surface)", paddingTop: "calc(var(--topbar-h) + var(--safe-top))" }}>

      {/* ── Gallery ───────────────────────── */}
      <div className="relative overflow-hidden" style={{ height: "44dvh", minHeight: 260, maxHeight: 420 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={photoIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: place.photos.length > 0
                ? `url(${place.photos[photoIdx]})`
                : undefined,
              background: place.photos.length === 0
                ? "linear-gradient(135deg, var(--dark) 0%, #2D4A3E 50%, var(--terracota) 100%)"
                : undefined,
            }}
          >
            {place.photos.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span style={{ fontSize: "3rem", opacity: 0.6 }}>{category?.icon ?? "📍"}</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.08) 40%, transparent 70%)" }} />

        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 flex items-center justify-center rounded-full"
          style={{ width: 44, height: 44, background: "rgba(255,255,255,0.2)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
          aria-label="Regresar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <span
          className="cat-badge absolute top-4 right-4 z-10"
          style={{ background: `${category?.color ?? "#9B9088"}CC` }}
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
                style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <span
                  className="block rounded-full transition-all"
                  style={{
                    width: i === photoIdx ? 22 : 6,
                    height: 6,
                    background: i === photoIdx ? "white" : "rgba(255,255,255,0.45)",
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content — "Discovery Overlap" card effect ───── */}
      <motion.div
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.08 }}
        className="relative px-5 -mt-6"
        style={{ paddingBottom: "calc(var(--bottomnav-h) + var(--safe-bottom) + 96px)" }}
      >
        {/* Main card overlapping the image */}
        <div
          className="rounded-3xl px-6 pt-6 pb-5 mb-6"
          style={{
            background: "var(--surface-container-lowest)",
            boxShadow: "var(--shadow-popup)",
          }}
        >
          <p className="label-sm" style={{ color: "var(--primary)", marginBottom: 8 }}>
            {category?.icon} {category?.name}
          </p>
          <h1
            className="display-md"
            style={{ marginBottom: 6, fontSize: "1.6rem" }}
          >
            {place.name}
          </h1>
          <p className="flex items-center gap-1.5 text-sm mb-5" style={{ color: "var(--text-muted)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--tertiary)" stroke="none">
              <path d="M12 2C9.24 2 7 4.24 7 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
            </svg>
            {place.town}, {place.state}
          </p>

          <div className="mexican-stripe rounded-full mb-5" style={{ width: 48, opacity: 0.7 }} />

          <p className="body-lg mb-5">
            {place.description}
          </p>

          <div className="flex flex-wrap gap-2">
            {place.tags.map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>

        {/* Location section */}
        <div
          className="rounded-2xl px-5 py-4 mb-4"
          style={{ background: "var(--surface-container-low)" }}
        >
          <p className="label-sm mb-3">Ubicación</p>
          <p className="font-semibold text-sm" style={{ color: "var(--on-surface)" }}>{place.town}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{place.state}, México</p>
          <p className="text-xs mt-1 font-mono" style={{ color: "var(--text-muted)" }}>
            {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
          </p>
        </div>

        {/* Map link */}
        <div style={{ marginBottom: 16 }}>
          <p className="label-sm mb-3">Ver en mapa</p>
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
                className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all"
                style={{
                  background: "var(--surface-container-lowest)",
                  boxShadow: "var(--shadow-card)",
                  textDecoration: "none",
                }}
              >
                <div style={{
                  flexShrink: 0, width: 40, height: 40, borderRadius: "var(--r-md)",
                  background: "var(--surface-container-low)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--primary)",
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C9.24 2 7 4.24 7 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
                    <circle cx="12" cy="7" r="2" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--on-surface)", marginBottom: 2 }}>
                    Google Maps
                  </div>
                  <div style={{ fontSize: "0.73rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {label}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </a>
            );
          })()}
        </div>

        {/* Data source */}
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
            const parts = place.id.split("-");
            const osmType = parts[1] ?? "node";
            const osmId = parts[2] ?? "";
            sourceHref = `https://www.openstreetmap.org/${osmType}/${osmId}`;
            sourceName = "OpenStreetMap";
            sourceLabel = "Datos geográficos colaborativos";
          }

          return (
            <div style={{ marginBottom: 16 }}>
              <p className="label-sm mb-3">Fuente de datos</p>
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all"
                style={{
                  background: "var(--surface-container-lowest)",
                  boxShadow: "var(--shadow-card)",
                  textDecoration: "none",
                }}
              >
                <div style={{
                  flexShrink: 0, width: 40, height: 40, borderRadius: "var(--r-md)",
                  background: "var(--tertiary-container)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--tertiary)", fontWeight: 700, fontSize: "0.8rem",
                }}>
                  ✓
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--on-surface)", marginBottom: 2 }}>
                    {sourceName}
                  </div>
                  <div style={{ fontSize: "0.73rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {sourceLabel}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
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
              <span style={{ color: "var(--primary)", fontWeight: 600 }}>Reclamarlo →</span>
            </Link>
          </div>
        )}
      </motion.div>

      {/* ── Sticky CTA — Gradient pill ────────────────────── */}
      <div
        className="fixed left-0 right-0 z-30 px-5 py-3"
        style={{
          bottom: "calc(var(--bottomnav-h) + var(--safe-bottom))",
          background: "linear-gradient(to top, var(--surface) 85%, transparent)",
          paddingTop: 24,
          paddingBottom: 14,
        }}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowRouteModal(true)}
          className="btn-primary"
          style={{ height: 54 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C9.24 2 7 4.24 7 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
            <circle cx="12" cy="7" r="2" fill="currentColor" stroke="none" />
          </svg>
          Agregar a ruta
        </motion.button>
      </div>

      {/* ── Route modal ───────────────────── */}
      <AnimatePresence>
        {showRouteModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRouteModal(false)}
              className="fixed inset-0 z-50"
              style={{ background: "var(--on-surface)" }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Agregar a ruta"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="fixed left-0 right-0 z-50 px-5 pt-5 pb-8"
              style={{
                bottom: "var(--bottomnav-h)",
                background: "var(--surface-container-lowest)",
                borderRadius: "var(--r-xl) var(--r-xl) 0 0",
                boxShadow: "var(--shadow-sheet)",
              }}
            >
              <div className="w-9 h-1 rounded-full mx-auto mb-5"
                style={{ background: "var(--outline)" }} />
              <h2 className="headline-md mb-5">
                Agregar a ruta
              </h2>

              {isCreatingRoute ? (
                <div className="mb-5">
                  <input
                    type="text"
                    placeholder="Nombre de la ruta..."
                    value={newRouteName}
                    onChange={(e) => setNewRouteName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNewRoute()}
                    className="w-full rounded-2xl px-4 text-sm outline-none mb-3"
                    style={{
                      height: 48,
                      background: "var(--surface-container-low)",
                      color: "var(--on-surface)",
                      border: "none",
                      boxShadow: newRouteName ? "0 0 0 2px var(--primary)" : "none",
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsCreatingRoute(false)}
                      className="btn-secondary flex-1"
                      style={{ height: 44 }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleNewRoute}
                      disabled={!newRouteName.trim()}
                      className="flex-1 rounded-full font-semibold text-white text-sm"
                      style={{
                        height: 44,
                        background: newRouteName.trim()
                          ? "linear-gradient(135deg, var(--secondary), #2a8a70)"
                          : "var(--surface-container-high)",
                        color: newRouteName.trim() ? "white" : "var(--text-muted)",
                        border: "none",
                        cursor: newRouteName.trim() ? "pointer" : "not-allowed",
                      }}
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
                  className="w-full mb-5 py-3.5 rounded-full font-semibold text-white text-sm"
                  style={{
                    background: "linear-gradient(135deg, var(--secondary), #2a8a70)",
                    minHeight: 48,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(26,92,82,0.2)",
                  }}
                >
                  + Nueva ruta
                </button>
              )}

              {routes.length > 0 && (
                <>
                  <p className="label-sm mb-3">Mis rutas</p>
                  <div className="flex flex-col gap-2.5 max-h-52 overflow-y-auto">
                    {routes.map((route) => {
                      const done = addedToRoute === route.id;
                      return (
                        <motion.button
                          key={route.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleAddToRoute(route.id)}
                          className="flex items-center justify-between w-full px-4 rounded-2xl text-left transition-all"
                          style={{
                            minHeight: 56,
                            background: done
                              ? "linear-gradient(135deg, var(--secondary), #2a8a70)"
                              : "var(--surface-container-low)",
                            color: done ? "white" : "var(--on-surface)",
                            border: "none",
                            cursor: "pointer",
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
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthGate(false)}
              className="fixed inset-0 z-50"
              style={{ background: "var(--on-surface)" }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="fixed left-0 right-0 z-50 px-5 pt-6 pb-8"
              style={{
                bottom: "var(--bottomnav-h)",
                background: "var(--surface-container-lowest)",
                borderRadius: "var(--r-xl) var(--r-xl) 0 0",
                boxShadow: "var(--shadow-sheet)",
              }}
            >
              <div className="w-9 h-1 rounded-full mx-auto mb-5"
                style={{ background: "var(--outline)" }} />
              <div className="text-center mb-6">
                <p className="text-3xl mb-4">🗺️</p>
                <h2 className="headline-md mb-2">
                  Guarda tus rutas para siempre
                </h2>
                <p className="body-lg" style={{ fontSize: "0.88rem" }}>
                  Con una cuenta gratuita puedes crear rutas ilimitadas, sincronizar entre dispositivos y nunca perder tus planes de viaje.
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
                  style={{ color: "var(--primary)", textDecoration: "none" }}
                >
                  Inicia sesión
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Toast message="Lugar agregado a la ruta" show={toast} onHide={() => setToast(false)} />
      <Toast message="No se pudo agregar. Intenta de nuevo." type="error" show={errorToast} onHide={() => setErrorToast(false)} />
    </main>
  );
}
