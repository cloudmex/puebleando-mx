"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// ── Data ─────────────────────────────────────────────────────────────────
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

const VIBES = [
  { id: "gastronomia", emoji: "🍽️", label: "Gastronomía" },
  { id: "cultura",     emoji: "🎭", label: "Cultura" },
  { id: "naturaleza",  emoji: "🌿", label: "Naturaleza" },
  { id: "nightlife",   emoji: "🌙", label: "Vida nocturna" },
  { id: "familia",     emoji: "👨‍👩‍👧‍👦", label: "Familiar" },
  { id: "aventura",    emoji: "🧗", label: "Aventura" },
  { id: "romantico",   emoji: "💑", label: "Romántico" },
  { id: "relax",       emoji: "🧘", label: "Relax" },
  { id: "mercados",    emoji: "🛍️", label: "Mercados" },
  { id: "artesanal",   emoji: "🪴", label: "Artesanal" },
];

type DayKey = "viernes" | "sabado" | "domingo";
const ALL_DAYS: { key: DayKey; label: string; sublabel: string; color: string }[] = [
  { key: "viernes", label: "Vie",  sublabel: "Solo noche", color: "#1A8FA0" },
  { key: "sabado",  label: "Sáb",  sublabel: "Día completo", color: "var(--primary)" },
  { key: "domingo", label: "Dom",  sublabel: "Día completo", color: "var(--secondary)" },
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
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=mx&types=place,locality,district&language=es&limit=6&access_token=${MAPBOX_TOKEN}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? []).map((f: any) => ({
      id: f.id, text: f.text, place_name: f.place_name, center: f.center,
    }));
  } catch { return []; }
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place&language=es&limit=1&access_token=${MAPBOX_TOKEN}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.features?.[0]?.text ?? null;
  } catch { return null; }
}

