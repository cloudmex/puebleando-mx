"use client";
import { Place, Route, RouteStop } from "@/types";

const STORAGE_KEY = "puebleando_routes";

function loadRoutes(): Route[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRoutes(routes: Route[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
}

export function getRoutes(): Route[] {
  return loadRoutes();
}

export function getRoute(id: string): Route | undefined {
  return loadRoutes().find((r) => r.id === id);
}

export function createRoute(name: string, description = ""): Route {
  const routes = loadRoutes();
  const route: Route = {
    id: `r_${Date.now()}`,
    name,
    description,
    created_at: new Date().toISOString(),
    stops: [],
  };
  saveRoutes([...routes, route]);
  return route;
}

export function addPlaceToRoute(routeId: string, place: Place): Route | null {
  const routes = loadRoutes();
  const idx = routes.findIndex((r) => r.id === routeId);
  if (idx === -1) return null;

  const route = routes[idx];
  const already = route.stops.some((s) => s.place.id === place.id);
  if (already) return route;

  const updated: Route = {
    ...route,
    stops: [...route.stops, { place, order_index: route.stops.length }],
  };
  routes[idx] = updated;
  saveRoutes(routes);
  return updated;
}

export function removePlaceFromRoute(routeId: string, placeId: string): Route | null {
  const routes = loadRoutes();
  const idx = routes.findIndex((r) => r.id === routeId);
  if (idx === -1) return null;

  const route = routes[idx];
  const stops: RouteStop[] = route.stops
    .filter((s) => s.place.id !== placeId)
    .map((s, i) => ({ ...s, order_index: i }));

  const updated: Route = { ...route, stops };
  routes[idx] = updated;
  saveRoutes(routes);
  return updated;
}

export function reorderStops(routeId: string, stops: RouteStop[]): Route | null {
  const routes = loadRoutes();
  const idx = routes.findIndex((r) => r.id === routeId);
  if (idx === -1) return null;

  const updated: Route = {
    ...routes[idx],
    stops: stops.map((s, i) => ({ ...s, order_index: i })),
  };
  routes[idx] = updated;
  saveRoutes(routes);
  return updated;
}

export function deleteRoute(routeId: string) {
  const routes = loadRoutes().filter((r) => r.id !== routeId);
  saveRoutes(routes);
}
