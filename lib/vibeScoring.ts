/**
 * Shared scoring utilities for matching places to user preferences.
 *
 * Used by:
 *  - /api/weekend-plan  (vibes from PlanInput)
 *  - /api/planear       (interests)
 *  - /api/buscar/picks  (trip types from Explorar)
 *  - /api/buscar        (trip tag expansion)
 */

import type { Place } from "@/types";

// ── Vibe / Interest → category + tag mapping ─────────────────────────────────
// Keys are lowercased vibe labels (from PlanInput.tsx) and interest strings.
// Each maps to DB categories (strong signal) and tags (fuzzy signal).

// Categories that should NEVER match certain vibes (hard negatives)
const VIBE_EXCLUDE_CATEGORIES: Record<string, string[]> = {
  "vida nocturna": ["mercados", "artesanos", "naturaleza", "deportes"],
  "nightlife":     ["mercados", "artesanos", "naturaleza", "deportes"],
  "aventura":      ["mercados", "gastronomia"],
  "familiar":      ["festivales"],
  "romántico":     ["deportes", "mercados"],
  "romantico":     ["deportes", "mercados"],
  "naturaleza":    ["gastronomia", "mercados"],
  "relax":         ["deportes", "mercados", "festivales"],
};

export const VIBE_MAPPING: Record<string, { categories: string[]; tags: string[]; strongTags?: string[] }> = {
  "gastronomía":     { categories: ["gastronomia"], tags: ["restaurante", "cocina", "tacos", "mole", "café", "chocolate", "comedor", "casero"], strongTags: ["comida", "comida callejera", "mezcal", "pulque", "bebida"] },
  "gastronomia":     { categories: ["gastronomia"], tags: ["restaurante", "cocina", "tacos", "mole", "café", "chocolate", "comedor", "casero"], strongTags: ["comida", "comida callejera", "mezcal", "pulque", "bebida"] },
  "cultura":         { categories: ["cultura"], tags: ["museo", "teatro", "arte", "historia", "prehispánico", "danza", "ritual", "colonial", "ruinas", "pirámides", "UNESCO"] },
  "naturaleza":      { categories: ["naturaleza"], tags: ["bosque", "cenote", "cascada", "senderismo", "playa", "montaña", "laguna", "niebla", "aves", "aire libre"] },
  "vida nocturna":   { categories: [], tags: ["bar", "mezcalería", "pulquería", "cantina", "noche", "música en vivo"], strongTags: ["fiesta", "huapango", "música", "mezcal", "pulque", "bebida"] },
  "nightlife":       { categories: [], tags: ["bar", "mezcalería", "pulquería", "cantina", "noche", "música en vivo"], strongTags: ["fiesta", "huapango", "música", "mezcal", "pulque", "bebida"] },
  "familiar":        { categories: [], tags: ["familiar", "niños", "educativo", "interactivo", "parque", "taller", "seguro"] },
  "aventura":        { categories: ["deportes"], tags: ["aventura", "senderismo", "nado", "kayak", "escalada", "tirolesa"], strongTags: ["cenote", "bosque", "aire libre"] },
  "romántico":       { categories: [], tags: ["romántico", "íntimo", "cena", "spa", "atardecer"], strongTags: ["vino", "mezcal", "tranquilo", "jardín", "café", "cocina tradicional"] },
  "romantico":       { categories: [], tags: ["romántico", "íntimo", "cena", "spa", "atardecer"], strongTags: ["vino", "mezcal", "tranquilo", "jardín", "café", "cocina tradicional"] },
  "relax":           { categories: [], tags: ["spa", "tranquilo", "jardín", "yoga", "meditación", "termal"] },
  "mercados":        { categories: ["mercados"], tags: ["mercado", "tianguis", "artesanía", "textiles", "barro", "flores"] },
  "artesanal":       { categories: ["artesanos"], tags: ["artesanía", "taller", "cerámica", "textil", "barro", "telar", "bordado", "lana", "tapetes"] },
};

