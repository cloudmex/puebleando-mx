"use client";

const STORAGE_KEY = "puebleando_trip_prefs";

interface TripPreferences {
  selections: { tripTypeId: string; timestamp: number }[];
  lastTripType: string | null;
}

function load(): TripPreferences {
  if (typeof window === "undefined") return { selections: [], lastTripType: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { selections: [], lastTripType: null };
    return JSON.parse(raw);
  } catch {
    return { selections: [], lastTripType: null };
  }
}

function save(prefs: TripPreferences) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function trackTripTypeSelection(tripTypeId: string) {
  const prefs = load();
  prefs.selections.push({ tripTypeId, timestamp: Date.now() });
  // Keep last 50 selections max
  if (prefs.selections.length > 50) prefs.selections = prefs.selections.slice(-50);
  prefs.lastTripType = tripTypeId;
  save(prefs);
}

export function getLastTripType(): string | null {
  return load().lastTripType;
}

export function getTripTypeStats(): Record<string, number> {
  const prefs = load();
  const counts: Record<string, number> = {};
  for (const s of prefs.selections) {
    counts[s.tripTypeId] = (counts[s.tripTypeId] ?? 0) + 1;
  }
  return counts;
}

export function getTopTripType(): string | null {
  const stats = getTripTypeStats();
  let top: string | null = null;
  let max = 0;
  for (const [id, count] of Object.entries(stats)) {
    if (count > max) { max = count; top = id; }
  }
  return top;
}
