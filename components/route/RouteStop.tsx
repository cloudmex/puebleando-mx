"use client";
import { motion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RouteStop as RouteStopType } from "@/types";
import { CATEGORIES } from "@/lib/data";

interface RouteStopProps {
  stop: RouteStopType;
  index: number;
  onRemove: (placeId: string) => void;
}

export default function RouteStop({ stop, index, onRemove }: RouteStopProps) {
  const { place } = stop;
  const category = CATEGORIES.find((c) => c.id === place.category);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: place.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
      }}
    >
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        className="flex items-center gap-3 rounded-xl p-3"
        style={{ background: "white", border: "1px solid var(--border)" }}
      >
        {/* Order */}
        <div
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: "var(--terracota)" }}
        >
          {index + 1}
        </div>

        {/* Photo */}
        <div
          className="shrink-0 w-11 h-11 rounded-lg bg-cover bg-center"
          style={{ backgroundImage: `url(${place.photos[0]})` }}
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>
            {place.name}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {category?.icon} {category?.name} · {place.town}
          </p>
        </div>

        {/* Drag handle */}
        <button
          className="shrink-0 px-1.5 text-lg cursor-grab active:cursor-grabbing transition-opacity hover:opacity-60"
          style={{ color: "var(--border-strong)" }}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>

        {/* Remove */}
        <button
          onClick={() => onRemove(place.id)}
          className="shrink-0 px-1.5 text-sm transition-opacity hover:opacity-60"
          style={{ color: "var(--text-muted)" }}
        >
          ✕
        </button>
      </motion.div>
    </div>
  );
}
