"use client";
import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { AnimatePresence } from "framer-motion";
import { Route, RouteStop, getStopId } from "@/types";
import RouteStopCard from "./RouteStop";
import { reorderStops, removeStopFromRoute } from "@/lib/routeStore";

interface RouteBuilderProps {
  route: Route;
  onChange: (route: Route) => void;
}

export default function RouteBuilder({ route, onChange }: RouteBuilderProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIdx = route.stops.findIndex((s) => getStopId(s) === active.id);
      const newIdx = route.stops.findIndex((s) => getStopId(s) === over.id);
      const reordered = arrayMove(route.stops, oldIdx, newIdx) as RouteStop[];

      const updated = reorderStops(route.id, reordered);
      if (updated) onChange(updated);
    },
    [route, onChange]
  );

  const handleRemove = useCallback(
    (itemId: string) => {
      const updated = removeStopFromRoute(route.id, itemId);
      if (updated) onChange(updated);
    },
    [route.id, onChange]
  );

  if (route.stops.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-4xl mb-3">📍</p>
        <p className="font-semibold mb-1" style={{ color: "var(--text)" }}>
          Tu ruta está vacía
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Agrega lugares y eventos desde su página de detalle
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={route.stops.map((s) => getStopId(s))}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {route.stops.map((stop, i) => (
              <RouteStopCard
                key={getStopId(stop)}
                stop={stop}
                index={i}
                onRemove={handleRemove}
              />
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
    </DndContext>
  );
}
