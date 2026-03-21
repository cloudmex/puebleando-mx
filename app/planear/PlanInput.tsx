"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const DESTINOS = [
  { nombre: "Oaxaca",               emoji: "🎨" },
  { nombre: "San Miguel de Allende", emoji: "🎊" },
  { nombre: "Sayulita",             emoji: "🏄" },
  { nombre: "Guanajuato",           emoji: "🎭" },
  { nombre: "Tulum",                emoji: "🌊" },
  { nombre: "Mérida",               emoji: "🏛️" },
  { nombre: "Puerto Vallarta",      emoji: "🌴" },
  { nombre: "Puebla",               emoji: "🍽️" },
];

export default function PlanInput() {
  const [ciudad, setCiudad] = useState("");
  const [focused, setFocused] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    router.push(`/planear/${encodeURIComponent(trimmed.toLowerCase().replace(/\s+/g, "-"))}`);
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg-subtle)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "calc(var(--topbar-h) + var(--safe-top) + 32px) 24px calc(var(--bottomnav-h) + var(--safe-bottom) + 32px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative glow blobs */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "8%",
          right: "-12%",
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(196,98,45,0.10) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "12%",
          left: "-14%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(45,125,98,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ textAlign: "center", marginBottom: 36, position: "relative", zIndex: 1 }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            borderRadius: "20px",
            background: "linear-gradient(135deg, #C4622D 0%, #A34E22 100%)",
            marginBottom: 20,
            boxShadow: "0 8px 24px rgba(196,98,45,0.28)",
          }}
        >
          <span style={{ fontSize: "1.8rem", lineHeight: 1 }}>🌮</span>
        </div>

        <h1
          style={{
            fontFamily: "Playfair Display, serif",
            fontSize: "clamp(1.75rem, 6vw, 2.4rem)",
            fontWeight: 700,
            color: "var(--text)",
            margin: "0 0 14px",
            lineHeight: 1.18,
            letterSpacing: "-0.02em",
          }}
        >
          {"¿A dónde vas este "}
          <span style={{ color: "var(--terracota)" }}>fin de semana?</span>
        </h1>
        <p
          style={{
            fontSize: "0.97rem",
            color: "var(--text-secondary)",
            maxWidth: 300,
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          Escribe una ciudad y te armamos el itinerario perfecto con los mejores lugares y eventos.
        </p>
      </motion.div>

      {/* Input + CTA */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: "100%",
          maxWidth: 440,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#fff",
            border: `2px solid ${focused ? "var(--terracota)" : "var(--border)"}`,
            borderRadius: "var(--r-full)",
            padding: "0 10px 0 20px",
            boxShadow: focused
              ? "0 0 0 4px rgba(196,98,45,0.10), 0 4px 16px rgba(0,0,0,0.07)"
              : "0 2px 12px rgba(0,0,0,0.06)",
            transition: "all 0.2s ease",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={focused ? "var(--terracota)" : "var(--text-muted)"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, transition: "stroke 0.2s" }}
          >
            <path d="M12 2C9.24 2 7 4.24 7 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
            <circle cx="12" cy="7" r="2" fill="currentColor" stroke="none" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Oaxaca, Sayulita, Mérida…"
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit(ciudad)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: "1.05rem",
              color: "var(--text)",
              height: 54,
              caretColor: "var(--terracota)",
            }}
          />
          {ciudad && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setCiudad(""); inputRef.current?.focus(); }}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--bg-muted)",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          )}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => handleSubmit(ciudad)}
          disabled={!ciudad.trim()}
          style={{
            width: "100%",
            height: 54,
            borderRadius: "var(--r-full)",
            background: ciudad.trim()
              ? "linear-gradient(135deg, #D4703A 0%, #A34E22 100%)"
              : "var(--bg-muted)",
            color: ciudad.trim() ? "#fff" : "var(--text-muted)",
            fontWeight: 700,
            fontSize: "1rem",
            border: "none",
            cursor: ciudad.trim() ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            letterSpacing: "0.01em",
            boxShadow: ciudad.trim() ? "0 4px 18px rgba(196,98,45,0.32)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Planea mi fin de semana
        </motion.button>
      </motion.div>

      {/* Destinos populares */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.22 }}
        style={{ marginTop: 36, width: "100%", maxWidth: 440, position: "relative", zIndex: 1 }}
      >
        <p
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          Destinos populares
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {DESTINOS.map((d, i) => (
            <motion.button
              key={d.nombre}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.26 + i * 0.04 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => handleSubmit(d.nombre)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 14px",
                borderRadius: "var(--r-full)",
                background: "#fff",
                border: "1.5px solid var(--border)",
                fontSize: "0.83rem",
                fontWeight: 500,
                color: "var(--text-secondary)",
                cursor: "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = "var(--terracota)";
                el.style.color = "var(--terracota)";
                el.style.background = "rgba(196,98,45,0.05)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = "var(--border)";
                el.style.color = "var(--text-secondary)";
                el.style.background = "#fff";
              }}
            >
              <span style={{ fontSize: "0.95rem" }}>{d.emoji}</span>
              {d.nombre}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{
          marginTop: 40,
          fontSize: "0.74rem",
          color: "var(--text-muted)",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
          lineHeight: 1.5,
        }}
      >
        Generado con IA · Solo destinos auténticos de México
      </motion.p>
    </div>
  );
}
