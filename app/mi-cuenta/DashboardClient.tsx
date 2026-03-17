"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Place, Claim, ContentSubmission, UserProfile } from "@/types";

interface Props {
  profile: UserProfile;
  ownedPlaces: Place[];
  ownedEvents: any[];
  submissions: ContentSubmission[];
  claims: Claim[];
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  publicado:          { label: "Publicado",   bg: "#e8f4f0", color: "var(--jade)" },
  pendiente_revision: { label: "En revisión", bg: "#fef3e2", color: "#b7791f" },
  rechazado:          { label: "Rechazado",   bg: "#fde8e8", color: "#c53030" },
  pending:            { label: "En revisión", bg: "#fef3e2", color: "#b7791f" },
  approved:           { label: "Aprobada",    bg: "#e8f4f0", color: "var(--jade)" },
  rejected:           { label: "Rechazada",   bg: "#fde8e8", color: "#c53030" },
};

export default function DashboardClient({ profile, ownedPlaces, ownedEvents, submissions, claims }: Props) {
  const { signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toastParam = searchParams.get("toast");

  const [tab, setTab] = useState<"content" | "claims" | "add">("content");
  const [toast, setToast] = useState<string | null>(
    toastParam === "lugar_en_revision" ? "Tu lugar está en revisión, te avisaremos cuando sea aprobado"
      : toastParam === "evento_en_revision" ? "Tu evento está en revisión, te avisaremos cuando sea aprobado"
      : toastParam === "claim_enviado" ? "Tu solicitud fue enviada. El equipo la revisará pronto."
      : null
  );

  const TAB_STYLE = (active: boolean) => ({
    flex: 1,
    padding: "10px 0",
    background: "none",
    border: "none",
    borderBottom: active ? "2px solid var(--terracota)" : "2px solid transparent",
    color: active ? "var(--terracota)" : "var(--text-muted)",
    fontWeight: active ? 700 : 400,
    fontSize: "0.875rem",
    cursor: "pointer",
    transition: "all 0.15s",
  });

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div
          style={{
            background: "var(--jade)",
            color: "#fff",
            borderRadius: "var(--r-md)",
            padding: "12px 16px",
            marginBottom: 20,
            fontSize: "0.875rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>✓ {toast}</span>
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "1.1rem" }}>×</button>
        </div>
      )}

      {/* Profile card */}
      <div
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "16px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 16,
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          style={{
            width: 48, height: 48,
            borderRadius: "50%",
            background: "var(--terracota)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: "1.2rem",
            flexShrink: 0,
          }}
        >
          {profile.display_name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, color: "var(--text)", fontSize: "1rem", marginBottom: 2 }}>
            {profile.display_name}
          </p>
          <span
            style={{
              fontSize: "0.7rem",
              padding: "2px 8px",
              borderRadius: "var(--r-full)",
              background: profile.trust_level === "admin" ? "#1a1410" : profile.trust_level === "verified" ? "#e8f4f0" : "var(--bg-muted)",
              color: profile.trust_level === "admin" ? "#fff" : profile.trust_level === "verified" ? "var(--jade)" : "var(--text-muted)",
              fontWeight: 600,
            }}
          >
            {profile.trust_level === "admin" ? "⚙ Admin" : profile.trust_level === "verified" ? "✓ Verificado" : "Nuevo"}
          </span>
        </div>
        <button
          onClick={signOut}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-full)",
            padding: "6px 14px",
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          Salir
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        <button style={TAB_STYLE(tab === "content")} onClick={() => setTab("content")}>
          Mi contenido ({ownedPlaces.length + ownedEvents.length + submissions.filter(s => s.status !== "publicado").length})
        </button>
        <button style={TAB_STYLE(tab === "claims")} onClick={() => setTab("claims")}>
          Solicitudes ({claims.length})
        </button>
        <button style={TAB_STYLE(tab === "add")} onClick={() => setTab("add")}>
          Agregar
        </button>
      </div>

      {/* Mi contenido */}
      {tab === "content" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Owned places */}
          {ownedPlaces.map((p) => (
            <Link
              key={p.id}
              href={`/lugar/${p.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: "var(--shadow-card)",
                }}
              >
                {p.photos[0] && (
                  <img src={p.photos[0]} alt={p.name} style={{ width: 48, height: 48, borderRadius: "var(--r-sm)", objectFit: "cover", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.95rem", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                  <p className="label-muted" style={{ fontSize: "0.78rem" }}>{p.town}, {p.state}</p>
                </div>
                <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "var(--r-full)", ...STATUS_BADGE["publicado"] }}>
                  {STATUS_BADGE["publicado"].label}
                </span>
              </div>
            </Link>
          ))}

          {/* Owned events */}
          {ownedEvents.map((e) => (
            <Link
              key={e.id}
              href={`/evento/${e.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: "var(--shadow-card)",
                }}
              >
                {e.image_url ? (
                  <img src={e.image_url} alt={e.title} style={{ width: 48, height: 48, borderRadius: "var(--r-sm)", objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: "var(--r-sm)", background: "var(--bg-muted)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>
                    🎉
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.95rem", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</p>
                  <p className="label-muted" style={{ fontSize: "0.78rem" }}>{e.city}, {e.state}</p>
                </div>
                <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "var(--r-full)", ...STATUS_BADGE["publicado"] }}>
                  {STATUS_BADGE["publicado"].label}
                </span>
              </div>
            </Link>
          ))}

          {/* Pending submissions */}
          {submissions.filter(s => s.status !== "publicado").map((s) => {
            const p = s.payload as Record<string, unknown>;
            const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE["pendiente_revision"];
            return (
              <div
                key={s.id}
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: "var(--shadow-card)",
                  opacity: s.status === "rechazado" ? 0.6 : 1,
                }}
              >
                <div style={{ width: 48, height: 48, borderRadius: "var(--r-sm)", background: "var(--bg-muted)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>
                  {s.content_type === "place" ? "📍" : "🎉"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.95rem", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {String(p.name ?? p.title ?? "Sin título")}
                  </p>
                  <p className="label-muted" style={{ fontSize: "0.78rem" }}>{s.content_type === "place" ? "Lugar" : "Evento"}</p>
                </div>
                <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "var(--r-full)", background: badge.bg, color: badge.color, fontWeight: 600, flexShrink: 0 }}>
                  {badge.label}
                </span>
              </div>
            );
          })}

          {ownedPlaces.length === 0 && ownedEvents.length === 0 && submissions.filter(s => s.status !== "publicado").length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "2rem", marginBottom: 8 }}>🗺️</p>
              <p style={{ marginBottom: 16 }}>Aún no has compartido nada</p>
              <button
                onClick={() => setTab("add")}
                className="btn-primary"
                style={{ height: 40, padding: "0 20px", fontSize: "0.875rem" }}
              >
                Compartir mi primer lugar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Claims */}
      {tab === "claims" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {claims.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "2rem", marginBottom: 8 }}>📋</p>
              <p>Sin solicitudes de reclamación</p>
            </div>
          )}
          {claims.map((c) => {
            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE["pending"];
            return (
              <div
                key={c.id}
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: "var(--r-sm)", background: "var(--bg-muted)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
                  {c.content_type === "place" ? "📍" : "🎉"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.9rem", marginBottom: 2 }}>
                    Reclamación #{c.content_id}
                  </p>
                  <p className="label-muted" style={{ fontSize: "0.78rem" }}>
                    {new Date(c.created_at).toLocaleDateString("es-MX")}
                  </p>
                  {c.admin_note && (
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 4, fontStyle: "italic" }}>
                      Nota: {c.admin_note}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "var(--r-full)", background: badge.bg, color: badge.color, fontWeight: 600, flexShrink: 0 }}>
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Agregar */}
      {tab === "add" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Link href="/contribuir/lugar" style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "var(--bg)",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                cursor: "pointer",
                boxShadow: "var(--shadow-card)",
                transition: "box-shadow 0.15s",
              }}
            >
              <div style={{ fontSize: "2rem" }}>📍</div>
              <div>
                <p style={{ fontWeight: 700, color: "var(--text)", fontSize: "1rem", marginBottom: 3 }}>Compartir un lugar</p>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Taquería, cenote, mercado, taller artesanal...</p>
              </div>
            </div>
          </Link>

          <Link href="/contribuir/evento" style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "var(--bg)",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                cursor: "pointer",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div style={{ fontSize: "2rem" }}>🎉</div>
              <div>
                <p style={{ fontWeight: 700, color: "var(--text)", fontSize: "1rem", marginBottom: 3 }}>Publicar un evento</p>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Festival, feria, exposición, concierto...</p>
              </div>
            </div>
          </Link>

          {profile.trust_level !== "new" && (
            <p style={{ fontSize: "0.8rem", color: "var(--jade)", textAlign: "center", padding: "8px 0" }}>
              ✓ Tu cuenta está verificada. Tu contenido se publica de inmediato.
            </p>
          )}
          {profile.trust_level === "new" && (
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
              Tu contenido pasará por revisión antes de publicarse.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
