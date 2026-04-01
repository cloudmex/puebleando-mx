"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { getApiAuthHeader } from "@/lib/apiAuth";
import type { Reserva, Mensaje } from "@/types/choferes";

/** Reserva with joined fields from the API */
interface ReservaJoined extends Reserva {
  chofer_nombre?: string;
  chofer_foto?: string;
  chofer_telefono?: string;
  chofer_calificacion?: number;
  chofer_user_id?: string;
  usuario_nombre?: string;
  vehiculo_marca?: string;
  vehiculo_modelo?: string;
  vehiculo_anio?: number;
  vehiculo_color?: string;
  vehiculo_capacidad?: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Pendiente de respuesta", color: "var(--on-surface)", bg: "var(--surface-container-high)" },
  contraoferta: { label: "Contraoferta del chofer", color: "#B8860B", bg: "#FFF8E1" },
  aceptada: { label: "Aceptada — pendiente confirmación", color: "var(--secondary)", bg: "var(--secondary-container)" },
  confirmada: { label: "Confirmada", color: "var(--tertiary)", bg: "var(--tertiary-container)" },
  en_curso: { label: "En curso", color: "var(--primary)", bg: "var(--primary-container)" },
  completada: { label: "Completada", color: "var(--secondary)", bg: "var(--secondary-container)" },
  cancelada: { label: "Cancelada", color: "var(--error)", bg: "var(--error-container)" },
  expirada: { label: "Expirada", color: "var(--text-muted)", bg: "var(--surface-container-high)" },
};

