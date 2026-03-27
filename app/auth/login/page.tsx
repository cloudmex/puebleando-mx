import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Ingresar – Puebleando" };

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
        paddingTop: "var(--topbar-h)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ fontSize: "2rem", marginBottom: 8 }}>🌮</p>
          <h1
            style={{
              fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 6,
            }}
          >
            Bienvenido de vuelta
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Ingresa para contribuir con tu comunidad
          </p>
        </div>

        <div
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "28px 24px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
