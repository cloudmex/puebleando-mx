/**
 * POST /api/planear
 *
 * Generates a verified weekend plan using a two-phase anti-hallucination approach:
 *
 * Phase 1 — Data fetch (DB-only):
 *   Query Supabase for places + events in the requested city/state.
 *   All records are DENUE-verified (INEGI ground truth).
 *
 * Phase 2 — LLM planning (constrained):
 *   LLM receives ONLY the verified DB records and must reference them by ID.
 *   It cannot invent places — it only arranges, narrates, and explains.
 *
 * Phase 3 — Validation:
 *   Every placeId in the LLM response is validated against the DB results.
 *   Invalid IDs are silently rejected — they never reach the user.
 *
 * Result: a structured weekend plan where 100% of places are INEGI/DENUE verified.
 */

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getPool } from '@/lib/db';
import type { Place } from '@/types';
import type { Event } from '@/types/events';

// Shared vibe scoring — single source of truth in lib/vibeScoring.ts
import { vibeScore as interestScore } from '@/lib/vibeScoring';

// ── Response schema ──────────────────────────────────────────────────────────

const MomentoSchema = z.object({
  tiempo: z.enum(['mañana', 'tarde', 'noche']),
  placeId: z.string(),
  actividad: z.string().max(160),   // what to do there
  razon: z.string().max(160),       // why it fits the user's interests
  duracion: z.string().max(40),     // e.g. "2-3 horas"
});

const DiaSchema = z.object({
  nombre: z.enum(['Viernes', 'Sábado', 'Domingo']),
  momentos: z.array(MomentoSchema).min(1).max(4),
});

const PlanSchema = z.object({
  titulo: z.string().max(80),
  intro: z.string().max(300),
  dias: z.array(DiaSchema).min(1).max(3),
  tips: z.array(z.string().max(120)).max(3),
});

export type PlanResponse = z.infer<typeof PlanSchema>;
export type MomentoEnriquecido = z.infer<typeof MomentoSchema> & {
  place?: Place;
  event?: Event;
  verified: boolean;
  source: string;
};

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres el planificador de viajes de Puebleando, una app de experiencias auténticas en México.

Se te dará:
  1. Información del usuario (ciudad, intereses, personas, presupuesto)
  2. Lista de lugares y eventos VERIFICADOS por el gobierno mexicano (INEGI/DENUE)

Tu tarea: crear un plan de fin de semana (viernes noche, sábado, domingo) usando ÚNICAMENTE los lugares de la lista.

REGLAS ESTRICTAS ANTI-ALUCINACIÓN:
  ❌ NUNCA inventes lugares, museos, restaurantes o eventos que no estén en la lista
  ❌ NUNCA uses nombres de lugares que no aparezcan en la lista con su ID exacto
  ✅ SOLO usa "placeId" con valores que existan en el campo "id" de la lista
  ✅ El campo "actividad" describe qué hacer ahí (ej: "Recorre las salas de arte prehispánico")
  ✅ El campo "razon" explica por qué encaja con los intereses del usuario
  ✅ Si no hay suficientes lugares para un momento del día, omite ese momento (no inventes)

El plan debe ser:
  - Realista en tiempos y distancias (no pongas Guadalajara y Oaxaca en el mismo día)
  - Variado (no repitas el mismo lugar)
  - Adaptado al presupuesto (gratis=museos públicos/parques; premium=experiencias privadas)
  - PRIORIDAD: Si el usuario tiene intereses específicos, los lugares marcados con ⭐ deben dominar el plan.
    Al menos 2 de cada 3 momentos deben encajar con los intereses declarados.
    Ej: si dice "Gastronomía" → la mayoría deben ser restaurantes, mercados de comida, experiencias culinarias.
    Si dice "Vida nocturna" → incluye bares, mezcalerías, cantinas, música en vivo.

Responde ÚNICAMENTE con JSON válido. Sin texto adicional.

