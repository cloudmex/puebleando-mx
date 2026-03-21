import { z } from 'zod';
import { Event, ScrapingSource } from "../../types/events";
import Groq from 'groq-sdk';

// .nullish() = optional + nullable — LLMs often return null instead of omitting the field
const EventSchema = z.object({
  title: z.string(),
  description: z.string().nullish(),
  short_description: z.string().nullish(),
  category: z.string().nullish(),
  subcategory: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  start_date: z.string().describe("ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)"),
  end_date: z.string().nullish().describe("ISO 8601 format if applicable"),
  time_text: z.string().nullish(),
  venue_name: z.string().nullish(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  price_text: z.string().nullish(),
  is_free: z.boolean().default(false),
  image_url: z.string().nullish(),
  confidence_score: z.number().min(0).max(1).default(1.0),
  importance_score: z.number().int().min(0).max(100).default(50)
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
   * Groq call with automatic retry on 429 rate-limit errors.
   * Reads the retry-after header so we wait exactly as long as needed.
   */
  private async callWithRetry(messages: { role: string; content: string }[], maxRetries = 3): Promise<string | null> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const completion = await this.groq.chat.completions.create({
          messages: messages as any,
          model: 'llama-3.1-8b-instant',
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
        return completion.choices[0]?.message?.content ?? null;
      } catch (err: any) {
        if (err?.status === 429 && attempt < maxRetries - 1) {
          const waitSec = parseInt(err?.headers?.get?.('retry-after') || '15', 10) + 2;
          console.warn(`[LLMExtractor] Rate limited — retrying in ${waitSec}s (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
        } else {
          throw err;
        }
      }
    }
    return null;
  }

  /**
   * Cleans raw HTML to plain text to save LLM context window tokens
   */
  private stripHtml(html: string): string {
    // Remove scripts and styles entirely
    let cleaned = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
    
    // Replace structural tags with space/newlines to preserve some separation
    cleaned = cleaned.replace(/<(p|br|div|tr|h\d)[^>]*>/gi, '\n');
    cleaned = cleaned.replace(/<(li|td)[^>]*>/gi, ' • ');

    // Remove remaining HTML tags
    cleaned = cleaned.replace(/<[^>]*>?/gm, ' ');
    
    // Remove excessive whitespace/newlines
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    cleaned = cleaned.replace(/\n\s*\n+/g, '\n').trim();
    
    return cleaned;
  }

  /**
   * Extracts events using Groq Cloud LLM
   */
  async extractEvents(rawContent: string, source: ScrapingSource, pageUrl: string, targetLocation?: string): Promise<Partial<Event>[]> {
    if (!process.env.GROQ_API_KEY) {
      console.warn("GROQ_API_KEY not set. Skipping LLM extraction.");
      return [];
    }

    const isJson = rawContent.trim().startsWith('[') || rawContent.trim().startsWith('{');
    const textContent = rawContent.includes('<html') || rawContent.includes('<body') 
      ? this.stripHtml(rawContent) 
      : rawContent;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const locationFocus = targetLocation ? `Tu búsqueda debe enfocarse PRIORITARIAMENTE en eventos que ocurran en o cerca de ${targetLocation}.` : "Busca eventos en cualquier parte de México.";
    
    const systemPrompt = `Eres un asistente experto en extracción de datos. Tu tarea es analizar ${isJson ? 'los datos JSON de un scraper de redes sociales' : 'el texto de una página web'} y encontrar eventos reales en México.
${locationFocus}
${isJson ? 'IMPORTANTE: Los campos en el JSON pueden ser ruidosos, extrae con cuidado las fechas reales y ubicaciones.' : ''}
La página puede contener un evento, múltiples eventos o ninguno.
La fecha de hoy es ${today}. Usa esta fecha para resolver expresiones relativas.
DESCARTA eventos cuya fecha de inicio sea anterior a hoy (${today}).

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
      "state": "Estado (ej. Jalisco, Ciudad de México, Oaxaca)",
      "price_text": "Texto del precio (ej. '$200 MXN')",
      "is_free": true,
      "confidence_score": 0.9,
      "importance_score": 65
    }
  ]
}

CAMPO importance_score (0-100):
- 80-100: Festival nacional/internacional, evento cultural de gran escala (Guelaguetza, FICM, Día de Muertos Oaxaca, etc.)
- 55-79:  Evento estatal o regional significativo, museum importante, feria de estado
- 30-54:  Evento a nivel ciudad, programa cultural regular, restaurante/lugar establecido
- 10-29:  Evento de barrio, mercado local, evento pequeño recurrente
- 0-9:    Evento muy pequeño, privado o con información incompleta

REGLAS CRÍTICAS:
1. Si detectas una LISTA DE EVENTOS o un CALENDARIO (especialmente en formato de lista), DEBES EXTRAER TODOS los eventos individuales presentes. No te limites solo a los destacados o al primero. Cada evento debe ser un objeto separado en el array 'events'.
2. EXTRAE COMPLETAMENTE todos los eventos reales si están presentes en la página.
3. Para los eventos en ${targetLocation || 'México'}, asegúrate de capturar detalles como "festival", "música en vivo", "fiesta", "torneo", y etiquetas relevantes.
4. Si no tienes la dirección exacta, infiere al menos el 'venue_name', 'city' y 'state' para la geolocalización.
5. Usa el contexto para deducir el año si falta (probablemente 2026).
6. Tu respuesta debe ser ÚNICAMENTE JSON VÁLIDO. No agregues texto antes ni después.`;

    // Limit context length (llama-3.1-8b-instant supports 8k-128k context, we cap at 20000 chars to be safe)
    const limitedContent = textContent.slice(0, 20000);

    try {
      console.log(`[LLMExtractor] Analyzing content from ${pageUrl} using Groq... ${targetLocation ? `(Focus: ${targetLocation})` : ""}`);
      const responseContent = await this.callWithRetry([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: limitedContent },
      ]);
      if (!responseContent) return [];

      const parsed = JSON.parse(responseContent);
      const validated = ExtractionSchema.parse(parsed);

      console.log(`[LLMExtractor] Successfully extracted ${validated.events.length} events from ${pageUrl}`);

      // Convert null → undefined so the result is compatible with Partial<Event>
      const nn = <T>(v: T | null | undefined): T | undefined => v ?? undefined;

      return validated.events.map(e => ({
        ...e,
        description: nn(e.description),
        short_description: nn(e.short_description),
        category: nn(e.category),
        subcategory: nn(e.subcategory),
        tags: nn(e.tags) ?? [],
        end_date: nn(e.end_date),
        time_text: nn(e.time_text),
        venue_name: nn(e.venue_name),
        address: nn(e.address),
        city: nn(e.city),
        state: nn(e.state),
        price_text: nn(e.price_text),
        image_url: nn(e.image_url),
        source_url: pageUrl,
        source_name: source.name,
        source_type: 'llm_groq',
        importance_score: e.importance_score,
        status: e.confidence_score < 0.6 ? 'pendiente_revision' : 'nuevo'
      }));

    } catch (error) {
      console.error("[LLMExtractor] Extraction failed:", error);
      return [];
    }
  }
}
