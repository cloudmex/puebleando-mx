import RegistroForm from "./RegistroForm";

export const metadata = { title: "Crear cuenta – Puebleando" };

export default function RegistroPage() {
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
            Únete a Puebleando
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Comparte los lugares auténticos de tu comunidad
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
          <RegistroForm />
        </div>
      </div>
    </main>
  );
}
