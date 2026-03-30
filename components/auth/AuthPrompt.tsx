"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

interface AuthPromptProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  redirectAfter?: string;
}

export default function AuthPrompt({
  open,
  onClose,
  title = "Crea tu cuenta gratis",
  message = "Guarda tus planes, personaliza recomendaciones y descubre más de México.",
  redirectAfter,
}: AuthPromptProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"prompt" | "login" | "registro">("prompt");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function reset() {
    setMode("prompt");
    setEmail("");
    setPassword("");
    setDisplayName("");
    setError("");
    setLoading(false);
    setSuccess(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      if (!isSupabaseConfigured()) {
        localStorage.setItem("puebleando_mock_token", "mock_token");
        setSuccess(true);
        setTimeout(() => {
          handleClose();
          if (redirectAfter) router.push(redirectAfter);
          else window.location.reload();
        }, 800);
        return;
      }
      setError("Servicio no disponible.");
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      handleClose();
      if (redirectAfter) router.push(redirectAfter);
      else window.location.reload();
    }, 800);
  }

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      if (!isSupabaseConfigured()) {
        localStorage.setItem("puebleando_mock_token", "mock_token");
        setSuccess(true);
        setTimeout(() => {
          handleClose();
          window.location.reload();
        }, 800);
        return;
      }
      setError("Servicio no disponible.");
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || email.split("@")[0] } },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--surface-container-lowest)",
    border: "1.5px solid var(--outline)",
    borderRadius: "var(--r-lg)",
    padding: "0 16px",
    height: 48,
    fontSize: "0.95rem",
    color: "var(--on-surface)",
    outline: "none",
    caretColor: "var(--primary)",
    width: "100%",
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              zIndex: 999,
            }}
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1000,
              background: "var(--surface)",
              borderTopLeftRadius: "var(--r-xl)",
              borderTopRightRadius: "var(--r-xl)",
              boxShadow: "var(--shadow-sheet)",
              maxHeight: "85vh",
              overflow: "auto",
              padding: "8px 24px 32px",
            }}
          >
            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 16px" }}>
              <div style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: "var(--surface-container-highest)",
              }} />
            </div>

            {success ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ fontSize: "2.5rem", marginBottom: 12 }}>
                  {mode === "registro" ? "📧" : "🎉"}
                </p>
                <p className="headline-md" style={{ marginBottom: 8 }}>
                  {mode === "registro" ? "Revisa tu correo" : "Bienvenido de vuelta"}
                </p>
                <p className="body-lg">
                  {mode === "registro"
                    ? "Te enviamos un link de confirmación."
                    : "Ya puedes guardar tus planes."}
                </p>
              </div>
            ) : mode === "prompt" ? (
              <>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <p style={{ fontSize: "2rem", marginBottom: 8 }}>🌮</p>
                  <h2 className="headline-md" style={{ marginBottom: 6 }}>{title}</h2>
                  <p className="body-lg" style={{ fontSize: "0.88rem" }}>{message}</p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <button
                    className="btn-primary"
                    onClick={() => setMode("registro")}
                    style={{ height: 48 }}
                  >
                    Crear cuenta gratis
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setMode("login")}
                    style={{ height: 48 }}
                  >
                    Ya tengo cuenta
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={handleClose}
                    style={{ marginTop: 4 }}
                  >
                    Seguir sin cuenta
                  </button>
                </div>
              </>
            ) : mode === "login" ? (
              <>
                <h2 className="headline-md" style={{ textAlign: "center", marginBottom: 20 }}>
                  Ingresar
                </h2>
                <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="tu@correo.com"
                    style={inputStyle}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Contraseña"
                    style={inputStyle}
                  />
                  {error && (
                    <p style={{ color: "var(--error)", fontSize: "0.85rem", textAlign: "center" }}>{error}</p>
                  )}
                  <button type="submit" disabled={loading} className="btn-primary" style={{ height: 48 }}>
                    {loading ? "Ingresando..." : "Ingresar"}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => { setMode("prompt"); setError(""); }}>
                    Volver
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="headline-md" style={{ textAlign: "center", marginBottom: 20 }}>
                  Crear cuenta
                </h2>
                <form onSubmit={handleRegistro} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Tu nombre (opcional)"
                    style={inputStyle}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="tu@correo.com"
                    style={inputStyle}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Contraseña (mín. 6 caracteres)"
                    style={inputStyle}
                  />
                  {error && (
                    <p style={{ color: "var(--error)", fontSize: "0.85rem", textAlign: "center" }}>{error}</p>
                  )}
                  <button type="submit" disabled={loading} className="btn-primary" style={{ height: 48 }}>
                    {loading ? "Creando cuenta..." : "Crear cuenta"}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => { setMode("prompt"); setError(""); }}>
                    Volver
                  </button>
                </form>
              </>
            )}

            {/* Safe area padding */}
            <div style={{ height: "env(safe-area-inset-bottom, 16px)" }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
