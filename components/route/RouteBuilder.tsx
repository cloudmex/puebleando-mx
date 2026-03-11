"use client";
import { useState, useCallback } from "react";
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
import { Route, RouteStop } from "@/types";
import RouteStopCard from "./RouteStop";
import { reorderStops, removePlaceFromRoute } from "@/lib/routeStore";

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

      const oldIdx = route.stops.findIndex((s) => s.place.id === active.id);
      const newIdx = route.stops.findIndex((s) => s.place.id === over.id);
      const reordered = arrayMove(route.stops, oldIdx, newIdx) as RouteStop[];

      const updated = reorderStops(route.id, reordered);
      if (updated) onChange(updated);
    },
    [route, onChange]
  );

  const handleRemove = useCallback(
    (placeId: string) => {
      const updated = removePlaceFromRoute(route.id, placeId);
      if (updated) onChange(updated);
    },
    [route.id, onChange]
  );

  if (route.stops.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-4xl mb-3">📍</p>
        <p className="text-cafe font-semibold mb-1">Tu ruta está vacía</p>
        <p className="text-sm text-cafe-light">
          Agrega lugares desde la página de cada lugar
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={route.stops.map((s) => s.place.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {route.stops.map((stop, i) => (
              <RouteStopCard
                key={stop.place.id}
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
