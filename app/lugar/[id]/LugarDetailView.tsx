"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Place, Route } from "@/types";
import { CATEGORIES } from "@/lib/data";
import { getRoutes, createRoute, addPlaceToRoute } from "@/lib/routeStore";
import Toast from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";

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

  useEffect(() => { setRoutes(getRoutes()); }, [showRouteModal]);

  const handleAddToRoute = useCallback((routeId: string) => {
    addPlaceToRoute(routeId, place);
    setAddedToRoute(routeId);
    setTimeout(() => {
      setShowRouteModal(false);
      setAddedToRoute(null);
      setToast(true);
    }, 700);
  }, [place]);

  const handleNewRoute = useCallback(() => {
    if (!newRouteName.trim()) return;
    const route = createRoute(newRouteName.trim());
    handleAddToRoute(route.id);
    setIsCreatingRoute(false);
    setNewRouteName("");
  }, [handleAddToRoute, newRouteName]);

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

      <Toast message="Lugar agregado a la ruta" show={toast} onHide={() => setToast(false)} />
    </main>
  );
}
