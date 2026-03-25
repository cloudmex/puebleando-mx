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

      // 1. Fetch DB results (fast)
      const res = await fetch(`/api/buscar?${params}`, { signal });
      if (!res.ok || signal.aborted) return;
      const data: SearchResult = await res.json();
      setSearchResults(data);
      setLoading(false);

      // 2. Get AI recommendations + validation (async, non-blocking)
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

  // Picked IDs shown in highlights — exclude from main grid to avoid duplicates
  const pickedIds = new Set((picks?.picks ?? []).map(p => p.id));

  const isSearching = query.trim() !== "" || selected !== null;
  const displayPlaces = isSearching
    ? (searchResults?.places ?? []).filter(p => !pickedIds.has(p.id))
    : defaultPlaces;
  const displayEvents = isSearching ? (searchResults?.events ?? []) : [];
  const total = (searchResults?.places.length ?? 0) + (searchResults?.events.length ?? 0);
  const activeCat = CATEGORIES.find((c) => c.id === selected);

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", paddingTop: "var(--topbar-h)" }}>

      {/* Header */}
      <div style={{ background: "var(--dark)" }}>
        <div className="px-5 pt-8 pb-5">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-bold text-white mb-1"
            style={{ fontFamily: "Playfair Display, serif", fontSize: "1.8rem" }}
          >
            Explorar México
          </motion.h1>
          <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
            {isSearching ? `${total} resultado${total !== 1 ? "s" : ""}` : `${defaultPlaces.length} lugares verificados`}
          </p>

          {/* Search */}
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9rem" }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="ej. museos en Oaxaca, artesanías Guadalajara…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-9 rounded-xl text-sm outline-none"
              style={{
                height: 42,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "white",
                caretColor: "var(--terracota)",
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}
                aria-label="Limpiar búsqueda"
              >✕</button>
            )}
          </div>

          <CategoryFilter selected={selected} onSelect={setSelected} dark />
        </div>
        <div className="mexican-stripe" />
      </div>

      {/* Content */}
      <div
        className="px-4 pt-5 max-w-5xl mx-auto w-full"
        style={{ paddingBottom: "calc(var(--bottomnav-h) + 20px)" }}
      >
        {/* AI recommendations section */}
        <AnimatePresence>
          {isSearching && (loadingPicks || (picks && picks.picks.length > 0)) && (
            <motion.div
              key="picks"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6"
            >
              {/* Intro text */}
              {picks?.intro && (
                <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
                  {picks.intro}
                </p>
              )}

              {/* Section label */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Recomendados para ti
                </span>
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "#2D7D6215", color: "#2D7D62" }}>
                  ✓ Verificados INEGI
                </span>
              </div>

              {/* Loading skeleton for picks */}
              {loadingPicks && !picks && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="rounded-2xl animate-pulse" style={{ height: 220, background: "var(--bg-muted)" }} />
                  ))}
                </div>
              )}

              {/* Pick cards */}
              {picks && picks.picks.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl animate-pulse"
                style={{ height: 200, background: "var(--bg-muted)" }} />
            ))}
          </div>
        )}

        {/* No results (only when searching) */}
        {!loading && isSearching && total === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🌵</p>
            <p className="font-semibold" style={{ color: "var(--text)" }}>Sin resultados</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Prueba con otra ciudad o tipo de experiencia
            </p>
            <button
              onClick={() => { setQuery(""); setSelected(null); }}
              className="mt-4 text-sm font-semibold underline"
              style={{ color: "var(--terracota)" }}
            >
              Ver todos los lugares
            </button>
          </div>
        )}

        {/* Events (only appear in search results) */}
        {!loading && displayEvents.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--text-muted)" }}>
              Eventos
            </p>
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
