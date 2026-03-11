"use client";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Place, CategoryId } from "@/types";
import { CATEGORIES } from "@/lib/data";
import PlaceCard from "@/components/ui/PlaceCard";
import CategoryFilter from "@/components/ui/CategoryFilter";

interface ExplorarClientProps {
  places: Place[];
}

export default function ExplorarClient({ places }: ExplorarClientProps) {
  const [selected, setSelected] = useState<CategoryId | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let list = places;
    if (selected) list = list.filter((p) => p.category === selected);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.town.toLowerCase().includes(q) ||
          p.state.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [places, selected, query]);

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
            {places.length} experiencias auténticas documentadas
          </p>

          {/* Search */}
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9rem" }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Buscar por nombre, estado, tags…"
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
              >
                ✕
              </button>
            )}
          </div>

          <CategoryFilter selected={selected} onSelect={setSelected} dark />
        </div>
        <div className="mexican-stripe" />
      </div>

      {/* Results */}
      <div
        className="px-4 pt-5 max-w-5xl mx-auto w-full"
        style={{ paddingBottom: "calc(var(--bottomnav-h) + 20px)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {query
              ? <>Resultados para "{query}"</>
              : activeCat
              ? <><span className="mr-1">{activeCat.icon}</span>{activeCat.name}</>
              : "Todos los lugares"}
          </p>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>

        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((place, i) => (
            <motion.div
              key={place.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <PlaceCard place={place} />
            </motion.div>
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🌵</p>
            <p className="font-semibold" style={{ color: "var(--text)" }}>Sin resultados</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {query ? `No encontramos "${query}"` : "Prueba con otra categoría"}
            </p>
            {(query || selected) && (
              <button
                onClick={() => { setQuery(""); setSelected(null); }}
                className="mt-4 text-sm font-semibold underline"
                style={{ color: "var(--terracota)" }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
