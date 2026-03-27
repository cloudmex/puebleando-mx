"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface BottomDrawerProps {
  children: React.ReactNode;
  filterSlot?: React.ReactNode;
  count?: number;
  label?: string;
  showLoading?: boolean;
  forceOpen?: boolean;
}

const COLLAPSED_H = 240;
const EXPANDED_H = "76vh";

export default function BottomDrawer({
  children,
  filterSlot,
  count,
  label = "Lugares",
  showLoading = false,
  forceOpen = false,
}: BottomDrawerProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (forceOpen) setExpanded(true);
  }, [forceOpen]);

  return (
    <motion.div
      animate={{ height: expanded ? EXPANDED_H : COLLAPSED_H }}
      transition={{ type: "spring", stiffness: 280, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-40 flex flex-col glass"
      style={{
        borderRadius: "var(--r-xl) var(--r-xl) 0 0",
        boxShadow: "var(--shadow-sheet)",
        paddingBottom: "calc(var(--bottomnav-h) + var(--safe-bottom))",
      }}
    >
      {/* Handle + header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full shrink-0 flex flex-col items-center pt-3.5 pb-1.5"
        aria-label={expanded ? "Colapsar lista" : "Expandir lista"}
      >
        <div className="w-9 h-1 rounded-full mb-2.5" style={{ background: "var(--outline)" }} />
        <div className="flex items-center gap-2.5 pb-1">
          {showLoading && (
            <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin mr-1"
              style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
          )}
          <span className="headline-md" style={{ fontSize: "0.95rem" }}>
            {label}
          </span>
          {count !== undefined && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full"
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--primary-container))",
                color: "white",
              }}
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

      {/* Filter slot */}
      {filterSlot && (
        <div className="shrink-0 px-4 pb-3">
          {filterSlot}
        </div>
      )}

      {/* Subtle divider via background shift */}
      <div className="shrink-0 mx-5 h-px" style={{ background: "var(--outline-variant)" }} />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2">
        {children}
      </div>
    </motion.div>
  );
}
