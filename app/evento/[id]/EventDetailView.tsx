"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Event } from "@/types/events";
import { Route } from "@/types";
import { CATEGORIES } from "@/lib/data";
import { getRoutes, createRoute, addEventToRoute } from "@/lib/routeStore";
import Toast from "@/components/ui/Toast";

interface Props {
  event: Event;
}

function safeHostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso.split("T")[0];
  }
}

export default function EventDetailView({ event }: Props) {
  const router = useRouter();
  const cat = CATEGORIES.find((c) => c.id === event.category);

  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [addedToRoute, setAddedToRoute] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");

  useEffect(() => { setRoutes(getRoutes()); }, [showRouteModal]);

  // Close modal on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && showRouteModal) setShowRouteModal(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showRouteModal]);

  const handleAddToRoute = useCallback((routeId: string) => {
    addEventToRoute(routeId, event);
    setAddedToRoute(routeId);
    setTimeout(() => {
      setShowRouteModal(false);
      setAddedToRoute(null);
      setToast(true);
    }, 700);
  }, [event]);

  const handleNewRoute = useCallback(() => {
    if (!newRouteName.trim()) return;
    const route = createRoute(newRouteName.trim());
    handleAddToRoute(route.id);
    setIsCreatingRoute(false);
    setNewRouteName("");
  }, [handleAddToRoute, newRouteName]);

  const location = [event.venue_name, event.city, event.state].filter(Boolean).join(", ");
  const bodyText = event.description?.trim() || event.short_description?.trim() || "";

  return (
    <main style={{ minHeight: "100dvh", background: "var(--bg)", paddingTop: "calc(var(--topbar-h) + var(--safe-top))" }}>

      {/* ── Hero image ──────────────────────── */}
      <div className="relative overflow-hidden" style={{ height: "40dvh", minHeight: 250, maxHeight: 400 }}>
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-8xl"
            style={{ background: `${cat?.color ?? "var(--maiz)"}22` }}
          >
            {cat?.icon ?? "📅"}
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.06) 40%, transparent 70%)" }}
        />

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
          style={{ background: `${cat?.color ?? "#E8B84B"}DD` }}
        >
          {cat?.icon ?? "📅"} {cat?.name ?? "Evento"}
        </span>
      </div>

      {/* ── Content ─────────────────────────── */}
      <motion.div
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.08 }}
        className="px-5 pt-5"
        style={{ paddingBottom: "calc(var(--bottomnav-h) + var(--safe-bottom) + 100px)" }}
      >
        <h1
          className="font-bold mb-2"
          style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, system-ui, sans-serif", fontSize: "1.6rem", lineHeight: 1.2 }}
        >
          {event.title}
        </h1>

        <p className="text-sm mb-1 font-medium" style={{ color: "var(--maiz)" }}>
          📅 {formatDate(event.start_date)}
          {event.time_text && ` · ${event.time_text}`}
        </p>

        {location && (
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            📍 {location}
          </p>
        )}

        <div className="mexican-stripe rounded-full mb-5" style={{ width: 40, opacity: 0.65 }} />

        {bodyText && (
          <p className="leading-relaxed mb-5" style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            {bodyText}
          </p>
        )}

        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {event.tags.map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        )}

        <div
          className="rounded-xl px-4 py-3.5 mb-4"
          style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <p className="label-muted">Precio</p>
            {event.is_free ? (
              <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "var(--jade)18", color: "var(--jade)" }}>
                Gratis
              </span>
            ) : (
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                {event.price_text || "Consultar"}
              </p>
            )}
          </div>
        </div>

        {/* ── Referencia ────────────────────── */}
        {event.source_url && (
          <div style={{ marginBottom: 8 }}>
            <p className="label-muted mb-2">Fuente oficial</p>
            <a
              href={event.source_url}
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
                background: "var(--bg-subtle)", border: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--jade)",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                  {event.source_name || safeHostname(event.source_url)}
                </div>
                <div style={{ fontSize: "0.73rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {safeHostname(event.source_url)}
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </a>
          </div>
        )}
      </motion.div>

      {/* ── Sticky CTA — two buttons ─────────── */}
      <div
        className="fixed left-0 right-0 z-30 px-5 py-3 flex gap-3"
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
          className="py-3 rounded-xl font-semibold text-sm"
          style={{
            flex: event.source_url ? 1 : undefined,
            width: event.source_url ? undefined : "100%",
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            minHeight: 44,
          }}
        >
          📍 Agregar a ruta
        </motion.button>
        {event.source_url && (
          <a
            href={event.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 btn-primary block text-center"
            style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            Ver evento →
          </a>
        )}
      </div>

      {/* ── Route modal ─────────────────────── */}
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
              role="dialog"
              aria-modal="true"
              aria-label="Agregar a ruta"
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
              <div className="w-8 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--border-strong)" }} />
              <h2
                className="font-bold mb-4"
                style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, system-ui, sans-serif", fontSize: "1.2rem" }}
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
                  onClick={() => setIsCreatingRoute(true)}
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

      <Toast message="Evento agregado a la ruta" show={toast} onHide={() => setToast(false)} />
    </main>
  );
}
