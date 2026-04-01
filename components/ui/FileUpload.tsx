"use client";
import { useState, useRef } from "react";
import { getApiAuthHeader } from "@/lib/apiAuth";

interface FileUploadProps {
  label: string;
  bucket: string;
  accept?: string;
  value?: string;
  onChange: (url: string) => void;
  preview?: boolean;
}

export default function FileUpload({ label, bucket, accept, value, onChange, preview = true }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    setUploading(true);
    try {
      const headers = await getApiAuthHeader();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", bucket);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al subir archivo");
        return;
      }
      onChange(data.url);
    } catch {
      setError("Error de conexión");
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <label className="label-sm block mb-1">{label}</label>
      <div
        className="relative rounded-xl overflow-hidden cursor-pointer transition-colors"
        style={{
          border: `2px dashed ${value ? "var(--tertiary)" : "var(--outline)"}`,
          background: value ? "var(--tertiary-container)" : "var(--surface-container)",
          minHeight: preview && value ? 120 : 60,
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept || "image/*,application/pdf"}
          onChange={handleChange}
          className="hidden"
        />

        {uploading ? (
          <div className="flex items-center justify-center p-4 gap-2">
            <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: "var(--primary)" }} />
            <span className="label-sm">Subiendo...</span>
          </div>
        ) : value ? (
          <div className="p-2">
            {preview && value.match(/\.(jpg|jpeg|png|webp|avif)$/i) ? (
              <img src={value} alt={label} className="w-full h-24 object-cover rounded-lg" />
            ) : (
              <div className="flex items-center gap-2 p-2">
                <span style={{ color: "var(--tertiary)" }}>✓</span>
                <span className="label-sm truncate" style={{ color: "var(--tertiary)" }}>
                  Archivo subido
                </span>
              </div>
            )}
            <p className="label-sm text-center mt-1" style={{ color: "var(--text-muted)" }}>
              Toca para cambiar
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center p-4">
            <span className="label-sm" style={{ color: "var(--text-muted)" }}>
              Toca para subir archivo
            </span>
          </div>
        )}
      </div>
      {error && (
        <p className="label-sm mt-1" style={{ color: "var(--error)" }}>{error}</p>
      )}
    </div>
  );
}
