"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { getApiAuthHeader } from "@/lib/apiAuth";
import type { Chofer, Comision } from "@/types/choferes";

export default function ChoferDashboardClient() {
  const { user, loading: authLoading } = useAuth();
  const [chofer, setChofer] = useState<Chofer | null>(null);
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [resumen, setResumen] = useState({ total_pendiente: 0, total_pagado: 0 });
  const [reservasPendientes, setReservasPendientes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!user || dataFetched) return;
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function fetchData() {
    setLoading(true);
    try {
      const headers = await getApiAuthHeader();

      // Fetch own chofer profile
      const meRes = await fetch("/api/choferes/me", { headers });
      if (meRes.ok) {
        const meData = await meRes.json();
        setChofer(meData.chofer);
        setResumen(meData.comisiones_resumen || resumen);
        setReservasPendientes(meData.reservas_pendientes || 0);
      }

      // Fetch detailed comisiones
      const comRes = await fetch("/api/comisiones", { headers });
      if (comRes.ok) {
        const comData = await comRes.json();
        setComisiones(comData.comisiones || []);
        if (comData.resumen) setResumen(comData.resumen);
      }
    } catch {}
    setLoading(false);
    setDataFetched(true);
  }

  async function toggleDisponibilidad() {
    if (!chofer) return;
    setToggling(true);
    try {
      const headers = await getApiAuthHeader();
      const res = await fetch("/api/choferes/disponibilidad", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ disponible: !chofer.disponible }),
      });
      if (res.ok) setChofer({ ...chofer, disponible: !chofer.disponible });
    } catch {}
    setToggling(false);
  }

  if (authLoading || loading || (!dataFetched && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: "var(--topbar-h)" }}>
        <p className="label-sm" style={{ color: "var(--text-muted)" }}>Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: "var(--topbar-h)" }}>
        <div className="text-center p-6">
          <h2 className="title-md mb-3">Inicia sesión</h2>
          <Link href="/auth/login?redirect=/choferes/mi-perfil" className="btn-primary">Iniciar sesión</Link>
        </div>
      </div>
    );
  }

  if (!chofer) {
    return (
      <div className="min-h-screen" style={{ paddingTop: "calc(var(--topbar-h) + 16px)", paddingBottom: "calc(var(--bottomnav-h) + 24px)" }}>
        <div className="max-w-lg mx-auto px-4 text-center py-12">
          <h2 className="headline-md mb-3">No tienes perfil de chofer</h2>
          <p className="body-lg mb-6" style={{ color: "var(--on-surface-variant)" }}>
            Regístrate como chofer para empezar a recibir solicitudes
          </p>
          <Link href="/choferes/registro" className="btn-primary">Registrarme como chofer</Link>
        </div>
      </div>
    );
  }

  const statusLabel: Record<string, { text: string; color: string; bg: string }> = {
    pendiente_documentos: { text: "Pendiente de documentos", color: "#B8860B", bg: "#FFF8E1" },
    en_revision: { text: "En revisión", color: "var(--primary)", bg: "var(--primary-container)" },
    activo: { text: "Activo", color: "var(--tertiary)", bg: "var(--tertiary-container)" },
    suspendido: { text: "Suspendido", color: "var(--error)", bg: "var(--error-container)" },
    rechazado: { text: "Rechazado", color: "var(--error)", bg: "var(--error-container)" },
  };
  const st = statusLabel[chofer.status] || statusLabel.pendiente_documentos;

  return (
    <div className="min-h-screen" style={{ paddingTop: "calc(var(--topbar-h) + 16px)", paddingBottom: "calc(var(--bottomnav-h) + 24px)" }}>
      <div className="max-w-lg mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{
              background: chofer.foto_url
                ? `url(${chofer.foto_url}) center/cover`
                : "linear-gradient(135deg, var(--primary), var(--primary-container))",
              color: "var(--on-primary)", fontSize: "1.5rem", fontWeight: 700,
            }}
          >
            {!chofer.foto_url && chofer.nombre_completo.charAt(0)}
          </div>
          <div>
            <h1 className="headline-md">{chofer.nombre_completo}</h1>
            <span className="label-sm px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
              {st.text}
            </span>
          </div>
        </div>

        {/* Status-specific messages */}
        {chofer.status === "pendiente_documentos" && (
          <div className="p-4 rounded-2xl mb-4" style={{ background: "#FFF8E1" }}>
            <p className="title-md mb-2" style={{ color: "#B8860B" }}>Completa tu registro</p>
            <p className="body-lg mb-3">Falta subir tus documentos para que podamos revisar tu perfil.</p>
            <Link href="/choferes/registro" className="btn-primary">Continuar registro</Link>
          </div>
        )}

        {chofer.status === "en_revision" && (
          <div className="p-4 rounded-2xl mb-4" style={{ background: "var(--primary-container)" }}>
            <p className="title-md" style={{ color: "var(--on-primary-container)" }}>
              Tus documentos están en revisión. Te notificaremos cuando tu perfil sea aprobado.
            </p>
          </div>
        )}

        {chofer.status === "rechazado" && (
          <div className="p-4 rounded-2xl mb-4" style={{ background: "var(--error-container)" }}>
            <p className="title-md mb-1" style={{ color: "var(--error)" }}>Perfil rechazado</p>
            {chofer.admin_nota && <p className="body-lg">Motivo: {chofer.admin_nota}</p>}
          </div>
        )}

        {chofer.status === "suspendido" && (
          <div className="p-4 rounded-2xl mb-4" style={{ background: "var(--error-container)" }}>
            <p className="title-md mb-1" style={{ color: "var(--error)" }}>Cuenta suspendida</p>
            <p className="body-lg">
              {Number(resumen.total_pendiente) > 0
                ? `Tienes $${resumen.total_pendiente} MXN en comisiones pendientes. Liquida tu saldo para reactivar tu cuenta.`
                : chofer.admin_nota || "Contacta soporte para más información."}
            </p>
          </div>
        )}

        {/* Active chofer dashboard */}
        {chofer.status === "activo" && (
          <>
            {/* Availability toggle */}
            <div className="p-4 rounded-2xl mb-4 flex justify-between items-center"
              style={{ background: chofer.disponible ? "var(--tertiary-container)" : "var(--surface-container)" }}>
              <div>
                <p className="title-md">{chofer.disponible ? "Disponible" : "No disponible"}</p>
                <p className="label-sm" style={{ color: "var(--on-surface-variant)" }}>
                  {chofer.disponible ? "Apareces en el catálogo de choferes" : "No apareces en el catálogo"}
                </p>
              </div>
              <button onClick={toggleDisponibilidad} disabled={toggling}
                className="btn-ghost" style={{
                  border: `1px solid ${chofer.disponible ? "var(--tertiary)" : "var(--primary)"}`,
                  color: chofer.disponible ? "var(--tertiary)" : "var(--primary)",
                }}>
                {toggling ? "..." : chofer.disponible ? "Desactivar" : "Activar"}
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-xl text-center" style={{ background: "var(--surface-container)" }}>
                <p className="headline-md">{chofer.total_viajes}</p>
                <p className="label-sm" style={{ color: "var(--text-muted)" }}>Viajes</p>
              </div>
              <div className="p-3 rounded-xl text-center" style={{ background: "var(--surface-container)" }}>
                <p className="headline-md">
                  {Number(chofer.calificacion_promedio) > 0 ? Number(chofer.calificacion_promedio).toFixed(1) : "—"}
                </p>
                <p className="label-sm" style={{ color: "var(--text-muted)" }}>Calificación</p>
              </div>
              <div className="p-3 rounded-xl text-center" style={{ background: "var(--surface-container)" }}>
                <p className="headline-md" style={{ color: Number(resumen.total_pendiente) > 0 ? "var(--error)" : "var(--tertiary)" }}>
                  ${resumen.total_pendiente}
                </p>
                <p className="label-sm" style={{ color: "var(--text-muted)" }}>Por pagar</p>
              </div>
            </div>

            {/* Pending bookings alert */}
            {reservasPendientes > 0 && (
              <Link href="/pueblear" className="block p-4 rounded-2xl mb-4"
                style={{ background: "var(--primary-container)" }}>
                <p className="title-md" style={{ color: "var(--on-primary-container)" }}>
                  Tienes {reservasPendientes} solicitud{reservasPendientes > 1 ? "es" : ""} pendiente{reservasPendientes > 1 ? "s" : ""} →
                </p>
              </Link>
            )}

            {/* Quick links */}
            <div className="space-y-2 mb-6">
              <Link href="/pueblear" className="block p-3 rounded-xl"
                style={{ background: "var(--surface-container)" }}>
                <span className="title-md">Mis puebleadas →</span>
              </Link>
            </div>
          </>
        )}

        {/* Comisiones (visible for active and suspended) */}
        {(chofer.status === "activo" || chofer.status === "suspendido") && (
          <>
            <h2 className="title-md mb-3">Comisiones</h2>
            <div className="p-4 rounded-2xl mb-4" style={{ background: "var(--surface-container)" }}>
              <div className="flex justify-between mb-2">
                <span className="label-sm">Pendiente de pago</span>
                <span className="body-lg" style={{ color: "var(--error)", fontWeight: 600 }}>
                  ${resumen.total_pendiente} MXN
                </span>
              </div>
              <div className="flex justify-between">
                <span className="label-sm">Total pagado</span>
                <span className="body-lg" style={{ color: "var(--tertiary)" }}>${resumen.total_pagado} MXN</span>
              </div>
            </div>

            {comisiones.length > 0 && (
              <div className="space-y-2">
                {comisiones.slice(0, 10).map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 rounded-xl"
                    style={{ background: "var(--surface-container-lowest)", boxShadow: "var(--shadow-card)" }}>
                    <div>
                      <p className="body-lg">${c.monto} MXN</p>
                      <p className="label-sm" style={{ color: "var(--text-muted)" }}>
                        {c.fecha_limite && `Vence: ${new Date(c.fecha_limite).toLocaleDateString("es-MX")}`}
                      </p>
                    </div>
                    <span className="label-sm px-2 py-0.5 rounded-full" style={{
                      background: c.status === "pendiente" ? "var(--error-container)" : "var(--tertiary-container)",
                      color: c.status === "pendiente" ? "var(--error)" : "var(--tertiary)",
                    }}>
                      {c.status === "pendiente" ? "Pendiente" : "Pagada"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
