"use client";
import { Place, Route, RouteStop, getStopId } from "@/types";
import type { Event } from "@/types/events";

const STORAGE_KEY = "puebleando_routes";

/** Free-tier limits (no auth) */
export const FREE_ROUTE_LIMIT = 1;
export const FREE_STOPS_LIMIT = 3;

/** Check whether the free tier can still accept a new route */
export function canCreateRouteFree(): boolean {
  return loadRoutes().length < FREE_ROUTE_LIMIT;
}

/** Check whether the free tier can still accept a stop on the given route */
export function canAddStopFree(routeId: string): boolean {
  const route = loadRoutes().find((r) => r.id === routeId);
  if (!route) return false;
  return route.stops.length < FREE_STOPS_LIMIT;
}

/** Total stops across all local routes */
export function totalLocalStops(): number {
  return loadRoutes().reduce((sum, r) => sum + r.stops.length, 0);
}

function migrateStop(raw: any): RouteStop {
  // Old format: { place: {...}, order_index: N } — no `type` field
  if (!raw.type) {
    return { type: "place", place: raw.place, order_index: raw.order_index ?? 0 };
  }
  return raw as RouteStop;
}

function loadRoutes(): Route[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const routes: Route[] = JSON.parse(raw);
    return routes.map((r) => ({ ...r, stops: r.stops.map(migrateStop) }));
  } catch {
    return [];
  }
}

function saveRoutes(routes: Route[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  } catch {
    // QuotaExceededError — storage is full
    console.warn("[routeStore] localStorage quota exceeded");
  }
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

export function createRouteWithStops(name: string, description: string, stops: RouteStop[]): Route {
  const routes = loadRoutes();
  const route: Route = {
    id: `r_${Date.now()}`,
    name,
    description,
    created_at: new Date().toISOString(),
    stops: stops.map((s, i) => ({ ...s, order_index: i })),
  };
  saveRoutes([...routes, route]);
  return route;
}

export function addPlaceToRoute(routeId: string, place: Place): Route | null {
  const routes = loadRoutes();
  const idx = routes.findIndex((r) => r.id === routeId);
  if (idx === -1) return null;

  const route = routes[idx];
  if (route.stops.some((s) => getStopId(s) === place.id)) return route;

  const updated: Route = {
    ...route,
    stops: [...route.stops, { type: "place", place, order_index: route.stops.length }],
  };
  routes[idx] = updated;
  saveRoutes(routes);
  return updated;
}

export function addEventToRoute(routeId: string, event: Event): Route | null {
  const routes = loadRoutes();
  const idx = routes.findIndex((r) => r.id === routeId);
  if (idx === -1) return null;

  const route = routes[idx];
  const eventId = event.id ?? event.slug;
  if (route.stops.some((s) => getStopId(s) === eventId)) return route;

  const updated: Route = {
    ...route,
    stops: [...route.stops, { type: "event", event, order_index: route.stops.length }],
  };
  routes[idx] = updated;
  saveRoutes(routes);
  return updated;
}

export function removeStopFromRoute(routeId: string, itemId: string): Route | null {
  const routes = loadRoutes();
  const idx = routes.findIndex((r) => r.id === routeId);
  if (idx === -1) return null;

  const route = routes[idx];
  const stops: RouteStop[] = route.stops
    .filter((s) => getStopId(s) !== itemId)
    .map((s, i) => ({ ...s, order_index: i }));

  const updated: Route = { ...route, stops };
  routes[idx] = updated;
  saveRoutes(routes);
  return updated;
}

/** @deprecated Use removeStopFromRoute */
export const removePlaceFromRoute = (routeId: string, placeId: string) =>
  removeStopFromRoute(routeId, placeId);

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

export function editRoute(routeId: string, newName: string): Route | null {
  const routes = loadRoutes();
  const idx = routes.findIndex((r) => r.id === routeId);
  if (idx === -1) return null;

  const updated: Route = {
    ...routes[idx],
    name: newName,
  };
  routes[idx] = updated;
  saveRoutes(routes);
  return updated;
}

export function deleteRoute(routeId: string) {
  saveRoutes(loadRoutes().filter((r) => r.id !== routeId));
}
