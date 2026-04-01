"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ChoferPublico, Calificacion } from "@/types/choferes";
import { ZONAS_GDL } from "@/types/choferes";

export default function ChoferPerfilClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rutaId = searchParams.get("ruta");
  const [chofer, setChofer] = useState<ChoferPublico | null>(null);
  const [calificaciones, setCalificaciones] = useState<(Calificacion & { autor_nombre?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/choferes/${params.id}`)
      .then(r => r.json())
      .then(data => {
        setChofer(data.chofer);
        setCalificaciones(data.calificaciones || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: "var(--topbar-h)" }}>
        <div className="animate-pulse w-24 h-24 rounded-full" style={{ background: "var(--surface-container)" }} />
      </div>
    );
  }

  if (!chofer) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: "var(--topbar-h)" }}>
        <div className="text-center">
          <p className="title-md mb-3">Chofer no encontrado</p>
          <button onClick={() => router.push("/choferes")} className="btn-primary">Ver choferes</button>
        </div>
      </div>
    );
  }

  const zonaLabels = chofer.zonas_cobertura.map(z => ZONAS_GDL.find(gz => gz.id === z)?.label || z);

  return (
    <div className="min-h-screen" style={{ paddingTop: "calc(var(--topbar-h) + 16px)", paddingBottom: "calc(var(--bottomnav-h) + 80px)" }}>
      <div className="max-w-lg mx-auto px-4">
        {/* Back */}
        <button onClick={() => router.back()} className="label-sm mb-4 flex items-center gap-1" style={{ color: "var(--primary)" }}>
          ← Volver
        </button>

        {/* Profile header */}
        <div className="flex items-start gap-4 mb-6">
          <div
            className="w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{
              background: chofer.foto_url
                ? `url(${chofer.foto_url}) center/cover`
                : "linear-gradient(135deg, var(--primary), var(--primary-container))",
              color: "var(--on-primary)",
              fontSize: "2rem",
              fontWeight: 700,
            }}
          >
            {!chofer.foto_url && chofer.nombre_completo.charAt(0)}
          </div>
          <div>
            <h1 className="headline-md">{chofer.nombre_completo}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span style={{ color: "#E8B84B" }}>★</span>
              <span className="label-sm">
                {chofer.calificacion_promedio > 0
                  ? `${Number(chofer.calificacion_promedio).toFixed(1)} (${chofer.total_calificaciones} reseñas)`
                  : "Sin calificaciones aún"}
              </span>
            </div>
            <p className="label-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {chofer.total_viajes} viaje{chofer.total_viajes !== 1 ? "s" : ""} completado{chofer.total_viajes !== 1 ? "s" : ""}
              {chofer.anios_experiencia > 0 && ` · ${chofer.anios_experiencia} años de experiencia`}
            </p>
          </div>
        </div>

        {/* Bio */}
        {chofer.bio && (
          <div className="mb-6">
            <h2 className="title-md mb-2">Sobre mí</h2>
            <p className="body-lg" style={{ color: "var(--on-surface-variant)" }}>{chofer.bio}</p>
          </div>
        )}

        {/* Vehicle */}
        {chofer.vehiculo && (
          <div className="mb-6 p-4 rounded-2xl" style={{ background: "var(--surface-container)" }}>
            <h2 className="title-md mb-2">Vehículo</h2>
            <p className="body-lg">
              {chofer.vehiculo.marca} {chofer.vehiculo.modelo} {chofer.vehiculo.anio}
            </p>
            <p className="label-sm" style={{ color: "var(--on-surface-variant)" }}>
              {chofer.vehiculo.color} · Hasta {chofer.vehiculo.capacidad_pasajeros} pasajeros
            </p>
            {/* Vehicle photos */}
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {[chofer.vehiculo.foto_frente_url, chofer.vehiculo.foto_lateral_url, chofer.vehiculo.foto_interior_url]
                .filter(Boolean)
                .map((url, i) => (
                  <img key={i} src={url!} alt="Vehículo" className="w-24 h-18 rounded-lg object-cover flex-shrink-0" />
                ))}
            </div>
          </div>
        )}

        {/* Zones */}
        <div className="mb-6">
          <h2 className="title-md mb-2">Zonas de cobertura</h2>
          <div className="flex flex-wrap gap-2">
            {zonaLabels.map(z => (
              <span key={z} className="tag">{z}</span>
            ))}
          </div>
        </div>

        {/* Pricing */}
        {chofer.precio_base_hora && (
          <div className="mb-6 p-4 rounded-2xl" style={{ background: "var(--surface-container)" }}>
            <h2 className="title-md mb-1">Precio base</h2>
            <p className="headline-md" style={{ color: "var(--primary)" }}>
              ${chofer.precio_base_hora} <span className="body-lg" style={{ color: "var(--text-muted)" }}>/hora</span>
            </p>
            <p className="label-sm" style={{ color: "var(--on-surface-variant)" }}>
              El precio final se acuerda al solicitar el viaje
            </p>
          </div>
        )}

        {/* Reviews */}
        {calificaciones.length > 0 && (
          <div className="mb-6">
            <h2 className="title-md mb-3">Reseñas recientes</h2>
            <div className="space-y-3">
              {calificaciones.map((cal, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ background: "var(--surface-container)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: "#E8B84B" }}>
                      {"★".repeat(cal.puntuacion)}{"☆".repeat(5 - cal.puntuacion)}
                    </span>
                    <span className="label-sm" style={{ color: "var(--text-muted)" }}>
                      {cal.autor_nombre || "Anónimo"}
                    </span>
                  </div>
                  {cal.comentario && <p className="body-lg">{cal.comentario}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      {chofer.disponible && (
        <div
          className="fixed left-0 right-0 px-4 py-3"
          style={{
            bottom: "calc(var(--bottomnav-h) + var(--safe-bottom))",
            background: "var(--surface-container-lowest)",
            borderTop: "1px solid var(--outline)",
          }}
        >
          <Link
            href={`/pueblear/solicitar/${params.id}${rutaId ? `?ruta=${rutaId}` : ""}`}
            className="btn-primary w-full block text-center"
          >
            {rutaId ? "Solicitar chofer para mi ruta" : "Solicitar pueblear"}
          </Link>
        </div>
      )}
    </div>
  );
}
