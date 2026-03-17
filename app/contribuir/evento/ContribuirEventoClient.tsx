"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const CATEGORIES = [
  { id: "cultura", label: "Cultura", icon: "🎭" },
  { id: "festivales", label: "Festivales", icon: "🎉" },
  { id: "gastronomia", label: "Gastronomía", icon: "🍽️" },
  { id: "mercados", label: "Mercados", icon: "🛍️" },
  { id: "naturaleza", label: "Naturaleza", icon: "🌿" },
  { id: "artesanos", label: "Artesanos", icon: "🎨" },
];

const INPUT_STYLE = {
  background: "var(--bg-subtle)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-xl)" as string,
  padding: "0 16px",
  height: 48,
  fontSize: "1rem",
  color: "var(--text)",
  outline: "none",
  caretColor: "var(--terracota)",
  width: "100%",
  boxSizing: "border-box" as const,
};

export default function ContribuirEventoClient() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [priceText, setPriceText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { router.push("/auth/login?redirect=/contribuir/evento"); return; }
    if (!category) { setError("Elige una categoría"); return; }

    setLoading(true);
    setError("");

    const isLocal = !isSupabaseConfigured();
    const supabase = getSupabaseClient();
    const token = isLocal 
      ? localStorage.getItem("puebleando_mock_token")
      : supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;

    const res = await fetch("/api/contribuir/evento", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        title, description, category,
        start_date: startDate,
        end_date: endDate || null,
        venue_name: venueName,
        city, state,
        is_free: isFree,
        price_text: isFree ? "Entrada libre" : priceText,
        image_url: imageUrl,
      }),
    });

    setLoading(false);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Error al enviar");
      return;
    }

    if (data.published) {
      router.push(`/evento/${data.id}?toast=evento_publicado`);
    } else {
      router.push("/mi-cuenta?toast=evento_en_revision");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>Nombre del evento *</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ej. Feria del Mole 2026" style={INPUT_STYLE} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="¿De qué trata el evento? ¿Qué actividades habrá?"
          rows={4}
          style={{ ...INPUT_STYLE, height: "auto", padding: "12px 16px", resize: "vertical" }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>Categoría *</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--r-full)",
                border: `1.5px solid ${category === c.id ? "var(--terracota)" : "var(--border)"}`,
                background: category === c.id ? "rgba(196,98,45,0.08)" : "var(--bg-subtle)",
                color: category === c.id ? "var(--terracota)" : "var(--text-secondary)",
                fontWeight: category === c.id ? 700 : 400,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="label-muted" style={{ fontSize: "0.8rem" }}>Fecha y hora inicio *</label>
          <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} required style={INPUT_STYLE} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="label-muted" style={{ fontSize: "0.8rem" }}>Fecha fin (opcional)</label>
          <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={INPUT_STYLE} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>Lugar / Venue</label>
        <input type="text" value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Ej. Zócalo de Oaxaca" style={INPUT_STYLE} />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="label-muted" style={{ fontSize: "0.8rem" }}>Ciudad</label>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Oaxaca de Juárez" style={INPUT_STYLE} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="label-muted" style={{ fontSize: "0.8rem" }}>Estado</label>
          <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="Oaxaca" style={INPUT_STYLE} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>Precio</label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
            <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Entrada libre</span>
          </label>
        </div>
        {!isFree && (
          <input type="text" value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="Ej. $200 - $500" style={INPUT_STYLE} />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>URL de imagen (opcional)</label>
        <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." style={INPUT_STYLE} />
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
          {loading ? "Enviando..." : "Publicar evento"}
        </button>
      </div>
    </form>
  );
}
