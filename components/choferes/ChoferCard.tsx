"use client";
import Link from "next/link";
import type { ChoferPublico } from "@/types/choferes";

export default function ChoferCard({ chofer, rutaId }: { chofer: ChoferPublico; rutaId?: string }) {
  const href = rutaId ? `/choferes/${chofer.id}?ruta=${rutaId}` : `/choferes/${chofer.id}`;
  return (
    <Link
      href={href}
      className="block rounded-2xl overflow-hidden transition-shadow"
      style={{
        background: "var(--surface-container-lowest)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex gap-4 p-4">
        {/* Avatar */}
        <div
          className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center"
          style={{
            background: chofer.foto_url
              ? `url(${chofer.foto_url}) center/cover`
              : "linear-gradient(135deg, var(--primary), var(--primary-container))",
            color: "var(--on-primary)",
            fontSize: "1.5rem",
            fontWeight: 700,
          }}
        >
          {!chofer.foto_url && chofer.nombre_completo.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="title-md truncate">{chofer.nombre_completo}</h3>

          {/* Rating */}
          <div className="flex items-center gap-1 mt-1">
            <span style={{ color: "#E8B84B" }}>★</span>
            <span className="label-sm">
              {chofer.calificacion_promedio > 0
                ? `${Number(chofer.calificacion_promedio).toFixed(1)} (${chofer.total_calificaciones})`
                : "Nuevo"}
            </span>
            <span className="label-sm" style={{ color: "var(--text-muted)" }}>
              · {chofer.total_viajes} viaje{chofer.total_viajes !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Vehicle */}
          {chofer.vehiculo && (
            <p className="label-sm mt-1" style={{ color: "var(--on-surface-variant)" }}>
              {chofer.vehiculo.marca} {chofer.vehiculo.modelo} {chofer.vehiculo.anio} · {chofer.vehiculo.capacidad_pasajeros} pasajeros
            </p>
          )}

          {/* Zones */}
          {chofer.zonas_cobertura.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {chofer.zonas_cobertura.slice(0, 3).map(z => (
                <span key={z} className="tag" style={{ fontSize: "0.65rem", padding: "2px 8px" }}>
                  {z}
                </span>
              ))}
              {chofer.zonas_cobertura.length > 3 && (
                <span className="label-sm" style={{ color: "var(--text-muted)" }}>
                  +{chofer.zonas_cobertura.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Price & availability */}
        <div className="flex flex-col items-end justify-between">
          {chofer.disponible ? (
            <span className="label-sm px-2 py-0.5 rounded-full" style={{ background: "var(--tertiary-container)", color: "var(--tertiary)" }}>
              Disponible
            </span>
          ) : (
            <span className="label-sm px-2 py-0.5 rounded-full" style={{ background: "var(--surface-container-high)", color: "var(--text-muted)" }}>
              No disponible
            </span>
          )}
          {chofer.precio_base_hora && (
            <span className="label-sm" style={{ color: "var(--primary)", fontWeight: 600 }}>
              ${chofer.precio_base_hora}/hr
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
