import { z } from 'zod';
import { Event, ScrapingSource } from "../../types/events";
import Groq from 'groq-sdk';

const EventSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  short_description: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  tags: z.array(z.string()).optional(),
  start_date: z.string().describe("ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)"),
  end_date: z.string().optional().describe("ISO 8601 format if applicable"),
  time_text: z.string().optional(),
  venue_name: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  price_text: z.string().optional(),
  is_free: z.boolean().default(false),
  image_url: z.string().optional(),
  confidence_score: z.number().min(0).max(1).default(1.0)
});

const ExtractionSchema = z.object({
  events: z.array(EventSchema)
});

export class LLMExtractor {
  private groq: Groq;

  constructor() {
    // Requires GROQ_API_KEY environment variable
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
  }

  /**
   * Cleans raw HTML to plain text to save LLM context window tokens
   */
  private stripHtml(html: string): string {
    // Remove scripts and styles
    let cleaned = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
    // Remove HTML tags
    cleaned = cleaned.replace(/<[^>]*>?/gm, ' ');
    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s\s+/g, ' ').trim();
    return cleaned;
  }

  /**
   * Extracts events using Groq Cloud LLM
   */
  async extractEvents(rawContent: string, source: ScrapingSource, pageUrl: string): Promise<Partial<Event>[]> {
    if (!process.env.GROQ_API_KEY) {
      console.warn("GROQ_API_KEY not set. Skipping LLM extraction.");
      return [];
    }

    // Clean html if it looks like HTML
    const textContent = rawContent.includes('<html') || rawContent.includes('<body') 
      ? this.stripHtml(rawContent) 
      : rawContent;

    const systemPrompt = `Eres un asistente experto en extracción de datos. Tu tarea es analizar el texto extraído de una página web y encontrar eventos, actividades, o lugares de interés reales y visitables.
La página puede contener un evento, múltiples eventos o ninguno. 

Debes devolver la información estrictamente en el siguiente formato JSON:
{
  "events": [
    {
      "title": "Título claro del evento",
      "description": "Descripción detallada",
      "short_description": "Resumen breve",
      "category": "Una de: gastronomia, cultura, naturaleza, mercados, artesanos, festivales",
      "start_date": "2024-03-25T18:00:00Z",
      "time_text": "Texto original de la hora (ej. 'A las 8 PM')",
      "venue_name": "Nombre del lugar (ej. Teatro Degollado)",
      "address": "Dirección completa si se incluye",
      "city": "Ciudad",
      "price_text": "Texto del precio (ej. '$200 MXN')",
      "is_free": true,
      "confidence_score": 0.9
    }
  ]
}

REGLAS CRÍTICAS:
1. Si un mismo texto menciona MÚLTIPLES EVENTOS en días distintos o lugares distintos, DEBES CREAR UN OBJETO SEPARADO para cada uno en el array de 'events'.
2. EXTRAE AL MENOS 15 EVENTOS REALES si están presentes en la página. Sé exhaustivo, no te detengas en los primeros 3.
3. Si no tienes la dirección exacta, intenta inferir al menos el 'venue_name' (lugar), 'city' (ciudad) y 'state' (estado). Esto es crucial para poder ubicarlos en el mapa.
4. Si no es un evento real (ej. es una noticia genérica o spam), no lo incluyas. Si no hay eventos, devuelve { "events": [] }.
5. La categoría por defecto recomendada para esta fuente es: ${source.default_category || 'experiencias'}. Trata de asignarla si tiene sentido.
6. Tu respuesta debe ser ÚNICAMENTE JSON VÁLIDO. No agregues texto antes ni después.`;

    // Limit context length (llama-3.1-8b-instant supports 8k-128k context, we cap at 20000 chars to be safe)
    const limitedContent = textContent.slice(0, 20000);

    try {
      console.log(`[LLMExtractor] Analyzing content from ${pageUrl} using Groq...`);
      const completion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: limitedContent }
        ],
        model: 'llama-3.1-8b-instant', // Fast model with good JSON capability
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) return [];

      const parsed = JSON.parse(responseContent);
      const validated = ExtractionSchema.parse(parsed);

      console.log(`[LLMExtractor] Successfully extracted ${validated.events.length} events from ${pageUrl}`);

      return validated.events.map(e => ({
        ...e,
        source_url: pageUrl,
        source_name: source.name,
        source_type: 'llm_groq',
        status: e.confidence_score < 0.6 ? 'pendiente_revision' : 'nuevo'
      }));

    } catch (error) {
      console.error("[LLMExtractor] Extraction failed:", error);
      return [];
    }
  }
}
