"use client";
import { motion } from "framer-motion";
import { CategoryId } from "@/types";
import { CATEGORIES } from "@/lib/data";

interface CategoryFilterProps {
  selected: CategoryId | null;
  onSelect: (id: CategoryId | null) => void;
  dark?: boolean; // for use over dark backgrounds
}

export default function CategoryFilter({ selected, onSelect, dark = false }: CategoryFilterProps) {
  const base = dark
    ? { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "rgba(255,255,255,0.15)" }
    : { bg: "var(--bg)", color: "var(--text-secondary)", border: "var(--border)" };

  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar py-0.5">
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => onSelect(null)}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
        style={{
          background: selected === null ? "var(--terracota)" : base.bg,
          color: selected === null ? "white" : base.color,
          border: `1.5px solid ${selected === null ? "var(--terracota)" : base.border}`,
        }}
      >
        Todos
      </motion.button>

      {CATEGORIES.map((cat) => {
        const active = selected === cat.id;
        return (
          <motion.button
            key={cat.id}
            whileTap={{ scale: 0.94 }}
            onClick={() => onSelect(active ? null : cat.id)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
            style={{
              background: active ? cat.color : base.bg,
              color: active ? "white" : base.color,
              border: `1.5px solid ${active ? cat.color : base.border}`,
            }}
          >
            <span className="text-sm leading-none">{cat.icon}</span>
            <span>{cat.name}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
