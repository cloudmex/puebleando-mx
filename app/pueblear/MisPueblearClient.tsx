"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { getApiAuthHeader } from "@/lib/apiAuth";
import type { Reserva } from "@/types/choferes";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Pendiente", color: "var(--on-surface)", bg: "var(--surface-container-high)" },
  contraoferta: { label: "Contraoferta", color: "#B8860B", bg: "#FFF8E1" },
  aceptada: { label: "Aceptada", color: "var(--secondary)", bg: "var(--secondary-container)" },
  confirmada: { label: "Confirmada", color: "var(--tertiary)", bg: "var(--tertiary-container)" },
  en_curso: { label: "En curso", color: "var(--primary)", bg: "var(--primary-container)" },
  completada: { label: "Completada", color: "var(--secondary)", bg: "var(--secondary-container)" },
  cancelada: { label: "Cancelada", color: "var(--error)", bg: "var(--error-container)" },
  expirada: { label: "Expirada", color: "var(--text-muted)", bg: "var(--surface-container-high)" },
};

export default function MisPueblearClient() {
  const { user, loading: authLoading } = useAuth();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"usuario" | "chofer">("usuario");

  useEffect(() => {
    if (!user) return;
    fetchReservas();
  }, [user, tab]);

  async function fetchReservas() {
    setLoading(true);
    try {
      const headers = await getApiAuthHeader();
      const res = await fetch(`/api/pueblear?rol=${tab}`, { headers });
      const data = await res.json();
      setReservas(data.reservas || []);
    } catch { setReservas([]); }
    setLoading(false);
  }

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: "var(--topbar-h)" }}>
        <div className="text-center p-6">
          <h2 className="title-md mb-3">Inicia sesión para ver tus puebleadas</h2>
          <Link href="/auth/login?redirect=/pueblear" className="btn-primary">Iniciar sesión</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ paddingTop: "calc(var(--topbar-h) + 16px)", paddingBottom: "calc(var(--bottomnav-h) + 24px)" }}>
      <div className="max-w-lg mx-auto px-4">
        <h1 className="headline-md mb-4">Mis Puebleadas</h1>

        {/* Tab switch */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab("usuario")}
            className="flex-1 py-2 rounded-full label-sm text-center transition-colors"
            style={{
              background: tab === "usuario" ? "var(--primary)" : "var(--surface-container-high)",
              color: tab === "usuario" ? "var(--on-primary)" : "var(--on-surface)",
            }}>
            Como viajero
          </button>
          <button onClick={() => setTab("chofer")}
            className="flex-1 py-2 rounded-full label-sm text-center transition-colors"
            style={{
              background: tab === "chofer" ? "var(--primary)" : "var(--surface-container-high)",
              color: tab === "chofer" ? "var(--on-primary)" : "var(--on-surface)",
            }}>
            Como chofer
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--surface-container)" }} />
            ))}
          </div>
        ) : reservas.length === 0 ? (
          <div className="text-center py-12">
            <p className="title-md mb-2">Sin puebleadas aún</p>
            <p className="body-lg mb-4" style={{ color: "var(--text-muted)" }}>
              {tab === "usuario"
                ? "Encuentra un chofer y solicita tu primera puebleada"
                : "Las solicitudes de viaje aparecerán aquí"}
            </p>
            {tab === "usuario" && (
              <Link href="/choferes" className="btn-primary">Ver choferes</Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {reservas.map(r => {
              const st = STATUS_LABELS[r.status] || STATUS_LABELS.pendiente;
              return (
                <Link key={r.id} href={`/pueblear/${r.id}`}
                  className="block p-4 rounded-2xl transition-shadow"
                  style={{ background: "var(--surface-container-lowest)", boxShadow: "var(--shadow-card)" }}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="title-md">
                        {tab === "usuario"
                          ? ((r as unknown as Record<string, unknown>).chofer_nombre as string || "Chofer")
                          : ((r as unknown as Record<string, unknown>).usuario_nombre as string || "Usuario")}
                      </p>
                      <p className="label-sm" style={{ color: "var(--text-muted)" }}>
                        {new Date(r.fecha).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
                        {" · "}{r.hora_inicio?.slice(0, 5)} · {r.duracion_horas}h
                      </p>
                    </div>
                    <span className="label-sm px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </div>
                  {r.destinos && r.destinos.length > 0 && (
                    <p className="label-sm" style={{ color: "var(--on-surface-variant)" }}>
                      {r.destinos.join(", ")}
                    </p>
                  )}
                  <div className="flex justify-between items-center mt-2">
                    <span className="label-sm" style={{ color: "var(--primary)", fontWeight: 600 }}>
                      ${r.precio_final || r.precio_contraoferta || r.precio_propuesto} MXN
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
