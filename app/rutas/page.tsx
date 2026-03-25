"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Route, getStopImage, getStopCategory } from "@/types";
import { getRoutes, createRoute, deleteRoute, editRoute } from "@/lib/routeStore";
import { CATEGORIES } from "@/lib/data";
import { useAuth } from "@/components/auth/AuthProvider";
import { getApiAuthHeader } from "@/lib/apiAuth";

export default function RutasPage() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const loadRoutes = useCallback(async () => {
    if (user) {
      try {
        const headers = await getApiAuthHeader();
        const res = await fetch("/api/routes", { headers });
        if (res.ok) {
          const data = await res.json();
          setRoutes(data.routes ?? []);
          return;
        }
      } catch {
        // fall through to localStorage
      }
    }
    setRoutes(getRoutes());
  }, [user]);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const local = createRoute(newName.trim());
    if (user) {
      try {
        const headers = await getApiAuthHeader();
        await fetch("/api/routes", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id: local.id, name: local.name, description: local.description, stops: local.stops, created_at: local.created_at }),
        });
      } catch { /* non-fatal */ }
    }
    await loadRoutes();
    setNewName("");
    setShowNew(false);
  };

  const handleConfirmDelete = async (id: string) => {
    deleteRoute(id);
    if (user) {
      try {
        const headers = await getApiAuthHeader();
        await fetch(`/api/routes/${id}`, { method: "DELETE", headers });
      } catch { /* non-fatal */ }
    }
    await loadRoutes();
    setPendingDelete(null);
  };

  const handleEditSubmit = async (id: string) => {
    if (!editName.trim()) return;
    editRoute(id, editName.trim());
    if (user) {
      try {
        const headers = await getApiAuthHeader();
        await fetch(`/api/routes/${id}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ name: editName.trim() }),
        });
      } catch { /* non-fatal */ }
    }
    await loadRoutes();
    setEditingRouteId(null);
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", paddingTop: "var(--topbar-h)" }}>

      {/* Banner sincronización — solo si hay rutas locales y no hay cuenta */}
      {!user && routes.length > 0 && (
        <div style={{
          background: "var(--dark)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8rem", lineHeight: 1.4 }}>
            Tus rutas solo existen en este dispositivo.{" "}
            <span style={{ color: "var(--maiz)" }}>Crea una cuenta para no perderlas.</span>
          </p>
          <a
            href="/auth/registro"
            style={{
              flexShrink: 0,
              background: "var(--terracota)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.78rem",
              padding: "6px 14px",
              borderRadius: "var(--r-full)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Guardar
          </a>
        </div>
      )}

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
            const categories = [...new Set(route.stops.map((s) => getStopCategory(s)))];
            const firstPhoto = route.stops[0] ? getStopImage(route.stops[0]) : undefined;
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
                      {editingRouteId === route.id ? (
                        <div className="flex flex-col gap-2 relative z-10" onClick={(e) => e.preventDefault()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditSubmit(route.id);
                              if (e.key === "Escape") setEditingRouteId(null);
                            }}
                            className="w-full rounded-md px-2 py-1 text-sm outline-none font-semibold"
                            style={{
                              border: "1.5px solid var(--terracota)",
                              background: "rgba(255,255,255,0.9)",
                              color: "var(--text)",
                            }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex gap-2">
                             <button
                               onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingRouteId(null); }}
                               className="text-xs px-2 py-1 rounded-md"
                               style={{ background: "var(--bg-muted)", color: "var(--text-secondary)" }}
                             >
                               Cancelar
                             </button>
                             <button
                               onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditSubmit(route.id); }}
                               className="text-xs px-2 py-1 rounded-md text-white font-semibold"
                               style={{ background: "var(--jade)" }}
                             >
                               Guardar
                             </button>
                          </div>
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                    {editingRouteId !== route.id && (
                      <span className="self-center text-xl" style={{ color: "var(--text-muted)" }}>›</span>
                    )}
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
                    <div className="flex">
                      <motion.button
                        key="edit-btn"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => { setEditName(route.name); setEditingRouteId(route.id); }}
                        className="flex-1 py-3 text-xs font-medium"
                        style={{ color: "var(--text-secondary)", borderRight: "1px solid var(--border)" }}
                      >
                        ✏️ Editar
                      </motion.button>
                      <motion.button
                        key="delete-btn"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => setPendingDelete(route.id)}
                        className="flex-1 py-3 text-xs font-medium"
                        style={{ color: "var(--rojo)" }}
                      >
                        🗑️ Eliminar
                      </motion.button>
                    </div>
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
