"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export default function RegistroForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") ?? "/rutas";
  const redirect = rawRedirect.startsWith("/") ? rawRedirect : "/rutas";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      if (!isSupabaseConfigured()) {
        localStorage.setItem("puebleando_mock_token", "mock_token");
        window.location.href = redirect + (redirect.includes("?") ? "&" : "?") + "welcome=1";
        return;
      }
      setError("Servicio de autenticación no disponible.");
      setLoading(false);
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });

    if (authError) {
      if (authError.message === "User already registered") {
        setError("Este correo ya está registrado.");
      } else {
        setError(authError.message || "Error al registrarse. Intenta de nuevo.");
      }
      setLoading(false);
      return;
    }

    // Si Supabase devuelve sesión (confirmación desactivada), redirigir directo
    if (data.session) {
      window.location.href = redirect + (redirect.includes("?") ? "&" : "?") + "welcome=1";
      return;
    }

    // Si requiere confirmación por email, mostrar pantalla de espera
    setDone(true);
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <p style={{ fontSize: "2.5rem", marginBottom: 12 }}>📬</p>
        <h2 style={{
          fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: 8,
        }}>
          Revisa tu correo
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.5 }}>
          Te enviamos un enlace de confirmación a <strong>{email}</strong>.
          Haz clic en él para activar tu cuenta.
        </p>
        <Link
          href="/auth/login"
          className="btn-primary"
          style={{ display: "block", marginTop: 20, height: 44, lineHeight: "44px", textAlign: "center", textDecoration: "none" }}
        >
          Ir a Ingresar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor="registro-name" className="label-muted" style={{ fontSize: "0.8rem" }}>Tu nombre</label>
        <input
          id="registro-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          placeholder="Ej. María Gutiérrez"
          style={{
            background: "var(--bg-subtle)",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--r-xl)",
            padding: "0 16px",
            height: 48,
            fontSize: "1rem",
            color: "var(--text)",
            outline: "none",
            caretColor: "var(--terracota)",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor="registro-email" className="label-muted" style={{ fontSize: "0.8rem" }}>Correo electrónico</label>
        <input
          id="registro-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="tu@correo.com"
          style={{
            background: "var(--bg-subtle)",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--r-xl)",
            padding: "0 16px",
            height: 48,
            fontSize: "1rem",
            color: "var(--text)",
            outline: "none",
            caretColor: "var(--terracota)",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor="registro-password" className="label-muted" style={{ fontSize: "0.8rem" }}>Contraseña (mínimo 8 caracteres)</label>
        <input
          id="registro-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder="••••••••"
          style={{
            background: "var(--bg-subtle)",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--r-xl)",
            padding: "0 16px",
            height: 48,
            fontSize: "1rem",
            color: "var(--text)",
            outline: "none",
            caretColor: "var(--terracota)",
          }}
        />
      </div>

      {error && (
        <p role="alert" style={{ color: "var(--error, #e53e3e)", fontSize: "0.875rem", textAlign: "center" }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary"
        style={{ height: 48, fontSize: "1rem", opacity: loading ? 0.7 : 1 }}
      >
        {loading ? "Registrando..." : "Crear cuenta"}
      </button>

      <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
        ¿Ya tienes cuenta?{" "}
        <Link href="/auth/login" style={{ color: "var(--terracota)", fontWeight: 600 }}>
          Ingresa
        </Link>
      </p>
    </form>
  );
}
