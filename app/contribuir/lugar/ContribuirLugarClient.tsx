"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { CategoryId } from "@/types";

const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: "gastronomia", label: "Gastronomía", icon: "🍽️" },
  { id: "cultura", label: "Cultura", icon: "🎭" },
  { id: "naturaleza", label: "Naturaleza", icon: "🌿" },
  { id: "mercados", label: "Mercados", icon: "🛍️" },
  { id: "artesanos", label: "Artesanos", icon: "🎨" },
  { id: "festivales", label: "Festivales", icon: "🎉" },
];

const MAX_PHOTOS = 5;

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

const IconCamera = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconCross = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

interface PhotoItem {
  file: File;
  preview: string;
}

export default function ContribuirLugarClient() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryId | "">("");
  const [town, setTown] = useState("");
  const [state, setState] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");

  function handlePhotosSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const remaining = MAX_PHOTOS - photos.length;
    const newFiles = Array.from(files).slice(0, remaining);
    const newItems: PhotoItem[] = newFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newItems]);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function uploadPhotos(token: string | null | undefined): Promise<string[]> {
    const urls: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      setUploadProgress(`Subiendo foto ${i + 1} de ${photos.length}...`);
      const fd = new FormData();
      fd.append("file", photos[i].file);
      fd.append("bucket", "places-images");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        urls.push(data.url);
      }
    }
    setUploadProgress("");
    return urls;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { router.push("/auth/login?redirect=/contribuir/lugar"); return; }
    if (!category) { setError("Elige una categoría"); return; }
    if (!lat || !lng) { setError("Ingresa las coordenadas del lugar"); return; }

    setLoading(true);
    setError("");

    const isLocal = !isSupabaseConfigured();
    const supabase = getSupabaseClient();
    const token = isLocal
      ? localStorage.getItem("puebleando_mock_token")
      : supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;

    // Upload photos first
    let photoUrls: string[] = [];
    if (photos.length > 0) {
      try {
        photoUrls = await uploadPhotos(token);
      } catch (err) {
        console.error("Photo upload error", err);
        setError("Error al subir las fotos. Intenta de nuevo.");
        setLoading(false);
        return;
      }
    }

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
        photos: photoUrls,
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
        Puedes encontrar las coordenadas en Google Maps: clic derecho → "¿Qué hay aquí?"
      </p>

      {/* --- PHOTO UPLOAD --- */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>
          Fotos del lugar ({photos.length}/{MAX_PHOTOS})
        </label>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: "none" }}
          onChange={handlePhotosSelect}
        />

        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {photos.map((photo, i) => (
            <div
              key={i}
              style={{
                position: "relative",
                width: 100,
                height: 100,
                borderRadius: "var(--r-md)",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <img
                src={photo.preview}
                alt={`Foto ${i + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  background: "rgba(0,0,0,0.6)",
                  color: "white",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <IconCross />
              </button>
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 100,
                height: 100,
                borderRadius: "var(--r-md)",
                background: "var(--bg-subtle)",
                border: "2px dashed var(--border)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
                color: "var(--text-muted)",
                flexShrink: 0,
              }}
            >
              <IconCamera />
              <span style={{ fontSize: "0.7rem" }}>Añadir</span>
            </div>
          )}
        </div>

        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0 }}>
          JPG, PNG o WebP. Máximo 5 MB por foto.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="label-muted" style={{ fontSize: "0.8rem" }}>Etiquetas (separadas por coma)</label>
        <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="tradicional, familiar, cenote..." style={INPUT_STYLE} />
      </div>

      {error && (
        <p style={{ color: "#e53e3e", fontSize: "0.875rem" }}>{error}</p>
      )}

      {uploadProgress && (
        <p style={{ color: "var(--terracota)", fontSize: "0.85rem", fontWeight: 600 }}>{uploadProgress}</p>
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
          {loading ? (uploadProgress || "Enviando...") : "Compartir lugar"}
        </button>
      </div>
    </form>
  );
}