export default function ReservaDetailClient() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [reserva, setReserva] = useState<ReservaJoined | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msgInput, setMsgInput] = useState("");
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isChofer = reserva && user && reserva.chofer_user_id === user.id;
  const isUsuario = reserva && user && reserva.usuario_id === user.id;

  const fetchReserva = useCallback(async () => {
    try {
      const headers = await getApiAuthHeader();
      const res = await fetch(`/api/pueblear/${params.id}`, { headers });
      const data = await res.json();
      setReserva(data.reserva);
    } catch {}
  }, [params.id]);

  const fetchMensajes = useCallback(async () => {
    try {
      const headers = await getApiAuthHeader();
      const res = await fetch(`/api/pueblear/${params.id}/mensajes`, { headers });
      const data = await res.json();
      setMensajes(data.mensajes || []);
      setChatEnabled(data.chat_habilitado || false);
    } catch {}
  }, [params.id]);

  useEffect(() => {
    Promise.all([fetchReserva(), fetchMensajes()]).finally(() => setLoading(false));
    // Poll messages every 10s
    const interval = setInterval(fetchMensajes, 10000);
    return () => clearInterval(interval);
  }, [fetchReserva, fetchMensajes]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  async function doAction(endpoint: string, body: Record<string, unknown> = {}) {
    setActionLoading(true);
    try {
      const headers = await getApiAuthHeader();
      const res = await fetch(`/api/pueblear/${params.id}/${endpoint}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) await fetchReserva();
    } catch {}
    setActionLoading(false);
  }

  async function sendMessage() {
    if (!msgInput.trim()) return;
    const headers = await getApiAuthHeader();
    await fetch(`/api/pueblear/${params.id}/mensajes`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ contenido: msgInput.trim() }),
    });
    setMsgInput("");
    await fetchMensajes();
  }

  async function submitRating() {
    if (rating < 1) return;
    await doAction("calificar", { puntuacion: rating, comentario: ratingComment || undefined });
    setShowRating(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: "var(--topbar-h)" }}>
        <p className="label-sm" style={{ color: "var(--text-muted)" }}>Cargando...</p>
      </div>
    );
  }

  if (!reserva) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: "var(--topbar-h)" }}>
        <p className="title-md">Reserva no encontrada</p>
      </div>
    );
  }

  const r = reserva;
  const st = STATUS_LABELS[reserva.status] || STATUS_LABELS.pendiente;

  return (
    <div className="min-h-screen" style={{ paddingTop: "calc(var(--topbar-h) + 16px)", paddingBottom: "calc(var(--bottomnav-h) + 80px)" }}>
      <div className="max-w-lg mx-auto px-4">
        <button onClick={() => router.push("/pueblear")} className="label-sm mb-4 flex items-center gap-1" style={{ color: "var(--primary)" }}>
          ← Mis puebleadas
        </button>

        {/* Status badge */}
        <div className="mb-4 p-3 rounded-xl text-center" style={{ background: st.bg, color: st.color }}>
          <span className="title-md">{st.label}</span>
        </div>

        {/* Trip details */}
        <div className="p-4 rounded-2xl mb-4" style={{ background: "var(--surface-container)" }}>
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="label-sm" style={{ color: "var(--text-muted)" }}>
                {isChofer ? "Viajero" : "Chofer"}
              </p>
              <p className="title-md">
                {isChofer ? (r.usuario_nombre || "Viajero") : (r.chofer_nombre || "Chofer")}
              </p>
            </div>
            {r.chofer_foto && !isChofer && (
              <div className="w-10 h-10 rounded-full" style={{ background: `url(${r.chofer_foto}) center/cover` }} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="label-sm" style={{ color: "var(--text-muted)" }}>Fecha</p>
              <p className="body-lg">
                {new Date(reserva.fecha).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
            <div>
              <p className="label-sm" style={{ color: "var(--text-muted)" }}>Hora</p>
              <p className="body-lg">{reserva.hora_inicio?.slice(0, 5)} · {reserva.duracion_horas}h</p>
            </div>
            <div>
              <p className="label-sm" style={{ color: "var(--text-muted)" }}>Pasajeros</p>
              <p className="body-lg">{reserva.num_pasajeros}</p>
            </div>
            {r.vehiculo_marca && (
              <div>
                <p className="label-sm" style={{ color: "var(--text-muted)" }}>Vehículo</p>
                <p className="body-lg">{r.vehiculo_marca} {r.vehiculo_modelo}</p>
              </div>
            )}
          </div>

          {/* Pickup & Dropoff */}
          <div className="mt-3 grid grid-cols-1 gap-2">
            {reserva.punto_recogida && (
              <div className="flex items-start gap-2">
                <span style={{ color: "var(--secondary)", fontSize: "0.9rem", flexShrink: 0, marginTop: 2 }}>📍</span>
                <div>
                  <p className="label-sm" style={{ color: "var(--text-muted)" }}>Recogida</p>
                  <p className="body-lg">{reserva.punto_recogida}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <span style={{ color: "var(--primary)", fontSize: "0.9rem", flexShrink: 0, marginTop: 2 }}>🏁</span>
              <div>
                <p className="label-sm" style={{ color: "var(--text-muted)" }}>Entrega</p>
                <p className="body-lg">{reserva.punto_entrega || reserva.punto_recogida || "Mismo punto de recogida"}</p>
              </div>
            </div>
          </div>

          {reserva.destinos && reserva.destinos.length > 0 && (
            <div className="mt-3">
              <p className="label-sm" style={{ color: "var(--text-muted)" }}>Destinos a recorrer</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {reserva.destinos.map((d, i) => <span key={i} className="tag">{d}</span>)}
              </div>
            </div>
          )}

          {reserva.notas && (
            <div className="mt-3">
              <p className="label-sm" style={{ color: "var(--text-muted)" }}>Notas</p>
              <p className="body-lg">{reserva.notas}</p>
            </div>
          )}
        </div>

        {/* Pricing section */}
        <div className="p-4 rounded-2xl mb-4" style={{ background: "var(--surface-container)" }}>
          <h3 className="title-md mb-2">Precio</h3>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="label-sm">Oferta del viajero</span>
              <span className="body-lg">${reserva.precio_propuesto} MXN</span>
            </div>
            {reserva.precio_contraoferta && (
              <div className="flex justify-between">
                <span className="label-sm">Contraoferta del chofer</span>
                <span className="body-lg" style={{ fontWeight: 600 }}>${reserva.precio_contraoferta} MXN</span>
              </div>
            )}
            {reserva.precio_final && (
              <div className="flex justify-between pt-2" style={{ borderTop: "1px solid var(--outline)" }}>
                <span className="title-md">Precio acordado</span>
                <span className="title-md" style={{ color: "var(--primary)" }}>${reserva.precio_final} MXN</span>
              </div>
            )}
          </div>
        </div>

        {/* Negotiation actions */}
        {reserva.status === "pendiente" && isChofer && (
          <NegotiationActions
            onAccept={() => doAction("negociar", { accion: "aceptar" })}
            onReject={() => doAction("negociar", { accion: "rechazar" })}
            onCounter={(precio) => doAction("negociar", { accion: "contraoferta", precio_contraoferta: precio })}
            loading={actionLoading}
            precioOriginal={reserva.precio_propuesto}
          />
        )}

        {reserva.status === "contraoferta" && isUsuario && (
          <div className="p-4 rounded-2xl mb-4" style={{ background: "var(--surface-container)" }}>
            <p className="title-md mb-3">El chofer propone ${reserva.precio_contraoferta} MXN</p>
            <div className="flex gap-2">
              <button onClick={() => doAction("negociar", { accion: "aceptar" })}
                disabled={actionLoading} className="btn-primary flex-1">
                Aceptar
              </button>
              <button onClick={() => doAction("negociar", { accion: "rechazar" })}
                disabled={actionLoading} className="btn-ghost flex-1"
                style={{ border: "1px solid var(--error)", color: "var(--error)" }}>
                Rechazar
              </button>
            </div>
            <p className="label-sm mt-2 text-center" style={{ color: "var(--text-muted)" }}>
              Si rechazas, deberás crear una nueva solicitud
            </p>
          </div>
        )}

        {reserva.status === "aceptada" && isChofer && (
          <div className="mb-4">
            <button onClick={() => doAction("confirmar")} disabled={actionLoading}
              className="btn-primary w-full">
              {actionLoading ? "Confirmando..." : "Confirmar viaje"}
            </button>
          </div>
        )}

        {(reserva.status === "confirmada" || reserva.status === "en_curso") && isChofer && (
          <div className="mb-4">
            <button onClick={() => doAction("completar")} disabled={actionLoading}
              className="btn-primary w-full">
              {actionLoading ? "..." : "Marcar como completado"}
            </button>
          </div>
        )}

        {/* Cancel button */}
        {["pendiente", "contraoferta", "aceptada", "confirmada"].includes(reserva.status) && (
          <div className="mb-4">
            <button onClick={() => {
              if (confirm("¿Seguro que quieres cancelar esta puebleada?")) {
                doAction("cancelar", { motivo: "Cancelado por el usuario" });
              }
            }} disabled={actionLoading}
              className="btn-ghost w-full" style={{ color: "var(--error)" }}>
              Cancelar puebleada
            </button>
          </div>
        )}

        {/* Rating */}
        {reserva.status === "completada" && !showRating && (
          <div className="mb-4">
            <button onClick={() => setShowRating(true)} className="btn-secondary w-full">
              Calificar viaje
            </button>
          </div>
        )}
        {showRating && (
          <div className="p-4 rounded-2xl mb-4" style={{ background: "var(--surface-container)" }}>
            <h3 className="title-md mb-3">Califica tu experiencia</h3>
            <div className="flex gap-2 justify-center mb-3">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRating(n)} style={{ fontSize: "1.8rem", color: n <= rating ? "#E8B84B" : "var(--outline)" }}>
                  ★
                </button>
              ))}
            </div>
            <textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)}
              placeholder="Comentario opcional..." rows={2} className="input-field mb-3" />
            <button onClick={submitRating} disabled={rating < 1 || actionLoading} className="btn-primary w-full">
              Enviar calificación
            </button>
          </div>
        )}

        {/* Chat */}
        {chatEnabled && (
          <div className="mt-6">
            <h3 className="title-md mb-3">Mensajes</h3>
            <div className="space-y-2 mb-3 max-h-80 overflow-y-auto p-3 rounded-2xl" style={{ background: "var(--surface-container)" }}>
              {mensajes.length === 0 ? (
                <p className="label-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
                  Sin mensajes aún. Coordina los detalles de tu viaje aquí.
                </p>
              ) : (
                mensajes.map(m => {
                  const isMine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[80%] p-2.5 rounded-2xl" style={{
                        background: isMine ? "var(--primary)" : "var(--surface-container-lowest)",
                        color: isMine ? "var(--on-primary)" : "var(--on-surface)",
                        borderBottomRightRadius: isMine ? "4px" : undefined,
                        borderBottomLeftRadius: !isMine ? "4px" : undefined,
                      }}>
                        {!isMine && (
                          <p className="label-sm mb-0.5" style={{ opacity: 0.7 }}>{m.sender_nombre}</p>
                        )}
                        <p className="body-lg" style={{ fontSize: "0.9rem" }}>{m.contenido}</p>
                        <p className="label-sm text-right mt-0.5" style={{ opacity: 0.5, fontSize: "0.65rem" }}>
                          {new Date(m.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            {["aceptada", "confirmada", "en_curso"].includes(reserva.status) && (
              <div className="flex gap-2">
                <input type="text" value={msgInput} onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  placeholder="Escribe un mensaje..." className="input-field flex-1" />
                <button onClick={sendMessage} className="btn-primary px-4">Enviar</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Negotiation UI for chofer */
function NegotiationActions({ onAccept, onReject, onCounter, loading, precioOriginal }: {
  onAccept: () => void;
  onReject: () => void;
  onCounter: (precio: number) => void;
  loading: boolean;
  precioOriginal: number;
}) {
  const [showCounter, setShowCounter] = useState(false);
  const [counterPrice, setCounterPrice] = useState(String(precioOriginal));

  return (
    <div className="p-4 rounded-2xl mb-4" style={{ background: "var(--surface-container)" }}>
      <h3 className="title-md mb-3">El viajero ofrece ${precioOriginal} MXN</h3>

      {!showCounter ? (
        <div className="space-y-2">
          <button onClick={onAccept} disabled={loading} className="btn-primary w-full">
            Aceptar precio
          </button>
          <button onClick={() => setShowCounter(true)} disabled={loading}
            className="btn-secondary w-full">
            Hacer contraoferta
          </button>
          <button onClick={onReject} disabled={loading}
            className="btn-ghost w-full" style={{ color: "var(--error)" }}>
            Rechazar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label-sm block mb-1">Tu contraoferta (MXN)</label>
            <input type="number" value={counterPrice} onChange={e => setCounterPrice(e.target.value)}
              className="input-field" style={{ fontSize: "1.2rem", fontWeight: 600 }} />
          </div>
          <button onClick={() => onCounter(Number(counterPrice))} disabled={loading || !counterPrice}
            className="btn-primary w-full">
            {loading ? "Enviando..." : "Enviar contraoferta"}
          </button>
          <button onClick={() => setShowCounter(false)} className="btn-ghost w-full">
            Cancelar
          </button>
          <p className="label-sm text-center" style={{ color: "var(--text-muted)" }}>
            Solo hay 1 ronda de negociación. Si el viajero rechaza, deberá crear una nueva solicitud.
          </p>
        </div>
      )}
    </div>
  );
}
