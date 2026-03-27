"use client";
import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Route, getStopId, getStopImage } from "@/types";
import { getRoute } from "@/lib/routeStore";
import RouteBuilder from "@/components/route/RouteBuilder";
import { useAuth } from "@/components/auth/AuthProvider";
import { getApiAuthHeader } from "@/lib/apiAuth";

interface Props {
  params: Promise<{ id: string }>;
}

export default function RutaDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [route, setRoute] = useState<Route | null>(null);

  useEffect(() => {
    const r = getRoute(id);
    if (r) setRoute(r);
  }, [id]);

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

  return (
    <main style={{ minHeight: "100vh", background: "var(--surface)", paddingTop: "var(--topbar-h)" }}>

      {/* Header — editorial warm surface */}
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
          <p className="body-lg" style={{ fontSize: "0.88rem" }}>
            {route.stops.length} {route.stops.length === 1 ? "parada" : "paradas"}
            {route.stops.length > 1 && " · Arrastra para reordenar"}
          </p>
        </div>
      </div>

      <div
        className="px-4 pt-6"
        style={{ paddingBottom: "calc(var(--bottomnav-h) + 24px)" }}
      >
        {/* Stop thumbnails */}
        {route.stops.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-2.5 overflow-x-auto hide-scrollbar mb-6"
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

        <RouteBuilder route={route} onChange={handleChange} />

        {route.stops.length > 0 && (
          <a href="/" className="btn-ghost mt-6 justify-center" style={{ textDecoration: "none" }}>
            + Explorar más lugares y eventos
          </a>
        )}
      </div>
    </main>
  );
}
