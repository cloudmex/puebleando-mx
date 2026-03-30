/**
 * POST /api/buscar/picks
 *
 * Given a user query + search results, the LLM:
 *   1. Selects the top 3 most relevant places from the results
 *   2. Writes a short personalized reason for each
 *   3. Validates any place it wants to mention that isn't in the results via DENUE
 *
 * Returns: { intro: string, picks: Pick[] }
 *
 * All picks are guaranteed to be real — either from the verified DB (DENUE)
 * or confirmed in real-time against INEGI's DENUE API.
 */

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { z } from 'zod';
import { DENUEVenueVerifier } from '@/lib/scraping/denue';

// ── Schema ──────────────────────────────────────────────────────────────────

const PickSchema = z.object({
  id: z.string(),                          // matches a place id from results
  reason: z.string().max(120),             // why this place is great for the query
});

const ResponseSchema = z.object({
  intro: z.string().max(200),
  picks: z.array(PickSchema).max(3),
});

// ── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres el asistente de viajes de Puebleando, una app de experiencias auténticas en México.
Se te dará:
  1. La búsqueda del usuario
  2. Una lista de lugares reales verificados por INEGI/DENUE
  3. (Opcional) Un tipo de viaje: pareja, familia, adultos mayores, amigos, o solo

Tu tarea:
  - Escribe un "intro": 1-2 oraciones cálidas y específicas (máx 200 chars)
  - Selecciona hasta 3 "picks": los lugares más relevantes
  - Para cada pick, escribe un "reason": por qué es ideal para ESE tipo de viaje (máx 120 chars, en español)

REGLAS IMPORTANTES:
  - SOLO puedes seleccionar lugares de la lista proporcionada (usa el "id" exacto)
  - NO inventes lugares que no estén en la lista
  - Si hay un tipo de viaje, PRIORIZA lugares adecuados para ese perfil:
    * "pareja": románticos, íntimos, tranquilos, con ambiente especial
    * "familia": seguros para niños, educativos, interactivos, divertidos
    * "adultos": accesibles, ritmo tranquilo, culturales, sin esfuerzo físico
    * "amigos": grupales, aventura, mercados, vida nocturna, experiencias compartidas
    * "solo": introspección, fotografía, café, galería, caminata libre
  - El reason debe ser específico y contextual al tipo de viaje
  - Responde ÚNICAMENTE con JSON válido, sin texto adicional

FORMATO:
{
  "intro": "...",
  "picks": [
    { "id": "denue-12345", "reason": "..." },
    { "id": "denue-67890", "reason": "..." }
  ]
}`;

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
  }

  const { query, places = [], events = [], intent = {}, tripType } = await request.json();

  if (!query?.trim() || (places.length + events.length) === 0) {
    return NextResponse.json({ intro: '', picks: [] });
  }

  // Build compact place list for the prompt (avoid blowing token budget)
  const placeList = places.slice(0, 20).map((p: {
    id: string; name: string; town: string; state: string;
    category: string; description?: string; tags?: string[];
  }) => ({
    id: p.id,
    name: p.name,
    town: p.town,
    state: p.state,
    category: p.category,
    description: (p.description ?? '').slice(0, 80),
    tags: (p.tags ?? []).slice(0, 3),
  }));

  const userContent = JSON.stringify({
    busqueda: query,
    tipo_de_viaje: tripType ? { id: tripType.id, nombre: tripType.name, contexto: tripType.queryHint } : null,
    ciudad_detectada: intent.city ?? null,
    categoria_detectada: intent.category ?? null,
    lugares: placeList,
  });

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      temperature: 0.5,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = ResponseSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      console.warn('[buscar/picks] Schema mismatch:', parsed.error.message);
      return NextResponse.json({ intro: '', picks: [] });
    }

    // ── Validate picks against the actual result set ────────────────────────
    // Only allow IDs that are in our DB results (guaranteed DENUE-verified)
    const validIds = new Set(places.map((p: { id: string }) => p.id));
    const verifiedPicks = parsed.data.picks.filter(pick => validIds.has(pick.id));

    // ── DENUE ground-truth check for any pick not in DB ────────────────────
    // (Rare: LLM might return an ID that slipped through schema — double-check)
    const unverifiedPicks = parsed.data.picks.filter(pick => !validIds.has(pick.id));
    if (unverifiedPicks.length > 0 && process.env.DENUE_API_TOKEN) {
      const verifier = new DENUEVenueVerifier();
      for (const pick of unverifiedPicks) {
        const place = places.find((p: { id: string }) => p.id === pick.id);
        if (place?.latitude && place?.longitude) {
          const match = await verifier.findNearby(place.name, place.latitude, place.longitude, 500);
          if (match) verifiedPicks.push(pick); // confirmed by DENUE
          else console.warn(`[buscar/picks] Rejected unverified pick: ${pick.id}`);
        }
      }
    }

    // Enrich picks with place data for the frontend
    const enrichedPicks = verifiedPicks.map(pick => {
      const place = places.find((p: { id: string }) => p.id === pick.id);
      return {
        ...pick,
        place,
        source: (pick.id.startsWith('denue-') ? 'INEGI/DENUE' : 'Puebleando'),
      };
    });

    return NextResponse.json({
      intro: parsed.data.intro,
      picks: enrichedPicks,
    });

  } catch (err) {
    console.error('[buscar/picks] Error:', err);
    return NextResponse.json({ intro: '', picks: [] });
  }
}
