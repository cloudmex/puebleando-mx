import Groq from 'groq-sdk';
import { z } from 'zod';

/**
 * DestinationClassifier
 * Uses AI to classify an event into a specific destination (Pueblo Mágico, city, etc.)
 * even if the source text doesn't explicitly name it but implies it through context.
 */

const ClassificationSchema = z.object({
  destination_id: z.string().nullish(), // e.g. 'sayulita', 'san-sebastian'
  confidence: z.number().min(0).max(1),
  reasoning: z.string().nullish()
});

export class DestinationClassifier {
  private groq: Groq;

  constructor() {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
  }

  /**
   * Classifies an event based on its title, description and location data.
   */
  async classify(event: {
    title: string;
    description?: string;
    venue_name?: string;
    city?: string;
    state?: string;
  }, availableDestinations: Array<{ id: string, name: string, keywords: string[] }>): Promise<z.infer<typeof ClassificationSchema>> {
    const prompt = `Eres un experto en turismo en México. Tu tarea es clasificar un evento en uno de los siguientes destinos turísticos basándote en su información.
    
DESTINOS DISPONIBLES:
${availableDestinations.map(d => `- ${d.name} (ID: ${d.id}): Palabras clave: ${d.keywords.join(', ')}`).join('\n')}

EVENTO A CLASIFICAR:
Título: ${event.title}
Descripción: ${event.description || 'N/A'}
Lugar: ${event.venue_name || 'N/A'}
Ciudad/Estado: ${event.city || ''}, ${event.state || ''}

REGLAS:
1. Analiza si el evento ocurre FÍSICAMENTE en el destino o si es una actividad representativa del mismo.
2. Si el evento no pertenece claramente a ninguno de los destinos de la lista, devuelve destination_id: null.
3. Devuelve un puntaje de confianza (0 a 1).
4. Responde ÚNICAMENTE con un objeto JSON válido.

FORMATO:
{
  "destination_id": "id-del-destino",
  "confidence": 0.95,
  "reasoning": "Breve explicación de por qué pertenece aquí"
}`;

    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response');

      const parsed = JSON.parse(content);
      return ClassificationSchema.parse(parsed);

    } catch (err) {
      console.error("[Classifier] Failed to classify event:", err);
      return { destination_id: null, confidence: 0 };
    }
  }
}
