"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabaseClient } from "@/lib/supabase";
import type { CategoryId } from "@/types";

const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: "gastronomia", label: "Gastronomía", icon: "🍽️" },
  { id: "cultura", label: "Cultura", icon: "🎭" },
  { id: "naturaleza", label: "Naturaleza", icon: "🌿" },
  { id: "mercados", label: "Mercados", icon: "🛍️" },
  { id: "artesanos", label: "Artesanos", icon: "🎨" },
  { id: "festivales", label: "Festivales", icon: "🎉" },
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

export default function ContribuirLugarClient() {
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryId | "">("");
  const [town, setTown] = useState("");
  const [state, setState] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { router.push("/auth/login?redirect=/contribuir/lugar"); return; }
    if (!category) { setError("Elige una categoría"); return; }
    if (!lat || !lng) { setError("Ingresa las coordenadas del lugar"); return; }

    setLoading(true);
    setError("");

    const supabase = getSupabaseClient();
    const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;

    const res = await fetch("/api/contribuir/lugar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        name, description, category,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        photos: photoUrl ? [photoUrl] : [],
        town, state,
        tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    });

    setLoading(false);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Error al enviar");
      return;
    }

    if (data.published) {
      router.push(`/lugar/${data.id}?toast=lugar_publicado`);
    } else {
      router.push("/mi-cuenta?toast=lugar_en_revision");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>Nombre del lugar *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Tacos Don Ramón" style={INPUT_STYLE} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Cuéntanos qué hace especial a este lugar..."
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
          <label className="label-muted" style={{ fontSize: "0.8rem" }}>Ciudad / Pueblo *</label>
          <input type="text" value={town} onChange={(e) => setTown(e.target.value)} required placeholder="Oaxaca de Juárez" style={INPUT_STYLE} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="label-muted" style={{ fontSize: "0.8rem" }}>Estado *</label>
          <input type="text" value={state} onChange={(e) => setState(e.target.value)} required placeholder="Oaxaca" style={INPUT_STYLE} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="label-muted" style={{ fontSize: "0.8rem" }}>Latitud *</label>
          <input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} required placeholder="17.0732" style={INPUT_STYLE} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="label-muted" style={{ fontSize: "0.8rem" }}>Longitud *</label>
          <input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} required placeholder="-96.7266" style={INPUT_STYLE} />
        </div>
      </div>

      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: -10 }}>
        💡 Puedes encontrar las coordenadas en Google Maps: clic derecho → "¿Qué hay aquí?"
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>URL de foto (opcional)</label>
        <input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." style={INPUT_STYLE} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>Etiquetas (separadas por coma)</label>
        <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="tradicional, familiar, cenote..." style={INPUT_STYLE} />
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
          {loading ? "Enviando..." : "Compartir lugar"}
        </button>
      </div>
    </form>
  );
}
