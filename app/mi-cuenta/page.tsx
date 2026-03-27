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
        background: "var(--surface)",
      }}
    >
      <div style={{ background: "var(--surface-container-low)", padding: "16px 20px 20px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <p className="label-sm" style={{ color: "var(--primary)", marginBottom: 8 }}>
            Tu perfil
          </p>
          <h1
            className="display-md"
            style={{ marginBottom: 4 }}
          >
            Mi cuenta
          </h1>
          <p style={{ color: "var(--on-surface-variant)", fontSize: "0.875rem", marginBottom: 16 }}>
            Gestiona tu contenido en Puebleando
          </p>
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
