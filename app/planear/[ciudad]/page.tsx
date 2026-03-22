import Link from "next/link";
import ItinerarioView from "./ItinerarioView";

export default async function PlanCiudadPage({
  params,
  searchParams,
}: {
  params: Promise<{ ciudad: string }>;
  searchParams: Promise<{ ctx?: string }>;
}) {
  const [{ ciudad }, { ctx }] = await Promise.all([params, searchParams]);
  const ciudadDisplay = decodeURIComponent(ciudad)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const contexto = ctx ? decodeURIComponent(ctx) : "";

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        paddingTop: "calc(var(--topbar-h) + var(--safe-top))",
        paddingBottom: "calc(var(--bottomnav-h) + var(--safe-bottom))",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
          flexShrink: 0,
        }}
      >
        <Link
          href="/planear"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "var(--r-sm)",
            background: "var(--bg-subtle)",
            color: "var(--text-secondary)",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <h1
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--text)",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {ciudadDisplay}
          </h1>
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0 }}>
            Tu fin de semana
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        <ItinerarioView ciudad={ciudadDisplay} contexto={contexto} />
      </div>
    </main>
  );
}
