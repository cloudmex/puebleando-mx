import type { Event } from "@/types/events";

export type CategoryId =
  | "gastronomia"
  | "cultura"
  | "naturaleza"
  | "mercados"
  | "artesanos"
  | "festivales"
  | "deportes";

export interface Category {
  id: CategoryId;
  name: string;
  icon: string;
  color: string;
}

export interface Place {
  id: string;
  name: string;
  description: string;
  category: CategoryId;
  latitude: number;
  longitude: number;
  photos: string[];
  town: string;
  state: string;
  tags: string[];
  importance_score?: number; // 0-100: 80+ national, 55+ regional, 30+ city, <30 local
  created_at: string;
}

export interface Route {
  id: string;
  name: string;
  description: string;
  created_at: string;
  stops: RouteStop[];
}

export interface RouteStop {
  type: "place" | "event";
  place?: Place;
  event?: Event;
  order_index: number;
}

/** Returns the unique ID of a stop regardless of type */
export function getStopId(stop: RouteStop): string {
  return stop.type === "place"
    ? (stop.place?.id ?? "")
    : (stop.event?.id ?? stop.event?.slug ?? "");
}

/** Returns the display name of a stop */
export function getStopName(stop: RouteStop): string {
  return stop.type === "place"
    ? (stop.place?.name ?? "")
    : (stop.event?.title ?? "");
}

/** Returns the thumbnail image URL of a stop */
export function getStopImage(stop: RouteStop): string {
  return stop.type === "place"
    ? (stop.place?.photos[0] ?? "")
    : (stop.event?.image_url ?? "");
}

/** Returns the category id of a stop */
export function getStopCategory(stop: RouteStop): string {
  return stop.type === "place"
    ? (stop.place?.category ?? "")
    : (stop.event?.category ?? "");
}

/** Returns the location label of a stop */
export function getStopLocation(stop: RouteStop): string {
  return stop.type === "place"
    ? (stop.place?.town ?? "")
    : (stop.event?.city ?? stop.event?.venue_name ?? "");
}

export type TrustLevel = 'new' | 'verified' | 'admin';

export interface UserProfile {
  id: string;
  display_name: string;
  trust_level: TrustLevel;
  bio?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Claim {
  id: string;
  user_id: string;
  content_type: 'place' | 'event';
  content_id: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  admin_note?: string;
  created_at: string;
}

export interface ContentSubmission {
  id: string;
  user_id: string;
  content_type: 'place' | 'event';
  status: 'pendiente_revision' | 'publicado' | 'rechazado';
  payload: Record<string, unknown>;
  reviewer_note?: string;
  published_id?: string;
  created_at: string;
}
