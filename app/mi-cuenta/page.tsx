import { Suspense } from "react";
import DashboardFetcher from "./DashboardFetcher";

export const metadata = { title: "Mi cuenta – Puebleando" };

export default function MiCuentaPage() {
  return (
    <main
      style={{
        paddingTop: "var(--topbar-h)",
        paddingBottom: "calc(var(--bottomnav-h) + 20px)",
        minHeight: "100dvh",
        background: "var(--surface)",
      }}
    >
      {/* Header is now inside DashboardClient for personalization */}

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>
        <Suspense>
          <DashboardFetcher />
        </Suspense>
      </div>
    </main>
  );
}
