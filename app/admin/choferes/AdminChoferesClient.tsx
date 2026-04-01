"use client";
import { useEffect, useState } from "react";
import { getApiAuthHeader } from "@/lib/apiAuth";
import type { Chofer } from "@/types/choferes";

type Tab = "en_revision" | "activo" | "suspendido" | "rechazado";

export default function AdminChoferesClient() {
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("en_revision");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { fetchChoferes(); }, [tab]);

  async function fetchChoferes() {
    setLoading(true);
    try {
      const headers = await getApiAuthHeader();
      const res = await fetch(`/api/admin/choferes?status=${tab}`, { headers });
      const data = await res.json();
      setChoferes(data.choferes || []);
    } catch { setChoferes([]); }
    setLoading(false);
  }

  async function handleAction(id: string, action: "aprobar" | "rechazar", nota?: string) {
    setActionLoading(id);
    try {
      const headers = await getApiAuthHeader();
      await fetch(`/api/admin/choferes/${id}/${action}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ nota, motivo: nota }),
      });
      await fetchChoferes();
    } catch {}
    setActionLoading(null);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "en_revision", label: "En revisión" },
    { key: "activo", label: "Activos" },
    { key: "suspendido", label: "Suspendidos" },
    { key: "rechazado", label: "Rechazados" },
  ];

  return (
    <div className="min-h-screen" style={{ paddingTop: "calc(var(--topbar-h) + 16px)", paddingBottom: "calc(var(--bottomnav-h) + 24px)" }}>
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="headline-md mb-4">Administrar Choferes</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="tag whitespace-nowrap" style={{
                background: tab === t.key ? "var(--primary)" : "var(--surface-container-high)",
                color: tab === t.key ? "var(--on-primary)" : "var(--on-surface)",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="label-sm" style={{ color: "var(--text-muted)" }}>Cargando...</p>
        ) : choferes.length === 0 ? (
          <p className="body-lg" style={{ color: "var(--text-muted)" }}>No hay choferes en esta categoría</p>
        ) : (
          <div className="space-y-4">
            {choferes.map(c => (
              <div key={c.id} className="p-4 rounded-2xl" style={{ background: "var(--surface-container-lowest)", boxShadow: "var(--shadow-card)" }}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="title-md">{c.nombre_completo}</h3>
                    <p className="label-sm" style={{ color: "var(--text-muted)" }}>
                      {c.telefono} · {c.tipo_licencia || "Sin licencia"} · {c.anios_experiencia} años exp.
                    </p>
                  </div>
                  <span className="label-sm px-2 py-0.5 rounded-full" style={{
                    background: c.status === "activo" ? "var(--tertiary-container)" : "var(--surface-container-high)",
                    color: c.status === "activo" ? "var(--tertiary)" : "var(--on-surface)",
                  }}>
                    {c.status}
                  </span>
                </div>

                {/* Documents */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <DocLink label="INE frente" url={c.ine_frente_url} />
                  <DocLink label="INE reverso" url={c.ine_reverso_url} />
                  <DocLink label="Antecedentes" url={c.antecedentes_url} />
                  <DocLink label="Licencia frente" url={c.licencia_frente_url} />
                  <DocLink label="Licencia reverso" url={c.licencia_reverso_url} />
                </div>

                {/* Zones */}
                {c.zonas_cobertura.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {c.zonas_cobertura.map(z => <span key={z} className="tag" style={{ fontSize: "0.65rem" }}>{z}</span>)}
                  </div>
                )}

                {/* Comisiones */}
                {(c as unknown as Record<string, unknown>).comisiones_pendientes !== undefined && (
                  <p className="label-sm mb-3">
                    Comisiones pendientes: <strong>${String((c as unknown as Record<string, unknown>).comisiones_pendientes)}</strong>
                  </p>
                )}

                {/* Actions */}
                {tab === "en_revision" && (
                  <div className="flex gap-2">
                    <button onClick={() => handleAction(c.id, "aprobar")}
                      disabled={actionLoading === c.id} className="btn-primary flex-1">
                      {actionLoading === c.id ? "..." : "Aprobar"}
                    </button>
                    <button onClick={() => {
                      const motivo = prompt("Motivo del rechazo:");
                      if (motivo) handleAction(c.id, "rechazar", motivo);
                    }} disabled={actionLoading === c.id}
                      className="btn-ghost flex-1" style={{ border: "1px solid var(--error)", color: "var(--error)" }}>
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocLink({ label, url }: { label: string; url?: string }) {
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="label-sm underline" style={{ color: "var(--primary)" }}>
      {label} ✓
    </a>
  ) : (
    <span className="label-sm" style={{ color: "var(--text-muted)" }}>{label} —</span>
  );
}
