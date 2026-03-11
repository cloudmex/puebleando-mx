"use client";
import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Route } from "@/types";
import { getRoute } from "@/lib/routeStore";
import RouteBuilder from "@/components/route/RouteBuilder";

interface Props {
  params: Promise<{ id: string }>;
}

export default function RutaDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [route, setRoute] = useState<Route | null>(null);

  useEffect(() => {
    const r = getRoute(id);
    if (r) setRoute(r);
  }, [id]);

  if (!route) {
    return (
      <main className="min-h-screen flex items-center justify-center"
        style={{ paddingTop: "var(--topbar-h)" }}>
        <div className="text-center px-8">
          <p className="text-5xl mb-4">🗺️</p>
          <p className="font-semibold" style={{ color: "var(--text)" }}>Ruta no encontrada</p>
          <button onClick={() => router.back()} className="mt-4 text-sm underline"
            style={{ color: "var(--terracota)" }}>
            Regresar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", paddingTop: "var(--topbar-h)" }}>

      {/* Header */}
      <div style={{ background: "var(--dark)" }}>
        <div className="px-5 pt-7 pb-5">
          <button
            onClick={() => router.back()}
            className="text-sm mb-3 flex items-center gap-1.5"
            style={{ color: "rgba(255,255,255,0.45)", minHeight: 32 }}
          >
            ← Mis rutas
          </button>
          <h1 className="font-bold text-white" style={{ fontFamily: "Playfair Display, serif", fontSize: "1.7rem" }}>
            {route.name}
          </h1>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            {route.stops.length} {route.stops.length === 1 ? "parada" : "paradas"}
            {route.stops.length > 1 && " · Arrastra para reordenar"}
          </p>
        </div>
        <div className="mexican-stripe" />
      </div>

      <div
        className="px-4 pt-5"
        style={{ paddingBottom: "calc(var(--bottomnav-h) + 20px)" }}
      >
        {/* Miniaturas de paradas */}
        {route.stops.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-2 overflow-x-auto hide-scrollbar mb-5"
          >
            {route.stops.map((stop, i) => (
              <div key={stop.place.id} className="flex items-center gap-2 shrink-0">
                <div
                  className="w-9 h-9 rounded-full bg-cover bg-center border-2 border-white shadow-sm"
                  style={{ backgroundImage: `url(${stop.place.photos[0]})` }}
                />
                {i < route.stops.length - 1 && (
                  <div className="w-5 h-px" style={{ background: "var(--border-strong)" }} />
                )}
              </div>
            ))}
          </motion.div>
        )}

        <RouteBuilder route={route} onChange={setRoute} />

        {route.stops.length > 0 && (
          <a href="/explorar" className="btn-ghost mt-5">
            + Explorar más lugares
          </a>
        )}
      </div>
    </main>
  );
}
