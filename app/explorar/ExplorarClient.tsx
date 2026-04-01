"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Place, CategoryId } from "@/types";
import { Event } from "@/types/events";
import { CATEGORIES, TRIP_TYPES, TripType } from "@/lib/data";
import { trackTripTypeSelection, getTopTripType } from "@/lib/tripPreferences";
import { tripTypeScore } from "@/lib/vibeScoring";
import { useAuth } from "@/components/auth/AuthProvider";
import { createRoute, addPlaceToRoute, canCreateRouteFree, canAddStopFree } from "@/lib/routeStore";
import PlaceCard from "@/components/ui/PlaceCard";
import EventCard from "@/components/ui/EventCard";
import CategoryFilter from "@/components/ui/CategoryFilter";
import AuthPrompt from "@/components/auth/AuthPrompt";

type SearchResult = { places: Place[]; events: Event[]; intent: { city?: string; category?: string } };
type Pick = { id: string; reason: string; place: Place; source: string };
type PicksResult = { intro: string; picks: Pick[] };

const DEBOUNCE_MS = 400;

interface ExplorarClientProps {
  defaultPlaces: Place[];
}

export default function ExplorarClient({ defaultPlaces }: ExplorarClientProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CategoryId | null>(null);
  const [activeTripType, setActiveTripType] = useState<TripType | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [picks, setPicks] = useState<PicksResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPicks, setLoadingPicks] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [authPromptMsg, setAuthPromptMsg] = useState("");
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [suggestedType, setSuggestedType] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Phase 3: Load personalized suggestion on mount
  useEffect(() => {
    const top = getTopTripType();
    if (top) setSuggestedType(top);
  }, []);

  const doSearch = useCallback(async (q: string, cat: string, tripType?: TripType) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    if (!q.trim() && !cat && !tripType) {
      setSearchResults(null);
      setPicks(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setPicks(null);

    try {
      // For trip type queries, use the queryHint as the search term
      const searchQ = tripType ? "" : q.trim();
      const params = new URLSearchParams();
      if (searchQ) params.set("q", searchQ);
      if (cat) params.set("category", cat);
      if (tripType) {
        params.set("tripTags", tripType.tags.join(","));
        // Pass boosted categories so the DB query can match by category too
        if (tripType.boostCategories?.length > 0) {
          params.set("boostCats", tripType.boostCategories.join(","));
        }
      }

      const res = await fetch(`/api/buscar?${params}`, { signal });
      if (!res.ok || signal.aborted) return;
      const data: SearchResult = await res.json();
      setSearchResults(data);
      setLoading(false);

      // Always get AI picks for trip type or text search
      if ((searchQ || tripType) && data.places.length > 0) {
        setLoadingPicks(true);
        const picksRes = await fetch("/api/buscar/picks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: searchQ || q,
            places: data.places,
            events: data.events,
            intent: data.intent,
            tripType: tripType ? { id: tripType.id, name: tripType.name, queryHint: tripType.queryHint } : undefined,
          }),
          signal,
        });
        if (!picksRes.ok || signal.aborted) { setLoadingPicks(false); return; }
        const picksData: PicksResult = await picksRes.json();
        setPicks(picksData);
        setLoadingPicks(false);
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setLoading(false);
        setLoadingPicks(false);
      }
    }
  }, []);

  useEffect(() => {
    if (activeTripType) return; // trip type searches are triggered directly
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(query, selected ?? "");
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selected, doSearch, activeTripType]);

  function handleTripTypeSelect(tt: TripType) {
    setActiveTripType(tt);
    setQuery("");
    setSelected(null);
    trackTripTypeSelection(tt.id);
    doSearch("", "", tt);
  }

  function clearTripType() {
    setActiveTripType(null);
    setSearchResults(null);
    setPicks(null);
    setLoading(false);
    setLoadingPicks(false);
  }

  // Phase 5: Save picks as route (with auth gate)
  function handleSaveAsRoute() {
    if (!picks || picks.picks.length === 0) return;

    if (!user) {
      setAuthPromptMsg("Guarda este plan como ruta para no perderlo.");
      setShowAuthPrompt(true);
      return;
    }

    if (!canCreateRouteFree() && !user) {
      setAuthPromptMsg("Crea una cuenta para guardar más rutas.");
      setShowAuthPrompt(true);
      return;
    }

    const routeName = activeTripType
      ? `Plan ${activeTripType.name}`
      : `Plan: ${query || "Mis recomendaciones"}`;

    const route = createRoute(routeName, picks.intro);
    let added = 0;
    for (const pick of picks.picks) {
      if (pick.place && (user || canAddStopFree(route.id))) {
        addPlaceToRoute(route.id, pick.place);
        added++;
      }
    }

    if (added > 0) {
      setSavedFeedback(`Ruta "${routeName}" guardada con ${added} parada${added > 1 ? "s" : ""}`);
      setTimeout(() => setSavedFeedback(null), 3000);
    }
  }

  const pickedIds = new Set((picks?.picks ?? []).map(p => p.id));

  const isSearching = query.trim() !== "" || selected !== null || activeTripType !== null;
  const displayPlaces = isSearching
    ? (searchResults?.places ?? []).filter(p => !pickedIds.has(p.id))
    : defaultPlaces;
  const displayEvents = isSearching ? (searchResults?.events ?? []) : [];
  const total = (searchResults?.places.length ?? 0) + (searchResults?.events.length ?? 0);
  const activeCat = CATEGORIES.find((c) => c.id === selected);

  // Reorder trip types to show suggested first
  const orderedTripTypes = suggestedType
    ? [
        ...TRIP_TYPES.filter(t => t.id === suggestedType),
        ...TRIP_TYPES.filter(t => t.id !== suggestedType),
      ]
    : TRIP_TYPES;

  return (
    <main style={{ minHeight: "100vh", background: "var(--surface)", paddingTop: "var(--topbar-h)" }}>

      {/* Header */}
      <div style={{ background: "var(--surface-container-low)", paddingBottom: 20 }}>
        <div className="px-5 pt-10 pb-2">
          <p className="label-sm" style={{ color: "var(--primary)", marginBottom: 8 }}>
            Descubre México
          </p>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="display-md"
            style={{ marginBottom: 4 }}
          >
            Explorar
          </motion.h1>
          <p className="body-lg" style={{ marginBottom: 20, fontSize: "0.88rem" }}>
            {activeTripType
              ? `${activeTripType.icon} ${activeTripType.name} — ${total} sugerencias`
              : isSearching
                ? `${total} resultado${total !== 1 ? "s" : ""}`
                : `${defaultPlaces.length} lugares verificados`}
          </p>

          {/* Search */}
          <div className="relative mb-5">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Museos en Oaxaca, artesanías Guadalajara…"
              aria-label="Buscar lugares y eventos"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (activeTripType) clearTripType();
              }}
              className="w-full pl-11 pr-10 rounded-full text-sm outline-none"
              style={{
                height: 48,
                background: "var(--surface-container-lowest)",
                color: "var(--on-surface)",
                caretColor: "var(--primary)",
                boxShadow: "var(--shadow-card)",
                border: "none",
                fontFamily: "Be Vietnam Pro, system-ui, sans-serif",
              }}
            />
            {(query || activeTripType) && (
              <button
                onClick={() => { setQuery(""); clearTripType(); setSelected(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ color: "var(--text-muted)", fontSize: "0.8rem", background: "var(--surface-container-high)" }}
                aria-label="Limpiar búsqueda"
              >✕</button>
            )}
          </div>

          {!activeTripType && (
            <CategoryFilter selected={selected} onSelect={setSelected} />
          )}

          {/* Active trip type badge */}
          {activeTripType && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2"
            >
              <span
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
                style={{
                  background: activeTripType.color,
                  color: "#fff",
                  boxShadow: `0 4px 12px ${activeTripType.color}33`,
                }}
              >
                {activeTripType.icon} {activeTripType.name}
              </span>
              <button
                onClick={clearTripType}
                className="btn-ghost"
                style={{ fontSize: "0.8rem", padding: "6px 12px" }}
              >
                Cambiar
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className="px-4 pt-6 max-w-5xl mx-auto w-full"
        style={{ paddingBottom: "calc(var(--bottomnav-h) + 24px)" }}
      >

        {/* ─── Phase 1: Trip type cards (default state) ─── */}
        {!isSearching && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-10"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="headline-md" style={{ fontSize: "1.05rem" }}>
                  ¿Qué tipo de viaje quieres?
                </p>
                <p className="body-lg" style={{ fontSize: "0.82rem", marginTop: 2 }}>
                  Elige y te armamos un plan personalizado
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {orderedTripTypes.map((tt, i) => (
                <motion.button
                  key={tt.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleTripTypeSelect(tt)}
                  style={{
                    background: "var(--surface-container-lowest)",
                    border: "none",
                    borderRadius: "var(--r-lg)",
                    padding: "20px 16px",
                    cursor: "pointer",
                    textAlign: "center",
                    boxShadow: "var(--shadow-card)",
                    transition: "box-shadow 0.2s, transform 0.15s",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card-hover)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
                  }}
                >
                  {/* Accent stripe at top */}
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: tt.color,
                  }} />

                  {/* Suggested badge */}
                  {suggestedType === tt.id && (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "var(--tertiary-container)",
                        color: "var(--tertiary)",
                        fontSize: "0.6rem",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Para ti
                    </span>
                  )}

                  <span style={{ fontSize: "2rem", display: "block", marginBottom: 8 }}>
                    {tt.icon}
                  </span>
                  <span
                    className="title-md"
                    style={{ display: "block", fontSize: "0.88rem", marginBottom: 4 }}
                  >
                    {tt.name}
                  </span>
                  <span
                    className="body-lg"
                    style={{ display: "block", fontSize: "0.72rem", lineHeight: 1.4 }}
                  >
                    {tt.description}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* AI recommendations section */}
        <AnimatePresence>
          {isSearching && (loadingPicks || (picks && picks.picks.length > 0)) && (
            <motion.div
              key="picks"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-8"
            >
              {picks?.intro && (
                <p className="body-lg mb-4">
                  {picks.intro}
                </p>
              )}

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="label-sm">
                    {activeTripType ? `Plan ${activeTripType.name}` : "Recomendados para ti"}
                  </span>
                  <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium"
                    style={{ background: "var(--tertiary-container)", color: "var(--tertiary)" }}>
                    Verificados
                  </span>
                </div>

                {/* Phase 5: Save as route button */}
                {picks && picks.picks.length > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSaveAsRoute}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{
                      background: "var(--secondary)",
                      color: "var(--on-secondary)",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(26,92,82,0.2)",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                    Guardar plan
                  </motion.button>
                )}
              </div>

              {loadingPicks && !picks && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="rounded-3xl animate-pulse" style={{ height: 240, background: "var(--surface-container-low)" }} />
                  ))}
                </div>
              )}

              {picks && picks.picks.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {picks.picks.map((pick, i) => (
                    <motion.div key={pick.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}>
                      <PlaceCard
                        place={pick.place}
                        highlight
                        pickReason={pick.reason}
                        vibeBadge={activeTripType ? activeTripType.name : undefined}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Saved feedback toast */}
        <AnimatePresence>
          {savedFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              style={{
                position: "fixed",
                bottom: "calc(var(--bottomnav-h) + 16px)",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 900,
                background: "var(--secondary)",
                color: "var(--on-secondary)",
                padding: "12px 20px",
                borderRadius: "var(--r-full)",
                fontSize: "0.85rem",
                fontWeight: 600,
                boxShadow: "var(--shadow-popup)",
                whiteSpace: "nowrap",
              }}
            >
              {savedFeedback}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section header */}
        {!loading && isSearching && (
          <div className="flex items-center justify-between mb-5">
            <p className="headline-md" style={{ fontSize: "1rem" }}>
              {query.trim()
                ? <>Resultados para &ldquo;{query}&rdquo;</>
                : activeTripType
                  ? "Más lugares que te pueden gustar"
                  : activeCat
                    ? <><span className="mr-1">{activeCat.icon}</span>{activeCat.name}</>
                    : "Los mejores lugares"}
            </p>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {displayPlaces.length} {displayPlaces.length === 1 ? "lugar" : "lugares"}
            </span>
          </div>
        )}

        {/* Default places header (no search) */}
        {!loading && !isSearching && (
          <div className="flex items-center justify-between mb-5">
            <p className="headline-md" style={{ fontSize: "1rem" }}>
              Los mejores lugares
            </p>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {defaultPlaces.length} lugares
            </span>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-3xl animate-pulse"
                style={{ height: 220, background: "var(--surface-container-low)" }} />
            ))}
          </div>
        )}

        {/* No results */}
        {!loading && isSearching && total === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">🌵</p>
            <p className="headline-md mb-2">Sin resultados</p>
            <p className="body-lg">
              Prueba con otra ciudad o tipo de experiencia
            </p>
            <button
              onClick={() => { setQuery(""); setSelected(null); clearTripType(); }}
              className="mt-5 text-sm font-semibold"
              style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}
            >
              Ver todos los lugares
            </button>
          </div>
        )}

        {/* Events */}
        {!loading && displayEvents.length > 0 && (
          <div className="mb-8">
            <p className="label-sm mb-4">Eventos</p>
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayEvents.map((e, i) => (
                <motion.div key={e.id} layout
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}>
                  <EventCard event={e} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        {/* Places grid */}
        {!loading && displayPlaces.length > 0 && (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayPlaces.map((p, i) => {
              const badge = activeTripType && tripTypeScore(p, activeTripType.id) >= 40
                ? activeTripType.name
                : undefined;
              return (
              <motion.div key={p.id} layout
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}>
                <PlaceCard place={p} vibeBadge={badge} />
              </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Auth prompt modal */}
      <AuthPrompt
        open={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        title="Guarda tu plan"
        message={authPromptMsg}
      />
    </main>
  );
}