// ── Step transition ──────────────────────────────────────────────────────
const stepVariants = {
  enter: { opacity: 0, x: 60 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
};

// ── Component ────────────────────────────────────────────────────────────
export default function PlanInput() {
  const [step, setStep] = useState(0); // 0=location, 1=destino, 2=vibes, 3=days+go
  const [userCity, setUserCity] = useState<string | null>(null);
  const [geoState, setGeoState] = useState<"asking" | "detecting" | "done" | "denied">("asking");

  const [ciudad, setCiudad] = useState("");
  const [vibes, setVibes] = useState<string[]>([]);
  const [dias, setDias] = useState<DayKey[]>(["sabado", "domingo"]);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [validated, setValidated] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ── Geolocation on step 0 ──────────────────────────────────────────────
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeoState("denied"); return; }
    setGeoState("detecting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setUserCity(name);
        setGeoState("done");
        // Auto-advance after a beat
        setTimeout(() => setStep(1), 600);
      },
      () => {
        setGeoState("denied");
        setTimeout(() => setStep(1), 400);
      },
      { timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  // Auto-trigger geolocation on mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // ── City suggestions ───────────────────────────────────────────────────
  useEffect(() => {
    if (validated || ciudad.trim().length < 2) {
      setSuggestions([]); setShowDropdown(false); return;
    }
    setLoadingSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(ciudad);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setLoadingSuggestions(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [ciudad, validated]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectSuggestion = useCallback((s: Suggestion) => {
    setCiudad(s.text);
    setValidated(true);
    setSuggestions([]); setShowDropdown(false);
    inputRef.current?.blur();
    // Auto-advance
    setTimeout(() => setStep(2), 350);
  }, []);

  const toggleVibe = (id: string) => {
    setVibes((prev) => prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]);
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

  const handleGo = (destino?: string) => {
    const target = destino ?? ciudad;
    if (!target.trim()) return;
    const slug = encodeURIComponent(target.trim().toLowerCase().replace(/\s+/g, "-"));
    const params = new URLSearchParams();
    params.set("dias", dias.join(","));
    if (vibes.length > 0) {
      params.set("ctx", vibes.map((v) => VIBES.find((x) => x.id === v)?.label ?? v).join(", "));
    }
    router.push(`/planear/${slug}?${params.toString()}`);
  };

  // ── Progress dots ──────────────────────────────────────────────────────
  const totalSteps = 4;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "calc(var(--topbar-h) + var(--safe-top) + 24px) 24px calc(var(--bottomnav-h) + var(--safe-bottom) + 24px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative blobs */}
      <div aria-hidden="true" style={{ position: "absolute", top: "5%", right: "-15%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(156,61,42,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div aria-hidden="true" style={{ position: "absolute", bottom: "10%", left: "-15%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(26,92,82,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32, position: "relative", zIndex: 1 }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            style={{
              width: step === i ? 24 : 8,
              height: 8,
              borderRadius: 4,
              background: i <= step ? "var(--primary)" : "var(--outline-variant)",
              transition: "all 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* Steps */}
      <div style={{ width: "100%", maxWidth: 440, position: "relative", zIndex: 2, minHeight: 340 }}>
        <AnimatePresence mode="wait">
          {/* ─── Step 0: Location ──────────────────────────────────── */}
          {step === 0 && (
            <motion.div
              key="step0"
              variants={stepVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, textAlign: "center" }}
            >
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, rgba(26,92,82,0.12), rgba(156,61,42,0.08))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {geoState === "detecting" ? (
                  <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                ) : (
                  <span style={{ fontSize: "2rem" }}>📍</span>
                )}
              </div>

              <div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--on-surface)", margin: "0 0 8px" }}>
                  {geoState === "detecting" ? "Localizándote..." :
                   geoState === "done" && userCity ? `¡Hola desde ${userCity}!` :
                   "¿Dónde te encuentras?"}
                </h2>
                <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                  {geoState === "detecting" ? "Esto nos ayuda a sugerirte cómo llegar" :
                   geoState === "done" ? "Te sugeriremos cómo llegar a tu destino" :
                   "Permite tu ubicación para recomendaciones de transporte"}
                </p>
              </div>

              {geoState === "asking" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={requestLocation}
                    style={{
                      height: 52, borderRadius: "var(--r-full)", border: "none",
                      background: "linear-gradient(135deg, var(--secondary) 0%, #1a5c52 100%)",
                      color: "white", fontWeight: 600, fontSize: "0.93rem", cursor: "pointer",
                      boxShadow: "0 6px 20px rgba(26,92,82,0.25)",
                    }}
                  >
                    📍 Permitir ubicación
                  </motion.button>
                  <button
                    onClick={() => setStep(1)}
                    style={{
                      height: 44, borderRadius: "var(--r-full)", border: "none",
                      background: "none", color: "var(--text-muted)", fontWeight: 500,
                      fontSize: "0.85rem", cursor: "pointer",
                    }}
                  >
                    Saltar por ahora
                  </button>
                </div>
              )}

              {geoState === "denied" && (
                <button
                  onClick={() => setStep(1)}
                  style={{
                    height: 48, borderRadius: "var(--r-full)", border: "none", padding: "0 32px",
                    background: "var(--surface-container-lowest)", color: "var(--on-surface)",
                    fontWeight: 600, fontSize: "0.9rem", cursor: "pointer",
                    boxShadow: "var(--shadow-card)",
                  }}
                >
                  Continuar →
                </button>
              )}
            </motion.div>
          )}

          {/* ─── Step 1: Destination ──────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              variants={stepVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "flex", flexDirection: "column", gap: 20 }}
            >
              <div style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--on-surface)", margin: "0 0 6px" }}>
                  ¿A dónde quieres ir?
                </h2>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                  Escribe o elige un destino
                </p>
              </div>

              {/* Search input */}
              <div ref={wrapperRef} style={{ position: "relative" }}>
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "var(--surface-container-lowest)",
                    borderRadius: showDropdown ? "var(--r-lg) var(--r-lg) 0 0" : "var(--r-full)",
                    padding: "0 14px 0 20px",
                    boxShadow: "var(--shadow-card)",
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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Oaxaca, Sayulita, Mérida…"
                    value={ciudad}
                    onChange={(e) => { setCiudad(e.target.value); setValidated(false); }}
                    onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
                    onKeyDown={(e) => { if (e.key === "Escape") setShowDropdown(false); }}
                    autoFocus
                    style={{
                      flex: 1, border: "none", outline: "none", background: "transparent",
                      fontSize: "1.05rem", color: "var(--on-surface)", height: 54,
                      caretColor: "var(--primary)", fontFamily: "Be Vietnam Pro, system-ui, sans-serif",
                    }}
                  />
                  {ciudad && (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setCiudad(""); setValidated(false); setSuggestions([]); setShowDropdown(false); inputRef.current?.focus(); }}
                      style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-container-high)", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}
                    >×</button>
                  )}
                </div>
                <AnimatePresence>
                  {showDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: "var(--surface-container-lowest)", borderRadius: "0 0 var(--r-lg) var(--r-lg)", boxShadow: "0 8px 24px rgba(77,33,35,0.10)", overflow: "hidden" }}
                    >
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectSuggestion(s)}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left", transition: "background 0.12s" }}
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
              </div>

              {/* Quick picks */}
              <div>
                <p className="label-sm" style={{ textAlign: "center", marginBottom: 10 }}>
                  O elige un destino popular
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {DESTINOS.map((d, i) => (
                    <motion.button
                      key={d.nombre}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.05 + i * 0.03 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => {
                        setCiudad(d.nombre);
                        setValidated(true);
                        setTimeout(() => setStep(2), 200);
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "9px 16px", minHeight: 42, borderRadius: "var(--r-full)",
                        background: "var(--surface-container-lowest)", border: "none",
                        fontSize: "0.83rem", fontWeight: 500, color: "var(--on-surface-variant)",
                        cursor: "pointer", boxShadow: "var(--shadow-card)", transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: "0.9rem" }}>{d.emoji}</span>
                      {d.nombre}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── Step 2: Vibes ────────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              variants={stepVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "flex", flexDirection: "column", gap: 24 }}
            >
              <div style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--on-surface)", margin: "0 0 6px" }}>
                  ¿Qué vibra buscas?
                </h2>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                  Elige una o más — tu plan se adapta
                </p>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                {VIBES.map((v, i) => {
                  const active = vibes.includes(v.id);
                  return (
                    <motion.button
                      key={v.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i }}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => toggleVibe(v.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 7,
                        padding: "10px 18px", minHeight: 46, borderRadius: "var(--r-full)",
                        background: active ? "var(--primary)" : "var(--surface-container-lowest)",
                        border: active ? "none" : "1.5px solid var(--outline-variant)",
                        color: active ? "white" : "var(--on-surface)",
                        fontWeight: active ? 700 : 500, fontSize: "0.88rem",
                        cursor: "pointer", transition: "all 0.18s",
                        boxShadow: active ? "0 4px 14px rgba(156,61,42,0.22)" : "none",
                      }}
                    >
                      <span style={{ fontSize: "1rem" }}>{v.emoji}</span>
                      {v.label}
                    </motion.button>
                  );
                })}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setStep(3)}
                style={{
                  height: 52, borderRadius: "var(--r-full)", border: "none",
                  background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)",
                  color: "white", fontWeight: 600, fontSize: "0.93rem", cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(156,61,42,0.25)",
                }}
              >
                {vibes.length > 0 ? `Continuar con ${vibes.length} vibe${vibes.length > 1 ? "s" : ""} →` : "Continuar sin filtro →"}
              </motion.button>
            </motion.div>
          )}

          {/* ─── Step 3: Days + Go ────────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step3"
              variants={stepVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "flex", flexDirection: "column", gap: 24 }}
            >
              <div style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--on-surface)", margin: "0 0 6px" }}>
                  ¿Qué días vas?
                </h2>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                  Selecciona los días de tu escapada
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                {ALL_DAYS.map((d) => {
                  const active = dias.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      onClick={() => toggleDay(d.key)}
                      style={{
                        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                        gap: 4, padding: "16px 0", borderRadius: "var(--r-lg)",
                        border: active ? "none" : "1.5px solid var(--outline-variant)",
                        background: active ? d.color : "var(--surface-container-lowest)",
                        color: active ? "white" : "var(--text-muted)",
                        cursor: "pointer", transition: "all 0.18s",
                        boxShadow: active ? `0 4px 14px ${d.color}33` : "none",
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: "1rem" }}>{d.label}</span>
                      <span style={{ fontSize: "0.68rem", opacity: 0.8 }}>{d.sublabel}</span>
                    </button>
                  );
                })}
              </div>

              {/* Summary card */}
              <div style={{
                background: "var(--surface-container-lowest)", borderRadius: "var(--r-lg)",
                padding: "16px 20px", boxShadow: "var(--shadow-card)",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "1.1rem" }}>📍</span>
                  <span style={{ fontSize: "0.93rem", fontWeight: 600, color: "var(--on-surface)" }}>{ciudad}</span>
                  <button onClick={() => setStep(1)} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--primary)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>Cambiar</button>
                </div>
                {vibes.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {vibes.map((v) => {
                      const vibe = VIBES.find((x) => x.id === v);
                      return vibe ? (
                        <span key={v} style={{ fontSize: "0.78rem", background: "var(--surface-container-high)", borderRadius: "var(--r-full)", padding: "3px 10px", color: "var(--on-surface-variant)" }}>
                          {vibe.emoji} {vibe.label}
                        </span>
                      ) : null;
                    })}
                    <button onClick={() => setStep(2)} style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>Editar</button>
                  </div>
                )}
                {userCity && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>🧳 Sales desde {userCity}</span>
                  </div>
                )}
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => handleGo()}
                style={{
                  height: 56, borderRadius: "var(--r-full)", border: "none",
                  background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)",
                  color: "white", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
                  boxShadow: "0 8px 28px rgba(156,61,42,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Generar mi plan
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{ marginTop: 36, fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center", position: "relative", zIndex: 1, lineHeight: 1.5 }}
      >
        Generado con IA · Solo destinos auténticos de México
      </motion.p>
    </div>
  );
}
