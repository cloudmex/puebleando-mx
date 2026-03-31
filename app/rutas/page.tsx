"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Route, getStopImage, getStopCategory } from "@/types";
import { getRoutes, createRoute, deleteRoute, editRoute, canCreateRouteFree, FREE_STOPS_LIMIT } from "@/lib/routeStore";
import { CATEGORIES } from "@/lib/data";
import { useAuth } from "@/components/auth/AuthProvider";
import { getApiAuthHeader } from "@/lib/apiAuth";
import Toast from "@/components/ui/Toast";

export default function RutasPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [welcomeToast, setWelcomeToast] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("welcome") === "1") {
      setWelcomeToast(true);
      window.history.replaceState({}, "", "/rutas");
    }
  }, []);

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
    if (user) {
      try {
        const headers = await getApiAuthHeader();
        const tempId = `r_${Date.now()}`;
        await fetch("/api/routes", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id: tempId, name: newName.trim(), description: "", stops: [], created_at: new Date().toISOString() }),
        });
      } catch { /* non-fatal */ }
    } else {
      createRoute(newName.trim());
    }
    await loadRoutes();
    setNewName("");
    setShowNew(false);
  };

  const handleConfirmDelete = async (id: string) => {
    if (user) {
      try {
        const headers = await getApiAuthHeader();
        await fetch(`/api/routes/${id}`, { method: "DELETE", headers });
      } catch { /* non-fatal */ }
    } else {
      deleteRoute(id);
    }
    await loadRoutes();
    setPendingDelete(null);
  };

  const handleEditSubmit = async (id: string) => {
    if (!editName.trim()) return;
    if (user) {
      try {
        const headers = await getApiAuthHeader();
        await fetch(`/api/routes/${id}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ name: editName.trim() }),
        });
      } catch { /* non-fatal */ }
    } else {
      editRoute(id, editName.trim());
    }
    await loadRoutes();
    setEditingRouteId(null);
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--surface)", paddingTop: "var(--topbar-h)" }}>

      {/* Sync banner */}
      {!user && routes.length > 0 && (
        <div style={{
          background: "var(--surface-container-low)",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}>
          <p style={{ color: "var(--on-surface-variant)", fontSize: "0.8rem", lineHeight: 1.4 }}>
            Tus rutas se guardan solo en este dispositivo.{" "}
            <span style={{ color: "var(--primary)", fontWeight: 600 }}>Crea una cuenta para no perderlas.</span>
          </p>
          <a
            href="/auth/registro?redirect=/rutas"
            style={{
              flexShrink: 0,
              background: "linear-gradient(135deg, var(--primary), var(--primary-container))",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.78rem",
              padding: "8px 16px",
              borderRadius: "var(--r-full)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Crear cuenta
          </a>
        </div>
      )}

      {/* Header */}
      <div style={{ background: "var(--surface-container-low)", paddingBottom: 20 }}>
        <div className="px-5 pt-10 pb-2 flex items-end justify-between">
          <div>
            <p className="label-sm" style={{ color: "var(--primary)", marginBottom: 8 }}>
              Tus viajes
            </p>
            <h1 className="display-md" style={{ marginBottom: 4 }}>
              Mis rutas
            </h1>
            <p className="body-lg" style={{ fontSize: "0.88rem" }}>
              {routes.length} {routes.length === 1 ? "itinerario guardado" : "itinerarios guardados"}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              if (!user && !canCreateRouteFree()) { setShowAuthGate(true); return; }
              setShowNew(true);
            }}
            className="px-5 font-semibold text-white text-sm rounded-full"
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--primary-container))",
              height: 44,
              minWidth: 44,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(156,61,42,0.2)",
              fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
            }}
          >
            + Nueva
          </motion.button>
        </div>
      </div>

      {/* Route list */}
      <div
        className="px-4 pt-6"
        style={{ paddingBottom: "calc(var(--bottomnav-h) + 20px)" }}
      >
        <AnimatePresence>
          {routes.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24 px-8"
            >
              <p className="text-5xl mb-5">🗺️</p>
              <p className="headline-md mb-2">Sin rutas todavía</p>
              <p className="body-lg">
                Crea una ruta y agrega lugares desde la página de cada lugar
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (!user && !canCreateRouteFree()) { setShowAuthGate(true); return; }
                  setShowNew(true);
                }}
                className="mt-7 px-7 font-semibold text-white text-sm rounded-full inline-flex items-center"
                style={{
                  background: "linear-gradient(135deg, var(--primary), var(--primary-container))",
                  height: 48,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(156,61,42,0.2)",
                  fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
                }}
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
                className="rounded-3xl overflow-hidden mb-4"
                style={{
                  background: "var(--surface-container-lowest)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <Link href={`/rutas/${route.id}`}>
                  <div className="flex gap-4 p-4">
                    {/* Thumbnail */}
                    <div
                      className="shrink-0 rounded-2xl bg-cover bg-center flex items-center justify-center text-2xl"
                      style={{
                        width: 76,
                        height: 76,
                        backgroundImage: firstPhoto ? `url(${firstPhoto})` : undefined,
                        background: firstPhoto ? undefined : "var(--surface-container-high)",
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
                            className="w-full rounded-xl px-3 py-1.5 text-sm outline-none font-semibold"
                            style={{
                              background: "var(--surface-container-low)",
                              color: "var(--on-surface)",
                              border: "none",
                              boxShadow: "0 0 0 2px var(--primary)",
                            }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex gap-2">
                             <button
                               onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingRouteId(null); }}
                               className="text-xs px-4 py-2 rounded-full"
                               style={{ background: "var(--surface-container-high)", color: "var(--on-surface-variant)", border: "none", cursor: "pointer", minHeight: 36 }}
                             >
                               Cancelar
                             </button>
                             <button
                               onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditSubmit(route.id); }}
                               className="text-xs px-4 py-2 rounded-full text-white font-semibold"
                               style={{ background: "var(--secondary)", border: "none", cursor: "pointer", minHeight: 36 }}
                             >
                               Guardar
                             </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h2 className="font-semibold text-base leading-snug truncate"
                            style={{ color: "var(--on-surface)", fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}>
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
                      <span className="self-center" style={{ color: "var(--primary)" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>
                    )}
                  </div>
                </Link>

                {/* Action zone — tonal shift instead of border */}
                <div className="mx-4 h-px" style={{ background: "var(--outline-variant)" }} />
                <AnimatePresence mode="wait">
                  {isDeleting ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-between px-4 py-3 gap-3"
                    >
                      <p className="text-xs font-medium" style={{ color: "var(--on-surface-variant)" }}>
                        ¿Eliminar esta ruta?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPendingDelete(null)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={{ background: "var(--surface-container-high)", color: "var(--on-surface-variant)", border: "none", cursor: "pointer" }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleConfirmDelete(route.id)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                          style={{ background: "var(--error)", border: "none", cursor: "pointer" }}
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
                        className="flex-1 text-sm font-medium"
                        style={{ color: "var(--on-surface-variant)", background: "none", border: "none", cursor: "pointer", minHeight: 44 }}
                      >
                        Editar
                      </motion.button>
                      <div className="w-px self-stretch my-2" style={{ background: "var(--outline-variant)" }} />
                      <motion.button
                        key="delete-btn"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => setPendingDelete(route.id)}
                        className="flex-1 text-sm font-medium"
                        style={{ color: "var(--error)", background: "none", border: "none", cursor: "pointer", minHeight: 44 }}
                      >
                        Eliminar
                      </motion.button>
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Auth gate modal */}
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
                href="/auth/registro?redirect=/rutas"
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

      {/* New route modal */}
      <AnimatePresence>
        {showNew && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNew(false)}
              className="fixed inset-0 z-50"
              style={{ background: "var(--on-surface)" }}
            />
            <motion.div
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
              <h2 className="headline-md mb-2">
                Nueva ruta
              </h2>
              <p className="body-lg mb-5" style={{ fontSize: "0.88rem" }}>
                Dale un nombre que refleje tu itinerario
              </p>
              <input
                type="text"
                placeholder="Ej: Fin de semana en Oaxaca…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="w-full rounded-2xl px-4 text-sm outline-none mb-4"
                style={{
                  height: 52,
                  background: "var(--surface-container-low)",
                  color: "var(--on-surface)",
                  border: "none",
                  boxShadow: newName ? "0 0 0 2px var(--primary)" : "none",
                  transition: "box-shadow 0.2s",
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

      <Toast
        message={`Bienvenido${profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}! Ya puedes crear rutas ilimitadas.`}
        show={welcomeToast}
        onHide={() => setWelcomeToast(false)}
      />
    </main>
  );
}
