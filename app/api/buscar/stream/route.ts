/**
 * POST /api/buscar/stream
 *
 * Streams a personalized intro text from Groq based on the user's query
 * and the search results found. Returns a plain text stream.
 *
 * Body: { query: string, places: Place[], events: Event[], intent: {...} }
 */

import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';

const SYSTEM_PROMPT = `Eres el asistente de viajes de Puebleando, una app que descubre experiencias auténticas de México.
Tu tarea: escribir UN párrafo corto (2-3 oraciones) que sirva como introducción personalizada a los resultados de búsqueda.

REGLAS:
- Escribe en español, tono cálido y entusiasta pero conciso
- Menciona específicamente el lugar o tipo de experiencia que busca el usuario
- Si hay resultados destacados, menciona alguno por nombre
- Si no hay resultados, sugiere términos alternativos o categorías cercanas
- NO uses markdown, NO uses listas, solo texto fluido
- Máximo 60 palabras`;

export async function POST(request: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return new Response('GROQ_API_KEY not configured', { status: 500 });
  }

  const { query, places = [], events = [], intent = {} } = await request.json();

  if (!query?.trim()) {
    return new Response('', { status: 200 });
  }

  // Build a compact summary of results for the LLM
  const totalResults = places.length + events.length;
  const topPlaces = places.slice(0, 3).map((p: { name: string; town: string; category: string }) =>
    `${p.name} (${p.town}, ${p.category})`
  );
  const topEvents = events.slice(0, 3).map((e: { title: string; city: string }) =>
    `${e.title} en ${e.city}`
  );

  const contextLines = [
    `Búsqueda: "${query}"`,
    intent.city ? `Ciudad detectada: ${intent.city}` : '',
    intent.category ? `Categoría detectada: ${intent.category}` : '',
    `Resultados totales: ${totalResults} (${places.length} lugares, ${events.length} eventos)`,
    topPlaces.length ? `Lugares destacados: ${topPlaces.join(', ')}` : '',
    topEvents.length ? `Eventos encontrados: ${topEvents.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const stream = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    temperature: 0.7,
    max_tokens: 120,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: contextLines },
    ],
  });

  // Stream the text directly as plain text
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (err) {
        console.error('[buscar/stream] Groq error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
