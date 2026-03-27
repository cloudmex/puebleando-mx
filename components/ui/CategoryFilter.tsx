"use client";
import { motion } from "framer-motion";
import { CategoryId } from "@/types";
import { CATEGORIES } from "@/lib/data";

import { CategoryIcon } from "./CategoryIcon";

interface CategoryFilterProps {
  selected: CategoryId | null;
  onSelect: (id: CategoryId | null) => void;
  dark?: boolean;
  useIcons?: boolean;
}

export default function CategoryFilter({ selected, onSelect, dark = false, useIcons = false }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar py-0.5">
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => onSelect(null)}
        className="shrink-0 flex items-center gap-1.5 px-4 rounded-full text-sm font-medium transition-all"
        style={{
          minHeight: 40,
          background: selected === null
            ? "linear-gradient(135deg, var(--primary), var(--primary-container))"
            : dark ? "rgba(255,255,255,0.08)" : "var(--surface-container-lowest)",
          color: selected === null ? "white" : dark ? "rgba(255,255,255,0.6)" : "var(--on-surface-variant)",
          boxShadow: selected === null ? "0 4px 12px rgba(156,61,42,0.2)" : "none",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 0 20"></path>
          <path d="M12 2a15.3 15.3 0 0 0 0 20"></path>
        </svg>
        Todos
      </motion.button>

      {CATEGORIES.map((cat) => {
        const active = selected === cat.id;
        return (
          <motion.button
            key={cat.id}
            whileTap={{ scale: 0.94 }}
            onClick={() => onSelect(active ? null : cat.id)}
            className="shrink-0 flex items-center gap-1.5 px-4 rounded-full text-sm font-medium transition-all"
            style={{
              minHeight: 40,
              background: active
                ? cat.color
                : dark ? "rgba(255,255,255,0.08)" : "var(--surface-container-lowest)",
              color: active ? "white" : dark ? "rgba(255,255,255,0.6)" : "var(--on-surface-variant)",
              boxShadow: active ? `0 4px 12px ${cat.color}33` : "none",
            }}
          >
            {useIcons ? (
              <CategoryIcon id={cat.id} size={16} color={active ? "white" : "currentColor"} />
            ) : (
              <span className="text-sm leading-none">{cat.icon}</span>
            )}
            <span>{cat.name}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
