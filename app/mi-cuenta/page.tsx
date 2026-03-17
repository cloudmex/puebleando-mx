import { Suspense } from "react";
import DashboardFetcher from "./DashboardFetcher";

export const metadata = { title: "Mi cuenta – Puebleando" };

export default function MiCuentaPage() {
  return (
    <main
      style={{
        paddingTop: "calc(var(--topbar-h) + 20px)",
        paddingBottom: "calc(var(--bottomnav-h) + 20px)",
        minHeight: "100dvh",
        background: "var(--bg-subtle)",
      }}
    >
      <div style={{ background: "var(--dark)", padding: "16px 20px 0" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h1
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: "1.6rem",
              fontWeight: 700,
              color: "#fff",
              marginBottom: 4,
            }}
          >
            Mi cuenta
          </h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.875rem", marginBottom: 16 }}>
            Gestiona tu contenido en Puebleando
          </p>
          <div className="mexican-stripe" style={{ opacity: 0.65 }} />
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>
        <Suspense>
          <DashboardFetcher />
        </Suspense>
      </div>
    </main>
  );
}
