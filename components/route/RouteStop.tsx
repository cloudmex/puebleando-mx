"use client";
import { motion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RouteStop as RouteStopType, getStopId, getStopName, getStopImage, getStopCategory, getStopLocation } from "@/types";
import { CATEGORIES } from "@/lib/data";

interface RouteStopProps {
  stop: RouteStopType;
  index: number;
  onRemove: (itemId: string) => void;
}

export default function RouteStop({ stop, index, onRemove }: RouteStopProps) {
  const itemId = getStopId(stop);
  const name = getStopName(stop);
  const image = getStopImage(stop);
  const categoryId = getStopCategory(stop);
  const location = getStopLocation(stop);
  const category = CATEGORIES.find((c) => c.id === categoryId);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: itemId });

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
        className="flex items-center gap-3 rounded-2xl p-3.5"
        style={{ background: "var(--surface-container-lowest)", boxShadow: "var(--shadow-card)" }}
      >
        {/* Order number */}
        <div
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: stop.type === "event" ? "var(--maiz)" : "var(--terracota)" }}
        >
          {index + 1}
        </div>

        {/* Thumbnail */}
        <div
          className="shrink-0 w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center"
          style={{ background: "var(--bg-muted)" }}
        >
          {image ? (
            <img src={image} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl">
              {category?.icon ?? (stop.type === "event" ? "📅" : "📍")}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>
            {name}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {category?.icon} {category?.name ?? (stop.type === "event" ? "Evento" : "Lugar")}
            {location && ` · ${location}`}
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
          onClick={() => onRemove(itemId)}
          className="shrink-0 px-1.5 text-sm transition-opacity hover:opacity-60"
          style={{ color: "var(--text-muted)" }}
        >
          ✕
        </button>
      </motion.div>
    </div>
  );
}
