import ContribuirEventoClient from "./ContribuirEventoClient";
import Link from "next/link";

export const metadata = { title: "Publicar evento – Puebleando" };

export default function ContribuirEventoPage() {
  return (
    <main
      style={{
        paddingTop: "calc(var(--topbar-h) + 20px)",
        paddingBottom: "calc(var(--bottomnav-h) + 80px)",
        minHeight: "100dvh",
        background: "var(--bg)",
      }}
    >
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
            Publicar un evento
          </h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.875rem", marginBottom: 16 }}>
            Comparte eventos culturales, festivales o actividades locales
          </p>
          <div className="mexican-stripe" style={{ opacity: 0.65 }} />
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 20px" }}>
        <ContribuirEventoClient />
      </div>
    </main>
  );
}
