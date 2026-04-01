"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ChoferCard from "@/components/choferes/ChoferCard";
import { ZONAS_GDL } from "@/types/choferes";
import type { ChoferPublico } from "@/types/choferes";
import { getRoute } from "@/lib/routeStore";
import { getStopName, type Route } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { getApiAuthHeader } from "@/lib/apiAuth";

export default function ChoferesClient() {
  const searchParams = useSearchParams();
  const rutaId = searchParams.get("ruta");
  const { user } = useAuth();

  const [choferes, setChoferes] = useState<ChoferPublico[]>([]);
  const [loading, setLoading] = useState(true);
  const [zonaFilter, setZonaFilter] = useState("");
  const [soloDisponible, setSoloDisponible] = useState(false);
  const [ruta, setRuta] = useState<Route | null>(null);

  // Load route if ruta param is present
  useEffect(() => {
    if (!rutaId) return;
    (async () => {
      if (user) {
        try {
          const headers = await getApiAuthHeader();
          const res = await fetch(`/api/routes/${rutaId}`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (data.route) { setRuta(data.route); return; }
          }
        } catch { /* fall through */ }
      }
      const r = getRoute(rutaId);
      if (r) setRuta(r);
    })();
  }, [rutaId, user]);

  useEffect(() => {
    fetchChoferes();
  }, [zonaFilter, soloDisponible]);

  async function fetchChoferes() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (zonaFilter) params.set("zona", zonaFilter);
      if (soloDisponible) params.set("disponible", "true");
      const res = await fetch(`/api/choferes?${params}`);
      const data = await res.json();
      setChoferes(data.choferes || []);
    } catch {
      setChoferes([]);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen" style={{ paddingTop: "calc(var(--topbar-h) + 16px)", paddingBottom: "calc(var(--bottomnav-h) + 24px)" }}>
      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="headline-md">Pueblear con chofer</h1>
          <p className="body-lg mt-1" style={{ color: "var(--on-surface-variant)" }}>
            Guadalajara y alrededores
          </p>
        </div>

        {/* Route context banner */}
        {ruta && (
          <div
            className="mb-5 p-4 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(45,125,98,0.08), rgba(196,98,45,0.06))",
              border: "1.5px solid rgba(45,125,98,0.15)",
            }}
          >
            <div className="flex items-start gap-3">
              <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>🗺️</span>
              <div className="flex-1 min-w-0">
                <p className="title-md" style={{ marginBottom: 4 }}>Tu ruta: {ruta.name}</p>
                <p className="label-sm" style={{ color: "var(--on-surface-variant)", lineHeight: 1.4 }}>
                  {ruta.stops.slice(0, 4).map(s => getStopName(s)).join(" → ")}
                  {ruta.stops.length > 4 && ` y ${ruta.stops.length - 4} más`}
                </p>
                <p className="label-sm mt-2" style={{ color: "var(--primary)", fontWeight: 600 }}>
                  Elige un chofer para recorrer esta ruta
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setZonaFilter("")}
              className="tag"
              style={{
                background: !zonaFilter ? "var(--primary)" : "var(--surface-container-high)",
                color: !zonaFilter ? "var(--on-primary)" : "var(--on-surface)",
              }}
            >
              Todas
            </button>
            {ZONAS_GDL.map(z => (
              <button
                key={z.id}
                onClick={() => setZonaFilter(z.id)}
                className="tag"
                style={{
                  background: zonaFilter === z.id ? "var(--primary)" : "var(--surface-container-high)",
                  color: zonaFilter === z.id ? "var(--on-primary)" : "var(--on-surface)",
                }}
              >
                {z.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={soloDisponible}
              onChange={e => setSoloDisponible(e.target.checked)}
              style={{ accentColor: "var(--primary)" }}
            />
            <span className="label-sm">Solo disponibles</span>
          </label>
        </div>

        {/* Results */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--surface-container)" }} />
            ))}
          </div>
        ) : choferes.length === 0 ? (
          <div className="text-center py-12">
            <p className="title-md mb-2">No hay choferes disponibles</p>
            <p className="body-lg" style={{ color: "var(--text-muted)" }}>
              Intenta con otra zona o vuelve más tarde
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {choferes.map(c => (
              <ChoferCard key={c.id} chofer={c} rutaId={rutaId ?? undefined} />
            ))}
          </div>
        )}

        {/* CTA for drivers */}
        <div className="mt-8 p-4 rounded-2xl text-center" style={{ background: "var(--surface-container)" }}>
          <p className="title-md mb-2">¿Eres transportista?</p>
          <p className="body-lg mb-3" style={{ color: "var(--on-surface-variant)" }}>
            Únete como chofer y genera ingresos puebleando
          </p>
          <Link href="/choferes/registro" className="btn-secondary inline-block">
            Registrarme como chofer
          </Link>
        </div>
      </div>
    </div>
  );
}
