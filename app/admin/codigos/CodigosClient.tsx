"use client";
import { useEffect, useState } from "react";
import { getApiAuthHeader } from "@/lib/apiAuth";
import type { CodigoInvitacion } from "@/types/choferes";

export default function CodigosClient() {
  const [codigos, setCodigos] = useState<(CodigoInvitacion & { usado_por_nombre?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [cantidad, setCantidad] = useState(1);
  const [creating, setCreating] = useState(false);
  const [newCodes, setNewCodes] = useState<string[]>([]);

  useEffect(() => { fetchCodigos(); }, []);

  async function fetchCodigos() {
    setLoading(true);
    try {
      const headers = await getApiAuthHeader();
      const res = await fetch("/api/admin/codigos-invitacion", { headers });
      const data = await res.json();
      setCodigos(data.codigos || []);
    } catch { setCodigos([]); }
    setLoading(false);
  }

  async function createCodigos() {
    setCreating(true);
    setNewCodes([]);
    try {
      const headers = await getApiAuthHeader();
      const res = await fetch("/api/admin/codigos-invitacion", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ cantidad }),
      });
      const data = await res.json();
      setNewCodes(data.codigos || []);
      await fetchCodigos();
    } catch {}
    setCreating(false);
  }

  return (
    <div className="min-h-screen" style={{ paddingTop: "calc(var(--topbar-h) + 16px)", paddingBottom: "calc(var(--bottomnav-h) + 24px)" }}>
      <div className="max-w-lg mx-auto px-4">
        <h1 className="headline-md mb-6">Códigos de Invitación</h1>

        {/* Create new */}
        <div className="p-4 rounded-2xl mb-6" style={{ background: "var(--surface-container)" }}>
          <h2 className="title-md mb-3">Generar nuevos códigos</h2>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="label-sm block mb-1">Cantidad</label>
              <input type="number" value={cantidad} onChange={e => setCantidad(Number(e.target.value))}
                min={1} max={20} className="input-field" />
            </div>
            <button onClick={createCodigos} disabled={creating} className="btn-primary">
              {creating ? "Generando..." : "Generar"}
            </button>
          </div>
          {newCodes.length > 0 && (
            <div className="mt-3 p-3 rounded-lg" style={{ background: "var(--tertiary-container)" }}>
              <p className="label-sm mb-2" style={{ color: "var(--tertiary)" }}>Códigos generados:</p>
              {newCodes.map(c => (
                <p key={c} className="body-lg font-mono" style={{ letterSpacing: "0.05em" }}>{c}</p>
              ))}
            </div>
          )}
        </div>

        {/* List */}
        {loading ? (
          <p className="label-sm" style={{ color: "var(--text-muted)" }}>Cargando...</p>
        ) : (
          <div className="space-y-2">
            {codigos.map(c => (
              <div key={c.id} className="flex justify-between items-center p-3 rounded-xl"
                style={{ background: "var(--surface-container-lowest)", boxShadow: "var(--shadow-card)" }}>
                <div>
                  <p className="body-lg font-mono" style={{ letterSpacing: "0.05em" }}>{c.codigo}</p>
                  <p className="label-sm" style={{ color: "var(--text-muted)" }}>
                    {c.usado_por
                      ? `Usado por ${c.usado_por_nombre || "—"}`
                      : c.activo ? "Disponible" : "Inactivo"}
                  </p>
                </div>
                <span className="label-sm px-2 py-0.5 rounded-full" style={{
                  background: c.usado_por ? "var(--surface-container-high)" : c.activo ? "var(--tertiary-container)" : "var(--error-container)",
                  color: c.usado_por ? "var(--text-muted)" : c.activo ? "var(--tertiary)" : "var(--error)",
                }}>
                  {c.usado_por ? "Usado" : c.activo ? "Activo" : "Inactivo"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
