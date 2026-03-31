"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Place, Claim, ContentSubmission, UserProfile, Route } from "@/types";
import { getStopImage, getStopCategory } from "@/types";
import { CATEGORIES } from "@/lib/data";

interface Props {
  profile: UserProfile;
  ownedPlaces: Place[];
  ownedEvents: any[];
  submissions: ContentSubmission[];
  claims: Claim[];
  routes: Route[];
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  publicado:          { label: "Publicado",   bg: "#e8f4f0", color: "var(--jade)" },
  pendiente_revision: { label: "En revision", bg: "#fef3e2", color: "#b7791f" },
  rechazado:          { label: "Rechazado",   bg: "#fde8e8", color: "#c53030" },
  pending:            { label: "En revision", bg: "#fef3e2", color: "#b7791f" },
  approved:           { label: "Aprobada",    bg: "#e8f4f0", color: "var(--jade)" },
  rejected:           { label: "Rechazada",   bg: "#fde8e8", color: "#c53030" },
};

function formatMemberSince(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

export default function DashboardClient({ profile, ownedPlaces, ownedEvents, submissions, claims, routes }: Props) {
  const { signOut } = useAuth();

  const [tab, setTab] = useState<"routes" | "activity">("routes");
  const [toast, setToast] = useState<string | null>(null);

  // Read toast param from URL without useSearchParams (avoids Suspense requirement)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tp = params.get("toast");
    if (tp === "lugar_en_revision") setToast("Tu lugar esta en revision, te avisaremos cuando sea aprobado");
    else if (tp === "evento_en_revision") setToast("Tu evento esta en revision, te avisaremos cuando sea aprobado");
    else if (tp === "claim_enviado") setToast("Tu solicitud fue enviada. El equipo la revisara pronto.");
  }, []);

  const totalStops = routes.reduce((sum, r) => sum + r.stops.length, 0);
  const totalContent = ownedPlaces.length + ownedEvents.length;
  const firstName = profile.display_name?.split(" ")[0] ?? profile.display_name;
  const memberSince = formatMemberSince(profile.created_at);

  // Merge content + claims into a single "activity" list
  const activityItems: { key: string; type: "place" | "event" | "submission" | "claim"; date: string; node: React.ReactNode }[] = [];

  ownedPlaces.forEach((p) => activityItems.push({
    key: `place-${p.id}`,
    type: "place",
    date: p.created_at ?? "",
    node: (
      <Link href={`/lugar/${p.id}`} style={{ textDecoration: "none" }}>
        <ActivityRow
          thumb={p.photos[0] ? <img src={p.photos[0]} alt={p.name} style={{ width: 44, height: 44, borderRadius: "var(--r-sm)", objectFit: "cover" }} /> : undefined}
          icon="📍"
          title={p.name}
          subtitle={`${p.town}, ${p.state}`}
          badge={STATUS_BADGE["publicado"]}
        />
      </Link>
    ),
  }));

  ownedEvents.forEach((e) => activityItems.push({
    key: `event-${e.id}`,
    type: "event",
    date: e.created_at ?? "",
    node: (
      <Link href={`/evento/${e.id}`} style={{ textDecoration: "none" }}>
        <ActivityRow
          thumb={e.image_url ? <img src={e.image_url} alt={e.title} style={{ width: 44, height: 44, borderRadius: "var(--r-sm)", objectFit: "cover" }} /> : undefined}
          icon="🎉"
          title={e.title}
          subtitle={`${e.city}, ${e.state}`}
          badge={STATUS_BADGE["publicado"]}
        />
      </Link>
    ),
  }));

  submissions.filter(s => s.status !== "publicado").forEach((s) => {
    const p = s.payload as Record<string, unknown>;
    const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE["pendiente_revision"];
    activityItems.push({
      key: `sub-${s.id}`,
      type: "submission",
      date: s.created_at ?? "",
      node: (
        <ActivityRow
          icon={s.content_type === "place" ? "📍" : "🎉"}
          title={String(p.name ?? p.title ?? "Sin titulo")}
          subtitle={s.content_type === "place" ? "Lugar" : "Evento"}
          badge={badge}
          dimmed={s.status === "rechazado"}
        />
      ),
    });
  });

  claims.forEach((c) => {
    const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE["pending"];
    activityItems.push({
      key: `claim-${c.id}`,
      type: "claim",
      date: c.created_at ?? "",
      node: (
        <ActivityRow
          icon={c.content_type === "place" ? "📍" : "🎉"}
          title={`Reclamacion #${c.content_id}`}
          subtitle={new Date(c.created_at).toLocaleDateString("es-MX")}
          badge={badge}
          extra={c.admin_note ? <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 4, fontStyle: "italic" }}>Nota: {c.admin_note}</p> : undefined}
        />
      ),
    });
  });

  // Sort by date, newest first
  activityItems.sort((a, b) => (b.date > a.date ? 1 : -1));

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
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
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ paddingBottom: "calc(var(--bottomnav-h) + var(--safe-bottom) + 20px)" }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            background: "var(--jade)",
            color: "#fff",
            borderRadius: "var(--r-md)",
            padding: "12px 16px",
            margin: "0 16px 0",
            fontSize: "0.875rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <span>✓ {toast}</span>
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "1.1rem" }}>×</button>
        </div>
      )}

      {/* ── Personalized header ── */}
      <div style={{ background: "var(--surface-container-low)", padding: "24px 20px 20px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          {/* Avatar + greeting */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "var(--r-full)",
                background: "linear-gradient(135deg, var(--primary), var(--primary-container))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: "1.3rem",
                fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
                flexShrink: 0,
              }}
            >
              {profile.display_name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                style={{
                  fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: "var(--on-surface)",
                  marginBottom: 2,
                  lineHeight: 1.2,
                }}
              >
                Hola, {firstName}
              </h1>
              <p style={{ fontSize: "0.82rem", color: "var(--on-surface-variant)", lineHeight: 1.3 }}>
                {memberSince ? `Explorador desde ${memberSince}` : "Explorador"}
                {profile.trust_level === "verified" && " · Verificado"}
                {profile.trust_level === "admin" && " · Admin"}
              </p>
            </div>
          </div>

          {/* Stats tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <StatTile value={routes.length} label="Rutas" />
            <StatTile value={totalStops} label="Paradas" />
            <StatTile value={totalContent} label="Compartidos" />
          </div>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 16px 0" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <Link
            href="/rutas"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              height: 44,
              borderRadius: "var(--r-full)",
              background: "linear-gradient(135deg, var(--primary), var(--primary-container))",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.82rem",
              textDecoration: "none",
              fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nueva ruta
          </Link>
          <Link
            href="/contribuir/lugar"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              height: 44,
              borderRadius: "var(--r-full)",
              background: "none",
              border: "1.5px solid var(--border-strong)",
              color: "var(--on-surface)",
              fontWeight: 600,
              fontSize: "0.82rem",
              textDecoration: "none",
              fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
            }}
          >
            📍 Compartir lugar
          </Link>
        </div>

        {/* ── Tabs: Rutas | Actividad ── */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
          <button style={TAB_STYLE(tab === "routes")} onClick={() => setTab("routes")}>
            Mis rutas ({routes.length})
          </button>
          <button style={TAB_STYLE(tab === "activity")} onClick={() => setTab("activity")}>
            Actividad ({activityItems.length})
          </button>
        </div>

        {/* ── Tab: Rutas ── */}
        {tab === "routes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {routes.length === 0 && (
              <div style={{ textAlign: "center", padding: "36px 0", color: "var(--text-muted)" }}>
                <p style={{ fontSize: "2.5rem", marginBottom: 10 }}>🗺️</p>
                <p className="headline-md" style={{ marginBottom: 6, color: "var(--on-surface)" }}>
                  Crea tu primera ruta
                </p>
                <p style={{ fontSize: "0.85rem", marginBottom: 20, lineHeight: 1.5, maxWidth: 260, margin: "0 auto 20px" }}>
                  Explora lugares y agregalos a una ruta para planear tu viaje perfecto
                </p>
                <Link
                  href="/explorar"
                  className="btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 44, padding: "0 24px", fontSize: "0.875rem", textDecoration: "none" }}
                >
                  Explorar lugares
                </Link>
              </div>
            )}
            {routes.map((route) => {
              const categories = [...new Set(route.stops.map((s) => getStopCategory(s)))];
              const firstPhoto = route.stops[0] ? getStopImage(route.stops[0]) : undefined;
              return (
                <Link key={route.id} href={`/rutas/${route.id}`} style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      background: "var(--surface-container-lowest)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-md)",
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      boxShadow: "var(--shadow-card)",
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: "var(--r-sm)",
                        flexShrink: 0,
                        backgroundImage: firstPhoto ? `url(${firstPhoto})` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        background: firstPhoto ? undefined : "var(--surface-container-high)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.4rem",
                      }}
                    >
                      {!firstPhoto && "🗺️"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontWeight: 600,
                        color: "var(--on-surface)",
                        fontSize: "0.95rem",
                        marginBottom: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>{route.name}</p>
                      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 4 }}>
                        {route.stops.length} {route.stops.length === 1 ? "parada" : "paradas"}
                      </p>
                      <div style={{ display: "flex", gap: 4 }}>
                        {categories.slice(0, 4).map((catId) => {
                          const cat = CATEGORIES.find((c) => c.id === catId);
                          return cat ? <span key={catId} style={{ fontSize: "0.85rem" }} title={cat.name}>{cat.icon}</span> : null;
                        })}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ── Tab: Actividad (content + claims merged) ── */}
        {tab === "activity" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activityItems.length === 0 && (
              <div style={{ textAlign: "center", padding: "36px 0", color: "var(--text-muted)" }}>
                <p style={{ fontSize: "2.5rem", marginBottom: 10 }}>📋</p>
                <p className="headline-md" style={{ marginBottom: 6, color: "var(--on-surface)" }}>
                  Sin actividad todavia
                </p>
                <p style={{ fontSize: "0.85rem", lineHeight: 1.5, maxWidth: 260, margin: "0 auto" }}>
                  Cuando compartas lugares, eventos o hagas reclamaciones, apareceran aqui
                </p>
              </div>
            )}
            {activityItems.map((item) => (
              <div key={item.key}>{item.node}</div>
            ))}
          </div>
        )}

        {/* ── Sign out — bottom, discrete ── */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid var(--border)", textAlign: "center" }}>
          <button
            onClick={signOut}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-full)",
              padding: "12px 28px",
              minHeight: 44,
              fontSize: "0.82rem",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
            }}
          >
            Cerrar sesion
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable sub-components ── */

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div
      style={{
        background: "var(--surface-container-lowest)",
        borderRadius: "var(--r-md)",
        padding: "14px 12px",
        textAlign: "center",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <p
        style={{
          fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--primary)",
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: "0.72rem", color: "var(--on-surface-variant)", fontWeight: 500 }}>
        {label}
      </p>
    </div>
  );
}

function ActivityRow({
  thumb,
  icon,
  title,
  subtitle,
  badge,
  extra,
  dimmed,
}: {
  thumb?: React.ReactNode;
  icon?: string;
  title: string;
  subtitle: string;
  badge?: { label: string; bg: string; color: string };
  extra?: React.ReactNode;
  dimmed?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--surface-container-lowest)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "var(--shadow-card)",
        opacity: dimmed ? 0.6 : 1,
      }}
    >
      {thumb ?? (
        <div style={{
          width: 44,
          height: 44,
          borderRadius: "var(--r-sm)",
          background: "var(--surface-container-high)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.3rem",
        }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontWeight: 600,
          color: "var(--on-surface)",
          fontSize: "0.92rem",
          marginBottom: 2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {title}
        </p>
        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{subtitle}</p>
        {extra}
      </div>
      {badge && (
        <span style={{
          fontSize: "0.68rem",
          padding: "2px 8px",
          borderRadius: "var(--r-full)",
          background: badge.bg,
          color: badge.color,
          fontWeight: 600,
          flexShrink: 0,
        }}>
          {badge.label}
        </span>
      )}
    </div>
  );
}
