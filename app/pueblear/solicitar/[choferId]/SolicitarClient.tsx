"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { getApiAuthHeader } from "@/lib/apiAuth";
import { DURACIONES } from "@/types/choferes";
import type { ChoferPublico, PrecioSugerido } from "@/types/choferes";
import FileUpload from "@/components/ui/FileUpload";
import { getRoute } from "@/lib/routeStore";
import { getStopName, type Route } from "@/types";

export default function SolicitarClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rutaId = searchParams.get("ruta");
  const { user, loading: authLoading } = useAuth();

  const [chofer, setChofer] = useState<ChoferPublico | null>(null);
  const [precios, setPrecios] = useState<PrecioSugerido[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ruta, setRuta] = useState<Route | null>(null);

  // Form
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [duracion, setDuracion] = useState(4);
  const [numPasajeros, setNumPasajeros] = useState(1);
  const [puntoRecogida, setPuntoRecogida] = useState("");
  const [puntoEntrega, setPuntoEntrega] = useState("");
  const [mismoLugar, setMismoLugar] = useState(true);
  const [destinos, setDestinos] = useState<string[]>([]);
  const [destinoInput, setDestinoInput] = useState("");
  const [notas, setNotas] = useState("");
  const [precioP, setPrecioP] = useState("");
  const [usuarioFoto, setUsuarioFoto] = useState("");
  const [usuarioIne, setUsuarioIne] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/choferes/${params.choferId}`).then(r => r.json()),
      fetch("/api/precios-sugeridos").then(r => r.json()),
    ]).then(([choferData, preciosData]) => {
      setChofer(choferData.chofer);
      setPrecios(preciosData.precios || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [params.choferId]);

  // Load route and pre-fill destinations
  useEffect(() => {
    if (!rutaId) return;
    (async () => {
      let loadedRoute: Route | null = null;
      if (user) {
        try {
          const headers = await getApiAuthHeader();
          const res = await fetch(`/api/routes/${rutaId}`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (data.route) loadedRoute = data.route;
          }
        } catch { /* fall through */ }
      }
      if (!loadedRoute) loadedRoute = getRoute(rutaId) ?? null;
      if (loadedRoute) {
        setRuta(loadedRoute);
        const stopNames = loadedRoute.stops.map(s => getStopName(s)).filter(Boolean);
        if (stopNames.length > 0) setDestinos(stopNames);
        // Auto-suggest duration based on number of stops
        if (loadedRoute.stops.length >= 6) setDuracion(8);
        else if (loadedRoute.stops.length >= 4) setDuracion(6);
      }
    })();
  }, [rutaId, user]);

  if (authLoading || loading) {
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
          <h2 className="title-md mb-3">Inicia sesión para solicitar un pueblear</h2>
          <button onClick={() => router.push(`/auth/login?redirect=/pueblear/solicitar/${params.choferId}`)} className="btn-primary">
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  if (!chofer) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: "var(--topbar-h)" }}>
        <p className="title-md">Chofer no encontrado</p>
      </div>
    );
  }

  // Get suggested price range
  const suggestedRange = precios.find(p => p.duracion_horas === duracion);

  function addDestino() {
    if (destinoInput.trim() && destinos.length < 10) {
      setDestinos([...destinos, destinoInput.trim()]);
      setDestinoInput("");
    }
  }

  const capacidadMax = chofer?.vehiculo?.capacidad_pasajeros || 4;

  async function handleSubmit() {
    setError("");
    if (!chofer) return;
    if (!fecha || !precioP || !usuarioFoto || !usuarioIne) {
      setError("Completa todos los campos obligatorios");
      return;
    }
    if (!puntoRecogida.trim()) {
      setError("Indica el punto de recogida");
      return;
    }
    if (numPasajeros > capacidadMax) {
      setError(`El vehículo tiene capacidad máxima de ${capacidadMax} pasajeros`);
      return;
    }

    setSubmitting(true);
    try {
      const headers = await getApiAuthHeader();
      const res = await fetch("/api/pueblear", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          chofer_id: chofer.id,
          fecha,
          hora_inicio: horaInicio,
          duracion_horas: duracion,
          num_pasajeros: numPasajeros,
          punto_recogida: puntoRecogida.trim(),
          punto_entrega: mismoLugar ? null : (puntoEntrega.trim() || null),
          destinos,
          notas: notas || undefined,
          precio_propuesto: Number(precioP),
          usuario_foto_url: usuarioFoto,
          usuario_ine_url: usuarioIne,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push(`/pueblear/${data.reserva.id}`);
    } catch {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  // Min date: tomorrow
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  return (
    <div className="min-h-screen" style={{ paddingTop: "calc(var(--topbar-h) + 16px)", paddingBottom: "calc(var(--bottomnav-h) + 24px)" }}>
      <div className="max-w-lg mx-auto px-4">
        <button onClick={() => router.back()} className="label-sm mb-4 flex items-center gap-1" style={{ color: "var(--primary)" }}>
          ← Volver
        </button>

        <h1 className="headline-md mb-2">
          {ruta ? "Solicitar chofer para tu ruta" : "Solicitar Pueblear"}
        </h1>

        {/* Route context */}
        {ruta && (
          <div
            className="mb-4 p-3 rounded-xl flex items-start gap-3"
            style={{
              background: "linear-gradient(135deg, rgba(45,125,98,0.08), rgba(196,98,45,0.06))",
              border: "1.5px solid rgba(45,125,98,0.15)",
            }}
          >
            <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>🗺️</span>
            <div className="min-w-0">
              <p className="title-md" style={{ marginBottom: 2 }}>{ruta.name}</p>
              <p className="label-sm" style={{ color: "var(--on-surface-variant)" }}>
                {ruta.stops.length} paradas · Los destinos se pre-llenaron de tu ruta
              </p>
            </div>
          </div>
        )}

        {/* Chofer mini card */}
        <div className="flex items-center gap-3 mb-6 p-3 rounded-xl" style={{ background: "var(--surface-container)" }}>
          <div
            className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{
              background: chofer.foto_url
                ? `url(${chofer.foto_url}) center/cover`
                : "linear-gradient(135deg, var(--primary), var(--primary-container))",
              color: "var(--on-primary)", fontWeight: 700,
            }}
          >
            {!chofer.foto_url && chofer.nombre_completo.charAt(0)}
          </div>
          <div>
            <p className="title-md">{chofer.nombre_completo}</p>
            <p className="label-sm" style={{ color: "var(--text-muted)" }}>
              {chofer.vehiculo ? `${chofer.vehiculo.marca} ${chofer.vehiculo.modelo}` : ""}
              {chofer.precio_base_hora ? ` · $${chofer.precio_base_hora}/hr` : ""}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg" style={{ background: "var(--error-container)", color: "var(--error)" }}>
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Date & time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-sm block mb-1">Fecha *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                min={tomorrow} className="input-field" />
            </div>
            <div>
              <label className="label-sm block mb-1">Hora de inicio *</label>
              <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} className="input-field" />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="label-sm block mb-1">Duración *</label>
            <div className="flex gap-2">
              {DURACIONES.map(d => (
                <button key={d.value} onClick={() => setDuracion(d.value)}
                  className="tag flex-1 text-center" style={{
                    background: duracion === d.value ? "var(--primary)" : "var(--surface-container-high)",
                    color: duracion === d.value ? "var(--on-primary)" : "var(--on-surface)",
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Passengers */}
          <div>
            <label className="label-sm block mb-1">Número de pasajeros *</label>
            <input type="number" value={numPasajeros} onChange={e => setNumPasajeros(Number(e.target.value))}
              min={1} max={capacidadMax} className="input-field" />
            <p className="label-sm mt-1" style={{ color: numPasajeros > capacidadMax ? "var(--error)" : "var(--text-muted)" }}>
              {numPasajeros > capacidadMax
                ? `⚠️ El vehículo solo tiene capacidad para ${capacidadMax} pasajeros`
                : `Capacidad del vehículo: ${capacidadMax} pasajeros`}
            </p>
          </div>

          {/* Pickup & Dropoff */}
          <div className="p-4 rounded-2xl" style={{ background: "var(--surface-container)" }}>
            <h3 className="title-md mb-3">Puntos de recogida y entrega</h3>
            <div className="space-y-3">
              <div>
                <label className="label-sm block mb-1">Punto de recogida *</label>
                <input type="text" value={puntoRecogida} onChange={e => setPuntoRecogida(e.target.value)}
                  placeholder="Ej: Hotel Hilton, Av. de las Rosas 2933" className="input-field" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={mismoLugar} onChange={e => setMismoLugar(e.target.checked)}
                  style={{ accentColor: "var(--primary)" }} />
                <span className="label-sm">Regresar al mismo punto de recogida</span>
              </label>
              {!mismoLugar && (
                <div>
                  <label className="label-sm block mb-1">Punto de entrega</label>
                  <input type="text" value={puntoEntrega} onChange={e => setPuntoEntrega(e.target.value)}
                    placeholder="Ej: Aeropuerto de Guadalajara" className="input-field" />
                </div>
              )}
            </div>
          </div>

          {/* Destinations */}
          <div>
            <label className="label-sm block mb-1">Destinos / Lugares a visitar</label>
            <div className="flex gap-2">
              <input type="text" value={destinoInput} onChange={e => setDestinoInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addDestino())}
                placeholder="Ej: Tequila, Chapala..." className="input-field flex-1" />
              <button onClick={addDestino} className="btn-ghost">+</button>
            </div>
            {destinos.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {destinos.map((d, i) => (
                  <span key={i} className="tag flex items-center gap-1">
                    {d}
                    <button onClick={() => setDestinos(destinos.filter((_, j) => j !== i))}
                      style={{ fontSize: "0.7rem" }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="label-sm block mb-1">Notas adicionales</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Detalles especiales, necesidades, etc." className="input-field" />
          </div>

          {/* Price */}
          <div className="p-4 rounded-2xl" style={{ background: "var(--surface-container)" }}>
            <label className="label-sm block mb-1">Tu oferta de precio (MXN) *</label>
            <input type="number" value={precioP} onChange={e => setPrecioP(e.target.value)}
              placeholder="1500" className="input-field" style={{ fontSize: "1.2rem", fontWeight: 600 }} />
            {suggestedRange && (
              <p className="label-sm mt-2" style={{ color: "var(--on-surface-variant)" }}>
                Rango sugerido para {duracion}h: <strong>${suggestedRange.precio_min} - ${suggestedRange.precio_max}</strong>
                <br />{suggestedRange.descripcion}
              </p>
            )}
            <p className="label-sm mt-1" style={{ color: "var(--text-muted)" }}>
              El chofer puede aceptar o hacer una contraoferta (1 sola ronda)
            </p>
          </div>

          {/* User verification */}
          <div className="p-4 rounded-2xl" style={{ background: "var(--surface-container)" }}>
            <h3 className="title-md mb-3">Verificación de identidad</h3>
            <p className="label-sm mb-3" style={{ color: "var(--on-surface-variant)" }}>
              Por seguridad, necesitamos verificar tu identidad
            </p>
            <div className="space-y-3">
              <FileUpload label="Tu fotografía *" bucket="usuarios-verificacion"
                value={usuarioFoto} onChange={setUsuarioFoto} accept="image/*" />
              <FileUpload label="INE o identificación *" bucket="usuarios-verificacion"
                value={usuarioIne} onChange={setUsuarioIne} accept="image/*,application/pdf" />
            </div>
          </div>

          <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full">
            {submitting ? "Enviando solicitud..." : "Enviar solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}
