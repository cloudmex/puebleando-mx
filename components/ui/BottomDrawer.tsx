"use client";
import { useState } from "react";
import { motion } from "framer-motion";

interface BottomDrawerProps {
  children: React.ReactNode;
  /** Slot visible incluso cuando está colapsado (filtros, counters) */
  filterSlot?: React.ReactNode;
  count?: number;
  label?: string;
}

const COLLAPSED_H = 240;
const EXPANDED_H = "76vh";

export default function BottomDrawer({ children, filterSlot, count, label = "Lugares" }: BottomDrawerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      animate={{ height: expanded ? EXPANDED_H : COLLAPSED_H }}
      transition={{ type: "spring", stiffness: 280, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-40 flex flex-col bg-white"
      style={{
        borderRadius: "var(--r-xl) var(--r-xl) 0 0",
        boxShadow: "var(--shadow-sheet)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "var(--bottomnav-h)",
      }}
    >
      {/* Handle + header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full shrink-0 flex flex-col items-center pt-3 pb-1"
        aria-label={expanded ? "Colapsar lista" : "Expandir lista"}
      >
        <div className="w-8 h-1 rounded-full mb-2" style={{ background: "var(--border-strong)" }} />
        <div className="flex items-center gap-2 pb-1">
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {label}
          </span>
          {count !== undefined && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: "var(--terracota)", color: "white" }}
            >
              {count}
            </span>
          )}
          <span
            className="text-xs ml-1"
            style={{
              color: "var(--text-muted)",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              display: "inline-block",
              transition: "transform 0.25s",
            }}
          >
            ›
          </span>
        </div>
      </button>

      {/* Filter slot — always visible */}
      {filterSlot && (
        <div className="shrink-0 px-4 pb-3">
          {filterSlot}
        </div>
      )}

      {/* Divider */}
      <div className="shrink-0 mx-4" style={{ borderTop: "1px solid var(--border)" }} />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2">
        {children}
      </div>
    </motion.div>
  );
}