// ── Trip-type → category + tag mapping ───────────────────────────────────────
// Keys are trip type IDs from TRIP_TYPES in lib/data.ts
export const TRIP_TYPE_MAPPING: Record<string, { categories: string[]; tags: string[] }> = {
  pareja:  { categories: ["gastronomia", "cultura"], tags: ["mezcal", "vino", "café", "cena", "íntimo", "romántico", "tranquilo", "jardín", "cocina tradicional", "comedor", "casero", "chocolate", "mole"] },
  familia: { categories: ["artesanos", "mercados", "naturaleza"], tags: ["familiar", "niños", "educativo", "taller", "parque", "interactivo", "cerámica", "artesanía", "mercado", "cenote", "nado"] },
  adultos: { categories: ["cultura", "gastronomia"], tags: ["museo", "plaza", "iglesia", "jardín", "tradición", "tranquilo", "historia", "prehispánico", "cocina tradicional", "mole", "colonial"] },
  amigos:  { categories: ["mercados", "festivales", "gastronomia", "naturaleza"], tags: ["mercado", "bar", "festival", "aventura", "fiesta", "mezcal", "pulque", "grupal", "música", "comida callejera", "tacos", "cenote", "nado"] },
  solo:    { categories: ["cultura", "naturaleza"], tags: ["café", "galería", "caminata", "mirador", "fotografía", "bosque", "senderismo", "ruinas", "prehispánico", "cenote", "artesanía"] },
};

// ── DENUE tag normalization ──────────────────────────────────────────────────
// DENUE tags are long formal economic classifications like
// "bares, cantinas y similares" or "restaurantes con servicio de...".
// We normalize them to short tourism-friendly tokens for scoring.

const DENUE_TAG_MAP: Array<[RegExp, string[]]> = [
  // Gastronomía
  [/restaurante/i,                         ["restaurante", "comida", "cocina"]],
  [/comida corrida/i,                      ["comedor", "casero", "comida"]],
  [/antojitos/i,                           ["comida callejera", "tacos"]],
  [/pizzas|hamburguesas|hot dogs/i,        ["comida"]],
  [/preparación de otros alimentos/i,      ["comida"]],
  [/cafeter[ií]a|fuentes de sodas|never[ií]a/i, ["café", "bebida"]],
  [/mercados gastron[oó]micos/i,           ["restaurante", "comida", "cocina"]],
  // Bebidas / Noche
  [/bares?\b.*cantinas?/i,                 ["bar", "cantina", "noche", "bebida"]],
  [/mezcaler[ií]a/i,                       ["mezcalería", "mezcal", "noche", "bebida"]],
  [/pulquer[ií]a/i,                        ["pulquería", "pulque", "noche", "bebida"]],
  [/vinos y licores/i,                     ["bebida"]],
  // Cultura
  [/museos?/i,                             ["museo", "historia", "arte"]],
  [/teatros?/i,                            ["teatro"]],
  [/galer[ií]as? de arte/i,               ["galería", "arte"]],
  [/centros? culturales?/i,                ["cultura"]],
  [/zonas? arqueol[oó]gicas?/i,           ["ruinas", "prehispánico", "historia"]],
  [/bibliotecas?/i,                        ["cultura", "historia"]],
  // Artesanías
  [/artesan[ií]as?/i,                      ["artesanía"]],
  [/alfarer[ií]a|porcelana|loza/i,         ["cerámica", "taller", "artesanía"]],
  [/telar|textil/i,                        ["textil", "taller", "artesanía"]],
  // Naturaleza
  [/bot[áa]nicos?/i,                       ["jardín", "naturaleza"]],
  [/zool[óo]gicos?/i,                      ["familiar", "naturaleza"]],
  [/parque nacional/i,                     ["naturaleza", "aire libre"]],
  // Mercados
  [/mercados?\b/i,                         ["mercado"]],
  [/tianguis/i,                            ["tianguis", "mercado"]],
  // Educativo / Familiar
  [/escuelas? de arte/i,                   ["taller", "educativo", "arte"]],
  [/ense[ñn]anza de oficios/i,            ["taller", "educativo"]],
  // Espectáculos
  [/espect[áa]culos art[ií]sticos/i,       ["cultura", "música"]],
  [/estadios|auditorios/i,                 ["cultura"]],
  // Hospedaje
  [/hoteles?/i,                            ["hospedaje"]],
];

/** Normalize DENUE tags + simple tags into a flat set of tourism tokens. */
function normalizeTags(rawTags: string[]): string[] {
  const tokens = new Set<string>();
  for (const raw of rawTags) {
    const lower = raw.toLowerCase();
    // If it's already a short simple tag (≤3 words), keep it as-is
    if (lower.split(/\s+/).length <= 3) {
      tokens.add(lower);
    }
    // Also run through DENUE normalization (works on both short and long tags)
    for (const [pattern, mapped] of DENUE_TAG_MAP) {
      if (pattern.test(lower)) {
        for (const t of mapped) tokens.add(t);
      }
    }
  }
  return [...tokens];
}

