export type CategoryId =
  | "gastronomia"
  | "cultura"
  | "naturaleza"
  | "mercados"
  | "artesanos"
  | "festivales";

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
  place: Place;
  order_index: number;
}
