import ContribuirLugarClient from "./ContribuirLugarClient";
import Link from "next/link";

export const metadata = { title: "Compartir lugar – Puebleando" };

export default function ContribuirLugarPage() {
  return (
    <main
      style={{
        paddingTop: "calc(var(--topbar-h) + 20px)",
        paddingBottom: "calc(var(--bottomnav-h) + 80px)",
        minHeight: "100dvh",
        background: "var(--bg)",
      }}
    >
      {/* Header */}
      <div style={{ background: "var(--dark)", padding: "16px 20px 0" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <Link href="/mi-cuenta" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem", textDecoration: "none" }}>
            ← Mi cuenta
          </Link>
          <h1
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#fff",
              margin: "8px 0 4px",
            }}
          >
            Compartir un lugar
          </h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.875rem", marginBottom: 16 }}>
            Comparte los lugares auténticos de tu comunidad
          </p>
          <div className="mexican-stripe" style={{ opacity: 0.65 }} />
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 20px" }}>
        <ContribuirLugarClient />
      </div>
    </main>
  );
}