// ── Scoring functions ────────────────────────────────────────────────────────

/** Check if a normalized tag set contains a target tag. */
function tagMatch(normalizedTags: string[], targetTag: string): boolean {
  return normalizedTags.includes(targetTag);
}

/** Score how well a place matches a set of vibe/interest labels (0–100). */
export function vibeScore(place: Place, vibeKeys: string[]): number {
  if (vibeKeys.length === 0) return 0;
  let score = 0;
  const placeCat = (place.category ?? "").toLowerCase();
  const placeTags = normalizeTags(place.tags ?? []);
  const placeDesc = (place.description ?? "").toLowerCase();

  for (const vibe of vibeKeys) {
    const mapping = VIBE_MAPPING[vibe];
    if (!mapping) continue;

    // Hard negative: this category should never match this vibe
    const excluded = VIBE_EXCLUDE_CATEGORIES[vibe];
    if (excluded?.includes(placeCat)) continue;

    const catMatch = mapping.categories.includes(placeCat);
    if (catMatch) score += 40;

    // Primary tags: always counted (exact match only)
    for (const tag of mapping.tags) {
      if (tagMatch(placeTags, tag)) score += 15;
      else if (placeDesc.includes(tag)) score += 5;
    }

    // Strong tags: only counted if category matches OR place already has 1+ primary tag hit
    // This prevents "mezcal" on a mercado from triggering "vida nocturna"
    if (mapping.strongTags) {
      const hasPrimaryHit = catMatch || mapping.tags.some(t => tagMatch(placeTags, t));
      if (hasPrimaryHit) {
        for (const tag of mapping.strongTags) {
          if (tagMatch(placeTags, tag)) score += 10;
          else if (placeDesc.includes(tag)) score += 3;
        }
      }
    }
  }
  return Math.min(score, 100);
}

// Categories that should NEVER match certain trip types
const TRIP_EXCLUDE_CATEGORIES: Record<string, string[]> = {
  pareja:  ["deportes", "mercados"],
  adultos: ["deportes"],
};

/** Score how well a place matches a trip type ID (0–100). */
export function tripTypeScore(place: Place, tripTypeId: string): number {
  const mapping = TRIP_TYPE_MAPPING[tripTypeId];
  if (!mapping) return 0;
  let score = 0;
  const placeCat = (place.category ?? "").toLowerCase();
  const placeTags = normalizeTags(place.tags ?? []);
  const placeDesc = (place.description ?? "").toLowerCase();

  // Hard negative
  const excluded = TRIP_EXCLUDE_CATEGORIES[tripTypeId];
  if (excluded?.includes(placeCat)) return 0;

  if (mapping.categories.includes(placeCat)) score += 40;
  for (const tag of mapping.tags) {
    if (tagMatch(placeTags, tag)) score += 15;
    else if (placeDesc.includes(tag)) score += 5;
  }
  return Math.min(score, 100);
}

/** Parse a comma-separated contexto string into lowercase vibe keys. */
export function parseVibesFromContexto(contexto: string): string[] {
  if (!contexto) return [];
  return contexto.split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
}

/**
 * Sort places by preference match (vibe or trip type), then by importance.
 * Returns a new array — does not mutate.
 */
export function sortByRelevance(
  places: Place[],
  scorer: (p: Place) => number,
): Place[] {
  return [...places]
    .map(p => ({ p, score: scorer(p) }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return (b.p.importance_score ?? 0) - (a.p.importance_score ?? 0);
    })
    .map(x => x.p);
}

/** Mark a place with ⭐ if it scores above threshold. For LLM prompts. */
export function markFit(place: Place, scorer: (p: Place) => number, threshold = 40): string {
  return scorer(place) >= threshold ? " ⭐ ENCAJA CON PREFERENCIAS" : "";
}

// ── Tag expansion (for DB queries) ───────────────────────────────────────────
// Expands narrow trip tags into broader tag sets + related categories.

