"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Route } from "@/types";
import { getRoutes, createRoute, deleteRoute } from "@/lib/routeStore";
import { CATEGORIES } from "@/lib/data";

export default function RutasPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => { setRoutes(getRoutes()); }, []);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createRoute(newName.trim());
    setRoutes(getRoutes());
    setNewName("");
    setShowNew(false);
  };

  const handleConfirmDelete = (id: string) => {
    deleteRoute(id);
    setRoutes(getRoutes());
    setPendingDelete(null);
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", paddingTop: "var(--topbar-h)" }}>

      {/* Header */}
      <div style={{ background: "var(--dark)" }}>
        <div className="px-5 pt-8 pb-5 flex items-end justify-between">
          <div>
            <h1
              className="font-bold text-white mb-1"
              style={{ fontFamily: "Playfair Display, serif", fontSize: "1.8rem" }}
            >
              Mis rutas
            </h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              {routes.length} {routes.length === 1 ? "itinerario guardado" : "itinerarios guardados"}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => setShowNew(true)}
            className="px-4 font-semibold text-white text-sm rounded-xl"
            style={{ background: "var(--terracota)", height: 40, minWidth: 44 }}
          >
            + Nueva
          </motion.button>
        </div>
        <div className="mexican-stripe" />
      </div>

      {/* Route list */}
      <div
        className="px-4 pt-5"
        style={{ paddingBottom: "calc(var(--bottomnav-h) + 16px)" }}
      >
        <AnimatePresence>
          {routes.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 px-8"
            >
              <p className="text-5xl mb-4">🗺️</p>
              <p className="font-semibold text-base mb-1" style={{ color: "var(--text)" }}>
                Sin rutas todavía
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Crea una ruta y agrega lugares desde la página de cada lugar
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowNew(true)}
                className="mt-6 px-6 font-semibold text-white text-sm rounded-xl inline-flex items-center"
                style={{ background: "var(--terracota)", height: 44 }}
              >
                + Crear mi primera ruta
              </motion.button>
            </motion.div>
          )}

          {routes.map((route, i) => {
            const categories = [...new Set(route.stops.map((s) => s.place.category))];
            const firstPhoto = route.stops[0]?.place.photos[0];
            const isDeleting = pendingDelete === route.id;

            return (
              <motion.div
                key={route.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl overflow-hidden mb-3"
                style={{
                  background: "white",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <Link href={`/rutas/${route.id}`}>
                  <div className="flex gap-4 p-4">
                    {/* Thumbnail */}
                    <div
                      className="shrink-0 rounded-xl bg-cover bg-center flex items-center justify-center text-2xl"
                      style={{
                        width: 72,
                        height: 72,
                        backgroundImage: firstPhoto ? `url(${firstPhoto})` : undefined,
                        background: firstPhoto ? undefined : "var(--bg-muted)",
                      }}
                    >
                      {!firstPhoto && "🗺️"}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h2 className="font-semibold text-base leading-snug truncate"
                        style={{ color: "var(--text)" }}>
                        {route.name}
                      </h2>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {route.stops.length} {route.stops.length === 1 ? "parada" : "paradas"}
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        {categories.slice(0, 4).map((catId) => {
                          const cat = CATEGORIES.find((c) => c.id === catId);
                          return (
                            <span key={catId} className="text-sm" title={cat?.name}>
                              {cat?.icon}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <span className="self-center text-xl" style={{ color: "var(--text-muted)" }}>›</span>
                  </div>
                </Link>

                {/* Delete zone */}
                <div className="mx-4" style={{ borderTop: "1px solid var(--border)" }} />
                <AnimatePresence mode="wait">
                  {isDeleting ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-between px-4 py-2.5 gap-3"
                    >
                      <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                        ¿Eliminar esta ruta?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPendingDelete(null)}
                          className="px-3 py-1 rounded-lg text-xs font-semibold"
                          style={{ background: "var(--bg-muted)", color: "var(--text-secondary)" }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleConfirmDelete(route.id)}
                          className="px-3 py-1 rounded-lg text-xs font-semibold text-white"
                          style={{ background: "var(--rojo)" }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="delete-btn"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setPendingDelete(route.id)}
                      className="w-full py-2.5 text-xs font-medium"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Eliminar ruta
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* New route modal */}
      <AnimatePresence>
        {showNew && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNew(false)}
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
                className="font-bold mb-1"
                style={{ color: "var(--text)", fontFamily: "Playfair Display, serif", fontSize: "1.2rem" }}
              >
                Nueva ruta
              </h2>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                Dale un nombre que refleje tu itinerario
              </p>
              <input
                type="text"
                placeholder="Ej: Fin de semana en Oaxaca…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="w-full rounded-xl px-4 text-sm outline-none mb-3"
                style={{
                  height: 48,
                  border: `1.5px solid ${newName ? "var(--terracota)" : "var(--border)"}`,
                  background: "var(--bg-subtle)",
                  color: "var(--text)",
                  transition: "border-color 0.2s",
                }}
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="btn-primary"
              >
                Crear ruta
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
