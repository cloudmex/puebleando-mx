"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/mi-cuenta";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      if (!isSupabaseConfigured()) {
        localStorage.setItem("puebleando_mock_token", "mock_token");
        // Hard navigation to redirect to ensure AuthProvider re-runs useEffect
        window.location.href = redirect;
        return;
      }
      setError("Servicio de autenticación no disponible.");
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    router.push(redirect);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>Correo electrónico</label>
        <input
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
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
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
        <p style={{ color: "#e53e3e", fontSize: "0.875rem", textAlign: "center" }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary"
        style={{ height: 48, fontSize: "1rem", opacity: loading ? 0.7 : 1 }}
      >
        {loading ? "Ingresando..." : "Ingresar"}
      </button>

      <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
        ¿No tienes cuenta?{" "}
        <Link href="/auth/registro" style={{ color: "var(--terracota)", fontWeight: 600 }}>
          Regístrate
        </Link>
      </p>
    </form>
  );
}
