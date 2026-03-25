/**
 * LocationRefiner
 * Uses Groq to validate that events physically happen in Mexico and
 * to normalize city/state names to official Mexican nomenclature.
 *
 * Called in the orchestrator between LLM extraction and geocoding.
 * Processes all events from one page in a single API call (batch).
 */
import Groq from 'groq-sdk';
import { z } from 'zod';

// ── Result per event ─────────────────────────────────────────────────

export interface RefinedLocation {
  isInMexico: boolean;
  city?: string;
  state?: string;
}

// ── Zod schema ────────────────────────────────────────────────────────

const LocationItemSchema = z.object({
  idx: z.number(),
  is_in_mexico: z.boolean(),
  city: z.string().nullish(),
  state: z.string().nullish(),
});

const ResponseSchema = z.object({
  locations: z.array(LocationItemSchema),
});

// ── System prompt ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un validador de ubicaciones geográficas especializado en México.
Recibirás un JSON con eventos culturales. Para cada uno debes determinar:
1. ¿El evento ocurre FÍSICAMENTE en territorio mexicano? (si un mexicano compite en Canadá → NO es en México)
2. Si ocurre en México: estandariza la ciudad y el estado al nombre oficial en español.

Usa TODOS los campos disponibles para inferir la ubicación: título, venue, ciudad, estado, descripción e imagen.
- La descripción puede mencionar calles, colonias, referencias culturales mexicanas o nombres de lugares.
- La URL de la imagen puede contener nombres de ciudades o lugares en su ruta.
- Si la descripción menciona claramente un lugar fuera de México, marca como false aunque el venue sea ambiguo.
- Si la descripción confirma un lugar en México (ej: "en el Zócalo de la CDMX", "en el malecón de Puerto Vallarta"), úsala para inferir city/state.

FORMATO DE RESPUESTA:
{
  "locations": [
    {
      "idx": 0,
      "is_in_mexico": true,
      "city": "Guadalajara",
      "state": "Jalisco"
    }
  ]
}

ESTADOS VÁLIDOS (usa siempre exactamente estos nombres):
Aguascalientes, Baja California, Baja California Sur, Campeche, Chiapas, Chihuahua,
Ciudad de México, Coahuila de Zaragoza, Colima, Durango, Estado de México, Guanajuato,
Guerrero, Hidalgo, Jalisco, Michoacán de Ocampo, Morelos, Nayarit, Nuevo León, Oaxaca,
Puebla, Querétaro, Quintana Roo, San Luis Potosí, Sinaloa, Sonora, Tabasco, Tamaulipas,
Tlaxcala, Veracruz de Ignacio de la Llave, Yucatán, Zacatecas.

REGLAS:
- venue/ciudad claramente fuera de México (Montreal, Madrid, Miami, Houston…) → is_in_mexico: false
- Si el venue es ambiguo (ej: "Arena", "Teatro Municipal") pero hay contexto de ciudad mexicana → infiere la ciudad
- Si la city es "México" o "Mexico" sin estado → estado = "Ciudad de México"
- Si no puedes determinar city/state con seguridad, omite ese campo (no inventes)
- Responde ÚNICAMENTE con el JSON, sin texto adicional`;

// ── LocationRefiner class ─────────────────────────────────────────────

export class LocationRefiner {
  private groq: Groq;

  constructor() {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
  }

  /**
   * Validates and standardizes locations for a batch of events.
   * Returns one RefinedLocation per input event (same order).
   * Never throws — returns safe defaults on failure.
   */
  async refine(
    events: Array<{
      title: string;
      venue_name?: string | null;
      city?: string | null;
      state?: string | null;
      description?: string | null;
      image_url?: string | null;
    }>,
    targetLocation?: string
  ): Promise<RefinedLocation[]> {
    if (!process.env.GROQ_API_KEY || events.length === 0) {
      return events.map(() => ({ isInMexico: true }));
    }

    const input = {
      events: events.map((e, idx) => ({
        idx,
        title: e.title,
        venue: e.venue_name || '',
        city: e.city || '',
        state: e.state || '',
        // Truncate description to save tokens; still enough context for location cues
        description: e.description ? e.description.slice(0, 400) : '',
        // Image URL path can contain city/venue hints (e.g. /guadalajara/evento.jpg)
        image_url: e.image_url ? e.image_url.slice(0, 200) : '',
      })),
      target_location: targetLocation || null
    };

    const dynamicPrompt = `${SYSTEM_PROMPT}

${targetLocation ? `REGLA ADICIONAL: Se busca específicamente eventos en "${targetLocation}". 
Si el evento NO ocurre claramente en o está directamente relacionado con "${targetLocation}", marca "is_in_mexico" como false (estamos usando este campo como filtro de relevancia para el destino actual).` : ""}`;

    try {
      console.log(`[LocationRefiner] Validating ${events.length} event locations... ${targetLocation ? `(Strict: ${targetLocation})` : ""}`);
      let content: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const completion = await this.groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: dynamicPrompt },
              { role: 'user', content: JSON.stringify(input) },
            ],
          });
          content = completion.choices[0]?.message?.content ?? null;
          break;
        } catch (err: any) {
          if (err?.status === 429 && attempt < 2) {
            const waitSec = parseInt(err?.headers?.get?.('retry-after') || '15', 10) + 2;
            console.warn(`[LocationRefiner] Rate limited — retrying in ${waitSec}s (attempt ${attempt + 1}/3)`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
          } else {
            throw err;
          }
        }
      }
      if (!content) throw new Error('Empty response from LLM');

      const parsed = JSON.parse(content);
      const validated = ResponseSchema.parse(parsed);

      const results: RefinedLocation[] = events.map((_, i) => {
        const loc =
          validated.locations.find((l) => l.idx === i) ?? validated.locations[i];

        if (!loc) return { isInMexico: true }; // default: assume Mexico on failure

        return {
          isInMexico: loc.is_in_mexico,
          city: loc.city ?? undefined,
          state: loc.state ?? undefined,
        };
      });

      const outCount = results.filter((r) => !r.isInMexico).length;
      if (outCount > 0) {
        console.log(`[LocationRefiner] ${outCount}/${events.length} events flagged as outside Mexico`);
      }
      console.log(`[LocationRefiner] Done — ${events.length - outCount} valid Mexican events`);

      return results;
    } catch (err) {
      console.error('[LocationRefiner] Failed, using defaults:', err);
      // On error, keep all events (better to show them than to lose them)
      return events.map(() => ({ isInMexico: true }));
    }
  }
}
