"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Place, CategoryId } from "@/types";
import { Event } from "@/types/events";
import { CATEGORIES } from "@/lib/data";
import PlaceCard from "@/components/ui/PlaceCard";
import EventCard from "@/components/ui/EventCard";
import CategoryFilter from "@/components/ui/CategoryFilter";

type SearchResult = { places: Place[]; events: Event[]; intent: { city?: string; category?: string } };
type Pick = { id: string; reason: string; place: Place; source: string };
type PicksResult = { intro: string; picks: Pick[] };

const DEBOUNCE_MS = 400;

interface ExplorarClientProps {
  defaultPlaces: Place[];
}

export default function ExplorarClient({ defaultPlaces }: ExplorarClientProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CategoryId | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [picks, setPicks] = useState<PicksResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPicks, setLoadingPicks] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string, cat: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    if (!q.trim() && !cat) {
      setSearchResults(null);
      setPicks(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setPicks(null);

    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (cat) params.set("category", cat);

      const res = await fetch(`/api/buscar?${params}`, { signal });
      if (!res.ok || signal.aborted) return;
      const data: SearchResult = await res.json();
      setSearchResults(data);
      setLoading(false);

      if (q.trim() && data.places.length > 0) {
        setLoadingPicks(true);
        const picksRes = await fetch("/api/buscar/picks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, places: data.places, events: data.events, intent: data.intent }),
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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(query, selected ?? "");
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selected, doSearch]);

  const pickedIds = new Set((picks?.picks ?? []).map(p => p.id));

  const isSearching = query.trim() !== "" || selected !== null;
  const displayPlaces = isSearching
    ? (searchResults?.places ?? []).filter(p => !pickedIds.has(p.id))
    : defaultPlaces;
  const displayEvents = isSearching ? (searchResults?.events ?? []) : [];
  const total = (searchResults?.places.length ?? 0) + (searchResults?.events.length ?? 0);
  const activeCat = CATEGORIES.find((c) => c.id === selected);

  return (
    <main style={{ minHeight: "100vh", background: "var(--surface)", paddingTop: "var(--topbar-h)" }}>

      {/* Header — warm surface, editorial */}
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
            {isSearching ? `${total} resultado${total !== 1 ? "s" : ""}` : `${defaultPlaces.length} lugares verificados`}
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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ color: "var(--text-muted)", fontSize: "0.8rem", background: "var(--surface-container-high)" }}
                aria-label="Limpiar búsqueda"
              >✕</button>
            )}
          </div>

          <CategoryFilter selected={selected} onSelect={setSelected} />
        </div>
      </div>

      {/* Content */}
      <div
        className="px-4 pt-6 max-w-5xl mx-auto w-full"
        style={{ paddingBottom: "calc(var(--bottomnav-h) + 24px)" }}
      >
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

              <div className="flex items-center gap-2 mb-4">
                <span className="label-sm">
                  Recomendados para ti
                </span>
                <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium"
                  style={{ background: "var(--tertiary-container)", color: "var(--tertiary)" }}>
                  Verificados
                </span>
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
                      <PlaceCard place={pick.place} highlight pickReason={pick.reason} />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section header */}
        {!loading && (
          <div className="flex items-center justify-between mb-5">
            <p className="headline-md" style={{ fontSize: "1rem" }}>
              {query.trim()
                ? <>Resultados para &ldquo;{query}&rdquo;</>
                : activeCat
                  ? <><span className="mr-1">{activeCat.icon}</span>{activeCat.name}</>
                  : "Los mejores lugares"}
            </p>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {total} {total === 1 ? "lugar" : "lugares"}
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
              onClick={() => { setQuery(""); setSelected(null); }}
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
            {displayPlaces.map((p, i) => (
              <motion.div key={p.id} layout
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}>
                <PlaceCard place={p} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </main>
  );
}
