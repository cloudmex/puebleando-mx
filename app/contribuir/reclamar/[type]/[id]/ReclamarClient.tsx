"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

interface Props {
  contentType: "place" | "event";
  contentId: string;
  contentName: string;
  hasPendingClaim: boolean;
}

export default function ReclamarClient({ contentType, contentId, contentName, hasPendingClaim }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (hasPendingClaim) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <p style={{ fontSize: "2rem", marginBottom: 12 }}>⏳</p>
        <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: "1.2rem", fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
          Solicitud en revisión
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Ya tienes una solicitud de reclamación pendiente para <strong>{contentName}</strong>. El equipo la revisará pronto.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { router.push(`/auth/login?redirect=/contribuir/reclamar/${contentType}/${contentId}`); return; }

    setLoading(true);
    setError("");

    const isLocal = !isSupabaseConfigured();
    const supabase = getSupabaseClient();
    const token = isLocal 
      ? localStorage.getItem("puebleando_mock_token")
      : supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;

    const res = await fetch("/api/claims", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        content_type: contentType,
        content_id: contentId,
        reason,
      }),
    });

    setLoading(false);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Error al enviar");
      return;
    }

    router.push("/mi-cuenta?toast=claim_enviado");
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Content preview */}
      <div
        style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "14px 16px",
        }}
      >
        <p className="label-muted" style={{ fontSize: "0.75rem", marginBottom: 4 }}>
          {contentType === "place" ? "📍 Lugar" : "🎉 Evento"}
        </p>
        <p style={{ fontWeight: 700, color: "var(--text)", fontSize: "1rem" }}>{contentName}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>
          ¿Por qué eres el dueño o responsable de este lugar? *
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          placeholder="Ej. Soy el propietario del negocio, puedo verificarlo con documentos..."
          rows={5}
          style={{
            background: "var(--bg-subtle)",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "12px 16px",
            fontSize: "0.95rem",
            color: "var(--text)",
            outline: "none",
            caretColor: "var(--terracota)",
            resize: "vertical",
            lineHeight: 1.5,
          }}
        />
      </div>

      <div
        style={{
          background: "rgba(196,98,45,0.06)",
          border: "1px solid rgba(196,98,45,0.2)",
          borderRadius: "var(--r-md)",
          padding: "12px 14px",
          fontSize: "0.825rem",
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        ℹ️ El equipo de Puebleando revisará tu solicitud. Una vez aprobada, podrás editar la información del lugar y agregar eventos propios.
      </div>

      {error && (
        <p style={{ color: "#e53e3e", fontSize: "0.875rem" }}>{error}</p>
      )}

      <div style={{ height: 20 }} />

      {/* Sticky CTA */}
      <div
        style={{
          position: "fixed",
          bottom: "var(--bottomnav-h)",
          left: 0, right: 0,
          background: "linear-gradient(to top, var(--bg) 80%, transparent)",
          padding: "16px 20px 12px",
          zIndex: 40,
        }}
      >
        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={{ width: "100%", height: 50, fontSize: "1rem", opacity: loading ? 0.7 : 1, maxWidth: 600, margin: "0 auto", display: "block" }}
        >
          {loading ? "Enviando..." : "Enviar solicitud"}
        </button>
      </div>
    </form>
  );
}
