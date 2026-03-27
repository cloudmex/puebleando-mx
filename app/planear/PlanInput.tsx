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
  { key: "sabado",  label: "Sáb",  color: "var(--primary)" },
  { key: "domingo", label: "Dom",  color: "var(--secondary)" },
];

type Suggestion = {
  id: string;
  text: string;
  place_name: string;
  center: [number, number];
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

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [validated, setValidated] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
    setValidated(false);
  };

  const toggleDay = (d: DayKey) => {
    setDias((prev) => {
      if (prev.includes(d)) {
        if (prev.length === 1) return prev;
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
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "calc(var(--topbar-h) + var(--safe-top) + 32px) 24px calc(var(--bottomnav-h) + var(--safe-bottom) + 32px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative warm glow blobs */}
      <div aria-hidden="true" style={{ position: "absolute", top: "5%", right: "-15%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(156,61,42,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div aria-hidden="true" style={{ position: "absolute", bottom: "10%", left: "-15%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(26,92,82,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ textAlign: "center", marginBottom: 40, position: "relative", zIndex: 1 }}
      >
        <h1 className="display-lg" style={{ margin: "0 0 16px" }}>
          {"Plan Your "}
          <span style={{ color: "var(--primary)" }}>Weekend</span>
        </h1>
        <p className="body-lg" style={{ maxWidth: 320, margin: "0 auto" }}>
          Escribe una ciudad y te armamos el itinerario perfecto con los mejores lugares y eventos.
        </p>
      </motion.div>

      {/* Input + CTA */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 14, position: "relative", zIndex: 2 }}
      >
        {/* City input with dropdown */}
        <div ref={wrapperRef} style={{ position: "relative" }}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "var(--surface-container-lowest)",
              borderRadius: showDropdown ? "var(--r-lg) var(--r-lg) 0 0" : "var(--r-full)",
              padding: "0 14px 0 20px",
              boxShadow: focused
                ? `0 0 0 3px ${validated ? "rgba(26,92,82,0.12)" : "rgba(156,61,42,0.12)"}, 0 4px 20px rgba(77,33,35,0.08)`
                : "var(--shadow-card)",
              transition: "all 0.2s ease",
            }}
          >
            {loadingSuggestions ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            ) : validated ? (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="7" stroke="var(--secondary)" strokeWidth="1.5" />
                <path d="M5 8l2 2 4-4" stroke="var(--secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={focused ? "var(--primary)" : "var(--text-muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "stroke 0.2s" }}>
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
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontSize: "1.05rem", color: "var(--on-surface)", height: 56,
                caretColor: "var(--primary)", fontFamily: "Be Vietnam Pro, system-ui, sans-serif",
              }}
            />

            {ciudad && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setCiudad(""); setValidated(false); setSuggestions([]); setShowDropdown(false); inputRef.current?.focus(); }}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--surface-container-high)", border: "none",
                  cursor: "pointer", color: "var(--text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1rem", flexShrink: 0,
                }}
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
                  background: "var(--surface-container-lowest)",
                  borderRadius: "0 0 var(--r-lg) var(--r-lg)",
                  boxShadow: "0 8px 24px rgba(77,33,35,0.10)",
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
                      padding: "12px 16px", border: "none", background: "none",
                      cursor: "pointer", textAlign: "left",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-container-low)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M12 2C9.24 2 7 4.24 7 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
                      <circle cx="12" cy="7" r="2" fill="currentColor" stroke="none" />
                    </svg>
                    <div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--on-surface)", lineHeight: 1.2 }}>{s.text}</div>
                      <div style={{ fontSize: "0.73rem", color: "var(--text-muted)", marginTop: 1 }}>{s.place_name}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {showValidationHint && (
            <p style={{ fontSize: "0.72rem", color: "var(--error)", marginTop: 5, paddingLeft: 16, lineHeight: 1.4 }}>
              Selecciona una ciudad de la lista para continuar
            </p>
          )}
        </div>

        {/* Day selector */}
        <div>
          <label className="label-sm" style={{ display: "block", marginBottom: 8, paddingLeft: 4 }}>
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
                    height: 44,
                    borderRadius: "var(--r-full)",
                    border: "none",
                    background: active ? `${d.color}` : "var(--surface-container-lowest)",
                    color: active ? "white" : "var(--text-muted)",
                    fontWeight: active ? 700 : 500,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.18s",
                    boxShadow: active ? `0 4px 12px ${d.color}33` : "var(--shadow-card)",
                    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
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
          <label className="label-sm" style={{ display: "block", marginBottom: 6, paddingLeft: 4 }}>
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
              width: "100%", padding: "14px 18px",
              border: "none",
              borderRadius: "var(--r-lg)",
              background: "var(--surface-container-lowest)",
              fontSize: "0.93rem", color: "var(--on-surface)", resize: "none", outline: "none",
              lineHeight: 1.55, caretColor: "var(--primary)",
              boxShadow: ctxFocused
                ? "0 0 0 3px rgba(156,61,42,0.12), 0 4px 16px rgba(77,33,35,0.06)"
                : "var(--shadow-card)",
              transition: "box-shadow 0.2s",
              fontFamily: "Be Vietnam Pro, system-ui, sans-serif", boxSizing: "border-box",
            }}
          />
          <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 5, paddingLeft: 4, lineHeight: 1.4 }}>
            Ej: &ldquo;Busco experiencias para niños&rdquo;, &ldquo;Prefiero vida nocturna y gastronomía&rdquo;
          </p>
        </div>

        <motion.button
          whileTap={{ scale: canSubmit ? 0.97 : 1 }}
          onClick={() => handleSubmit(ciudad)}
          disabled={!canSubmit}
          className="btn-primary"
          style={{
            height: 56,
            opacity: canSubmit ? 1 : 1,
            background: canSubmit
              ? "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)"
              : "var(--surface-container-high)",
            color: canSubmit ? "white" : "var(--text-muted)",
            boxShadow: canSubmit ? "0 8px 24px rgba(156,61,42,0.28)" : "none",
            cursor: canSubmit ? "pointer" : "not-allowed",
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

      {/* Popular destinations */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.22 }}
        style={{ marginTop: 40, width: "100%", maxWidth: 440, position: "relative", zIndex: 1 }}
      >
        <p className="label-sm" style={{ textAlign: "center", marginBottom: 14 }}>
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
                display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                borderRadius: "var(--r-full)",
                background: "var(--surface-container-lowest)",
                border: "none",
                fontSize: "0.83rem", fontWeight: 500,
                color: "var(--on-surface-variant)", cursor: "pointer",
                boxShadow: "var(--shadow-card)", transition: "all 0.15s",
                fontFamily: "Be Vietnam Pro, system-ui, sans-serif",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.color = "var(--primary)";
                el.style.boxShadow = "var(--shadow-card-hover)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.color = "var(--on-surface-variant)";
                el.style.boxShadow = "var(--shadow-card)";
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
        style={{ marginTop: 44, fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center", position: "relative", zIndex: 1, lineHeight: 1.5 }}
      >
        Generado con IA · Solo destinos auténticos de México
      </motion.p>
    </div>
  );
}
