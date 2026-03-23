"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

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

type DayKey = "viernes" | "sabado" | "domingo";
const ALL_DAYS: { key: DayKey; label: string; color: string }[] = [
  { key: "viernes", label: "Vie",  color: "#1A8FA0" },
  { key: "sabado",  label: "Sáb",  color: "#C4622D" },
  { key: "domingo", label: "Dom",  color: "#2D7D62" },
];

type Suggestion = {
  id: string;
  text: string;           // short city name: "Oaxaca de Juárez"
  place_name: string;     // full name: "Oaxaca de Juárez, Oaxaca, México"
  center: [number, number]; // [lng, lat]
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

async function fetchSuggestions(query: string): Promise<Suggestion[]> {
  if (!MAPBOX_TOKEN || query.length < 2) return [];
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=mx&types=place,locality,district&language=es&limit=6&access_token=${MAPBOX_TOKEN}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? []).map((f: any) => ({
      id: f.id,
      text: f.text,
      place_name: f.place_name,
      center: f.center,
    }));
  } catch {
    return [];
  }
}

export default function PlanInput() {
  const [ciudad, setCiudad] = useState("");
  const [contexto, setContexto] = useState("");
  const [focused, setFocused] = useState(false);
  const [ctxFocused, setCtxFocused] = useState(false);
  const [dias, setDias] = useState<DayKey[]>(["sabado", "domingo"]);

  // Geocoding state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [validated, setValidated] = useState(false); // true only after picking a suggestion
  const [showDropdown, setShowDropdown] = useState(false);

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced geocoding
  useEffect(() => {
    if (validated || ciudad.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setLoadingSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(ciudad);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setLoadingSuggestions(false);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [ciudad, validated]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectSuggestion = useCallback((s: Suggestion) => {
    setCiudad(s.text);
    setValidated(true);
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.blur();
  }, []);

  const handleChange = (v: string) => {
    setCiudad(v);
    setValidated(false); // typing invalidates selection
  };

  const toggleDay = (d: DayKey) => {
    setDias((prev) => {
      if (prev.includes(d)) {
        if (prev.length === 1) return prev; // always keep at least one
        return prev.filter((x) => x !== d);
      }
      return [...prev, d].sort(
        (a, b) => ALL_DAYS.findIndex((x) => x.key === a) - ALL_DAYS.findIndex((x) => x.key === b)
      );
    });
  };

  const handleSubmit = (value: string, skipValidation = false, overrideDias?: DayKey[]) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!skipValidation && !validated) return;
    const slug = encodeURIComponent(trimmed.toLowerCase().replace(/\s+/g, "-"));
    const ctx = contexto.trim();
    const diasStr = (overrideDias ?? dias).join(",");
    const params = new URLSearchParams();
    params.set("dias", diasStr);
    if (ctx) params.set("ctx", ctx);
    router.push(`/planear/${slug}?${params.toString()}`);
  };

  const canSubmit = ciudad.trim() && validated;
  const showValidationHint = ciudad.trim().length >= 2 && !validated && !loadingSuggestions && !showDropdown;

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
      <div aria-hidden="true" style={{ position: "absolute", top: "8%", right: "-12%", width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle, rgba(196,98,45,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div aria-hidden="true" style={{ position: "absolute", bottom: "12%", left: "-14%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(45,125,98,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ textAlign: "center", marginBottom: 36, position: "relative", zIndex: 1 }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "20px", background: "linear-gradient(135deg, #C4622D 0%, #A34E22 100%)", marginBottom: 20, boxShadow: "0 8px 24px rgba(196,98,45,0.28)" }}>
          <span style={{ fontSize: "1.8rem", lineHeight: 1 }}>🌮</span>
        </div>
        <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: "clamp(1.75rem, 6vw, 2.4rem)", fontWeight: 700, color: "var(--text)", margin: "0 0 14px", lineHeight: 1.18, letterSpacing: "-0.02em" }}>
          {"¿A dónde vas este "}
          <span style={{ color: "var(--terracota)" }}>fin de semana?</span>
        </h1>
        <p style={{ fontSize: "0.97rem", color: "var(--text-secondary)", maxWidth: 300, margin: "0 auto", lineHeight: 1.6 }}>
          Escribe una ciudad y te armamos el itinerario perfecto con los mejores lugares y eventos.
        </p>
      </motion.div>

      {/* Input + CTA */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 2 }}
      >
        {/* City input with dropdown */}
        <div ref={wrapperRef} style={{ position: "relative" }}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#fff",
              border: `2px solid ${focused ? (validated ? "var(--jade)" : "var(--terracota)") : showValidationHint ? "var(--rojo)" : "var(--border)"}`,
              borderRadius: showDropdown ? "var(--r-lg) var(--r-lg) 0 0" : "var(--r-full)",
              padding: "0 10px 0 20px",
              boxShadow: focused
                ? `0 0 0 4px ${validated ? "rgba(45,125,98,0.10)" : "rgba(196,98,45,0.10)"}, 0 4px 16px rgba(0,0,0,0.07)`
                : "0 2px 12px rgba(0,0,0,0.06)",
              transition: "all 0.2s ease",
            }}
          >
            {/* Icon: pin or spinner */}
            {loadingSuggestions ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terracota)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            ) : validated ? (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="7" stroke="var(--jade)" strokeWidth="1.5" />
                <path d="M5 8l2 2 4-4" stroke="var(--jade)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={focused ? "var(--terracota)" : "var(--text-muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "stroke 0.2s" }}>
                <path d="M12 2C9.24 2 7 4.24 7 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
                <circle cx="12" cy="7" r="2" fill="currentColor" stroke="none" />
              </svg>
            )}

            <input
              ref={inputRef}
              type="text"
              placeholder="Oaxaca, Sayulita, Mérida…"
              value={ciudad}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit(ciudad);
                if (e.key === "Escape") setShowDropdown(false);
              }}
              onFocus={() => { setFocused(true); if (suggestions.length > 0) setShowDropdown(true); }}
              onBlur={() => setFocused(false)}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "1.05rem", color: "var(--text)", height: 54, caretColor: "var(--terracota)" }}
            />

            {ciudad && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setCiudad(""); setValidated(false); setSuggestions([]); setShowDropdown(false); inputRef.current?.focus(); }}
                style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bg-muted)", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}
              >
                ×
              </button>
            )}
          </div>

          {/* Dropdown suggestions */}
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                  background: "#fff",
                  border: "2px solid var(--terracota)",
                  borderTop: "1px solid var(--border)",
                  borderRadius: "0 0 var(--r-lg) var(--r-lg)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                  overflow: "hidden",
                }}
              >
                {suggestions.map((s, i) => (
                  <button
                    key={s.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(s)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 16px", border: "none", background: "none",
                      cursor: "pointer", textAlign: "left",
                      borderBottom: i < suggestions.length - 1 ? "1px solid var(--border)" : "none",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-subtle)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M12 2C9.24 2 7 4.24 7 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
                      <circle cx="12" cy="7" r="2" fill="currentColor" stroke="none" />
                    </svg>
                    <div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)", lineHeight: 1.2 }}>{s.text}</div>
                      <div style={{ fontSize: "0.73rem", color: "var(--text-muted)", marginTop: 1 }}>{s.place_name}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Validation hint */}
          {showValidationHint && (
            <p style={{ fontSize: "0.72rem", color: "var(--rojo)", marginTop: 5, paddingLeft: 16, lineHeight: 1.4 }}>
              Selecciona una ciudad de la lista para continuar
            </p>
          )}
        </div>

        {/* Day selector */}
        <div>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8, paddingLeft: 4 }}>
            ¿Qué días vas?
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {ALL_DAYS.map((d) => {
              const active = dias.includes(d.key);
              return (
                <button
                  key={d.key}
                  onClick={() => toggleDay(d.key)}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: "var(--r-full)",
                    border: `2px solid ${active ? d.color : "var(--border)"}`,
                    background: active ? `${d.color}14` : "#fff",
                    color: active ? d.color : "var(--text-muted)",
                    fontWeight: active ? 700 : 500,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.18s",
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Context textarea */}
        <div>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6, paddingLeft: 4 }}>
            ¿Qué tipo de experiencia buscas?
          </label>
          <textarea
            value={contexto}
            onChange={(e) => setContexto(e.target.value)}
            onFocus={() => setCtxFocused(true)}
            onBlur={() => setCtxFocused(false)}
            placeholder="En mi próxima aventura..."
            rows={3}
            style={{
              width: "100%", padding: "12px 16px",
              border: `2px solid ${ctxFocused ? "var(--terracota)" : "var(--border)"}`,
              borderRadius: "var(--r-lg)", background: "#fff",
              fontSize: "0.93rem", color: "var(--text)", resize: "none", outline: "none",
              lineHeight: 1.55, caretColor: "var(--terracota)",
              boxShadow: ctxFocused ? "0 0 0 4px rgba(196,98,45,0.10), 0 2px 8px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.04)",
              transition: "border-color 0.2s, box-shadow 0.2s",
              fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
          <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 5, paddingLeft: 4, lineHeight: 1.4 }}>
            Ej: "Busco experiencias para niños", "Prefiero vida nocturna y gastronomía"
          </p>
        </div>

        <motion.button
          whileTap={{ scale: canSubmit ? 0.97 : 1 }}
          onClick={() => handleSubmit(ciudad)}
          disabled={!canSubmit}
          style={{
            width: "100%", height: 54, borderRadius: "var(--r-full)",
            background: canSubmit
              ? "linear-gradient(135deg, #D4703A 0%, #A34E22 100%)"
              : "var(--bg-muted)",
            color: canSubmit ? "#fff" : "var(--text-muted)",
            fontWeight: 700, fontSize: "1rem", border: "none",
            cursor: canSubmit ? "pointer" : "not-allowed",
            transition: "all 0.2s", letterSpacing: "0.01em",
            boxShadow: canSubmit ? "0 4px 18px rgba(196,98,45,0.32)" : "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
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
        <p style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "center", marginBottom: 12 }}>
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
              onClick={() => {
                setCiudad(d.nombre);
                setValidated(true);
                setSuggestions([]);
                setShowDropdown(false);
                handleSubmit(d.nombre, true);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
                borderRadius: "var(--r-full)", background: "#fff",
                border: "1.5px solid var(--border)", fontSize: "0.83rem", fontWeight: 500,
                color: "var(--text-secondary)", cursor: "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)", transition: "all 0.15s",
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
        style={{ marginTop: 40, fontSize: "0.74rem", color: "var(--text-muted)", textAlign: "center", position: "relative", zIndex: 1, lineHeight: 1.5 }}
      >
        Generado con IA · Solo destinos auténticos de México
      </motion.p>
    </div>
  );
}