const TAG_EXPANSION: Record<string, { extraTags: string[]; categories: string[] }> = {
  "romántico":   { categories: ["gastronomia"], extraTags: ["mezcal", "vino", "cena", "café", "tranquilo", "jardín", "atardecer", "cocina tradicional", "comedor", "casero"] },
  "íntimo":      { categories: ["gastronomia"], extraTags: ["comedor", "casero", "cena", "café", "mezcal", "chocolate"] },
  "cena":        { categories: ["gastronomia"], extraTags: ["restaurante", "comida", "cocina", "mole", "mariscos"] },
  "paseo":       { categories: ["naturaleza", "cultura"], extraTags: ["jardín", "plaza", "centro", "caminata", "parque"] },
  "vino":        { categories: ["gastronomia"], extraTags: ["mezcal", "pulque", "bebida", "bar", "cantina"] },
  "mezcal":      { categories: ["gastronomia"], extraTags: ["pulque", "bebida", "tradición", "destilado", "bar"] },
  "spa":         { categories: [], extraTags: ["termal", "relajación", "tranquilo"] },
  "familiar":    { categories: [], extraTags: ["niños", "educativo", "parque", "interactivo", "seguro", "taller"] },
  "niños":       { categories: [], extraTags: ["familiar", "educativo", "parque", "interactivo", "divertido"] },
  "educativo":   { categories: ["cultura"], extraTags: ["museo", "historia", "prehispánico", "taller"] },
  "interactivo": { categories: ["artesanos"], extraTags: ["taller", "cerámica", "artesanía", "clase"] },
  "parque":      { categories: ["naturaleza"], extraTags: ["jardín", "bosque", "aire libre", "caminata"] },
  "taller":      { categories: ["artesanos"], extraTags: ["cerámica", "artesanía", "barro", "telar", "textil"] },
  "accesible":   { categories: ["cultura"], extraTags: ["museo", "plaza", "iglesia", "jardín", "tranquilo"] },
  "tranquilo":   { categories: ["naturaleza", "cultura"], extraTags: ["jardín", "plaza", "café", "iglesia", "parque"] },
  "cultural":    { categories: ["cultura"], extraTags: ["museo", "teatro", "historia", "arte", "danza"] },
  "jardín":      { categories: ["naturaleza"], extraTags: ["parque", "plaza", "flores", "tranquilo"] },
  "plaza":       { categories: ["cultura"], extraTags: ["centro", "iglesia", "jardín", "tradición"] },
  "iglesia":     { categories: ["cultura"], extraTags: ["historia", "colonial", "tradición", "plaza"] },
  "grupal":      { categories: [], extraTags: ["aventura", "fiesta", "mercado", "festival", "tour"] },
  "aventura":    { categories: ["naturaleza", "deportes"], extraTags: ["senderismo", "kayak", "escalada", "cenote", "nado"] },
  "fiesta":      { categories: ["festivales"], extraTags: ["festival", "música", "bar", "noche", "cantina"] },
  "mercado":     { categories: ["mercados"], extraTags: ["tianguis", "artesanía", "comida", "textiles"] },
  "bar":         { categories: ["gastronomia"], extraTags: ["mezcal", "pulque", "cantina", "música", "noche"] },
  "festival":    { categories: ["festivales"], extraTags: ["fiesta", "tradición", "música", "danza"] },
  "solo":        { categories: [], extraTags: ["café", "fotografía", "caminata", "galería", "mirador"] },
  "fotografía":  { categories: [], extraTags: ["mirador", "paisaje", "ruinas", "colonial", "naturaleza"] },
  "café":        { categories: ["gastronomia"], extraTags: ["chocolate", "tranquilo", "lectura"] },
  "galería":     { categories: ["cultura"], extraTags: ["arte", "exposición", "museo"] },
  "caminata":    { categories: ["naturaleza"], extraTags: ["senderismo", "bosque", "mirador", "ruinas"] },
  "mirador":     { categories: ["naturaleza"], extraTags: ["paisaje", "fotografía", "montaña"] },
};

/** Expand narrow trip tags into broader tag set + related categories for DB queries. */
export function expandTripTags(tags: string[]): { expandedTags: string[]; boostCategories: string[] } {
  const allTags = new Set(tags);
  const cats = new Set<string>();
  for (const tag of tags) {
    const mapping = TAG_EXPANSION[tag];
    if (mapping) {
      for (const t of mapping.extraTags) allTags.add(t);
      for (const c of mapping.categories) cats.add(c);
    }
  }
  return { expandedTags: [...allTags], boostCategories: [...cats] };
}