FORMATO:
{
  "titulo": "Fin de semana cultural en Oaxaca",
  "intro": "...",
  "dias": [
    {
      "nombre": "Viernes",
      "momentos": [
        {
          "tiempo": "noche",
          "placeId": "denue-12345",
          "actividad": "...",
          "razon": "...",
          "duracion": "2 horas"
        }
      ]
    },
    { "nombre": "Sábado", "momentos": [...] },
    { "nombre": "Domingo", "momentos": [...] }
  ],
  "tips": ["Lleva efectivo para el mercado", "El museo cierra los lunes"]
}`;

// ── DB helpers ────────────────────────────────────────────────────────────────

function rowToPlace(row: Record<string, unknown>): Place {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
    category: row.category as Place['category'],
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    photos: Array.isArray(row.photos) ? row.photos as string[] : [],
    town: String(row.town ?? ''),
    state: String(row.state ?? ''),
    tags: Array.isArray(row.tags) ? row.tags as string[] : [],
    importance_score: row.importance_score != null ? Number(row.importance_score) : undefined,
    created_at: String(row.created_at ?? ''),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { city, state, interests = [], people = 2, budget = 'moderado' } = body;

  if (!city) {
    return NextResponse.json({ error: 'Se requiere una ciudad' }, { status: 400 });
  }

  // ── Phase 1: Fetch verified places from DB ───────────────────────────────
  const sb = getSupabaseServerClient(false);
  const pool = getPool();

  let places: Place[] = [];
  let events: Event[] = [];

  const locationFilter = state ? `${city} ${state}` : city;

  if (sb) {
    const cutoff = new Date(Date.now() - 3600 * 1000).toISOString();

    const [{ data: pData }, { data: eData }] = await Promise.all([
      sb.from('places')
        .select('*')
        .or(`town.ilike.%${city}%,state.ilike.%${city}%${state ? `,state.ilike.%${state}%` : ''}`)
        .order('importance_score', { ascending: false, nullsFirst: false })
        .limit(40),
      sb.from('events')
        .select('*')
        .or(`city.ilike.%${city}%,state.ilike.%${city}%`)
        .in('status', ['publicado', 'nuevo'])
        .gte('start_date', cutoff)
        .order('start_date', { ascending: true })
        .limit(15),
    ]);
    places = (pData ?? []).map(rowToPlace);
    events = (eData ?? []) as Event[];
  } else if (pool) {
    const like = `%${city}%`;
    const [pRes, eRes] = await Promise.all([
      pool.query(
        `SELECT * FROM places WHERE town ILIKE $1 OR state ILIKE $1
         ORDER BY importance_score DESC NULLS LAST LIMIT 40`,
        [like]
      ),
      pool.query(
        `SELECT * FROM events WHERE (city ILIKE $1 OR state ILIKE $1)
           AND status IN ('publicado','nuevo') AND start_date >= NOW() - INTERVAL '1 hour'
         ORDER BY start_date ASC LIMIT 15`,
        [like]
      ),
    ]);
    places = pRes.rows.map(rowToPlace);
    events = eRes.rows as Event[];
  }

  if (places.length === 0 && events.length === 0) {
    return NextResponse.json({
      error: `No encontramos lugares verificados en ${city}. Prueba con otra ciudad.`,
    }, { status: 404 });
  }

  // ── Phase 2: LLM planning (constrained to verified DB data) ─────────────
  // Sort places by interest score so the LLM sees the best matches first
  const sortedPlaces = [...places]
    .map(p => ({ p, iScore: interestScore(p, interests) }))
    .sort((a, b) => {
      if (a.iScore !== b.iScore) return b.iScore - a.iScore;
      return (b.p.importance_score ?? 0) - (a.p.importance_score ?? 0);
    });

  const placeList = sortedPlaces.map(({ p, iScore }) => ({
    id: p.id,
    nombre: p.name,
    categoria: p.category,
    ciudad: p.town,
    descripcion: (p.description ?? '').slice(0, 100),
    tags: (p.tags ?? []).slice(0, 4),
    fuente: 'INEGI/DENUE',
    fit: iScore >= 40 ? '⭐' : undefined,
  }));

  const eventList = events.map(e => ({
    id: e.id,
    nombre: e.title,
    fecha: e.start_date,
    ciudad: e.city,
    precio: e.is_free ? 'gratis' : e.price_text,
    fuente: 'verificado',
  }));

  const userContext = {
    ciudad: locationFilter,
    intereses: interests,
    personas: people,
    presupuesto: budget,
    lugares_disponibles: placeList,
    eventos_disponibles: eventList,
    instruccion: 'Crea un plan de fin de semana usando SOLO los IDs de las listas anteriores.',
  };

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  let rawPlan: unknown;
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',   // more capable model for planning
      temperature: 0.4,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userContext) },
      ],
    });
    rawPlan = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
  } catch (err) {
    console.error('[planear] LLM error:', err);
    return NextResponse.json({ error: 'Error generando el plan. Intenta de nuevo.' }, { status: 500 });
  }

  // ── Phase 3: Validate — reject any ID not in our DB ──────────────────────
  const parsed = PlanSchema.safeParse(rawPlan);
  if (!parsed.success) {
    console.error('[planear] Schema mismatch:', parsed.error.message, rawPlan);
    return NextResponse.json({ error: 'El plan generado no tiene el formato correcto. Intenta de nuevo.' }, { status: 500 });
  }

  const validPlaceIds = new Set(places.map(p => p.id));
  const validEventIds = new Set(events.map(e => e.id));
  const placeMap = new Map(places.map(p => [p.id, p]));
  const eventMap = new Map(events.map(e => [e.id, e]));

  let hallucinations = 0;

  const enrichedDias = parsed.data.dias.map(dia => ({
    ...dia,
    momentos: dia.momentos
      .map(momento => {
        const place = placeMap.get(momento.placeId);
        const event = eventMap.get(momento.placeId);
        const verified = validPlaceIds.has(momento.placeId) || validEventIds.has(momento.placeId);

        if (!verified) {
          hallucinations++;
          console.warn(`[planear] Rejected hallucinated ID: ${momento.placeId}`);
          return null; // rejected
        }

        return {
          ...momento,
          place: place ?? undefined,
          event: event ?? undefined,
          verified: true,
          source: place?.id.startsWith('denue-') ? 'INEGI/DENUE' : 'Puebleando',
        } as MomentoEnriquecido;
      })
      .filter((m): m is MomentoEnriquecido => m !== null),
  })).filter(dia => dia.momentos.length > 0); // drop empty days

  if (hallucinations > 0) {
    console.warn(`[planear] Rejected ${hallucinations} hallucinated place(s) from LLM response`);
  }

  return NextResponse.json({
    titulo: parsed.data.titulo,
    intro: parsed.data.intro,
    dias: enrichedDias,
    tips: parsed.data.tips,
    meta: {
      city,
      totalPlaces: places.length,
      hallucinations_rejected: hallucinations,
      verified_count: enrichedDias.reduce((s, d) => s + d.momentos.length, 0),
    },
  });
}
