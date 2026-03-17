import Groq from "groq-sdk";
import { z } from "zod";

// ── Interfaces ──────────────────────────────────────────────────────

export interface EventoCrudo {
  titulo: string;
  descripcion_raw: string;
  fecha_raw: string;
  ubicacion_raw: string;
  url_origen: string;
  imagen_url?: string;
  fuente: string;
}

export interface EventoNormalizado {
  titulo: string;
  descripcion: string;
  fecha_inicio: Date;
  fecha_fin?: Date;
  ubicacion: string;
  estado: string;
  municipio?: string;
  tipo_evento: string;
  url_origen: string;
  imagen_url?: string;
  fuente: string;
  /** true when the LLM failed and raw data was used as fallback */
  pendiente_limpieza?: boolean;
}

// ── Zod schema for LLM response validation ──────────────────────────

const NormalizadoSchema = z.object({
  idx: z.number(),
  titulo: z.string(),
  descripcion: z.string(),
  fecha_inicio: z.string().describe("ISO 8601"),
  fecha_fin: z.string().optional(),
  ubicacion: z.string(),
  estado: z.string(),
  municipio: z.string().optional(),
  tipo_evento: z.string(),
});

const ResponseSchema = z.object({
  eventos: z.array(NormalizadoSchema),
});

// ── Constants ────────────────────────────────────────────────────────

const BATCH_SIZE = 10;

const SYSTEM_PROMPT = `Eres un normalizador de datos de eventos culturales en México.
Recibirás un objeto JSON con un array "eventos" de datos crudos. Devuelve un objeto JSON con el mismo array pero normalizado.

FORMATO DE RESPUESTA:
{
  "eventos": [
    {
      "idx": 0,
      "titulo": "Título limpio y conciso",
      "descripcion": "Descripción clara en español, máximo 3 oraciones",
      "fecha_inicio": "2024-03-25T18:00:00Z",
      "fecha_fin": "2024-03-25T21:00:00Z",
      "ubicacion": "Nombre del lugar o dirección completa",
      "estado": "Jalisco",
      "municipio": "Guadalajara",
      "tipo_evento": "concierto"
    }
  ]
}

REGLAS:
- fecha_inicio y fecha_fin en formato ISO 8601. Usa el año actual (${new Date().getFullYear()}) si no se especifica.
- estado = nombre completo del estado de México (ej: "Ciudad de México", "Jalisco", "Oaxaca").
- municipio = nombre del municipio o ciudad (ej: "Guadalajara", "Oaxaca de Juárez").
- tipo_evento: concierto | exposición | festival | feria | teatro | conferencia | gastronomía | taller | deportivo | otro
- Si un campo opcional no aplica, omítelo (no escribas null ni cadena vacía).
- Incluye TODOS los eventos del array de entrada, uno por uno con su idx original.
- Devuelve ÚNICAMENTE el objeto JSON, sin texto adicional.`;

// ── LLMCleaner ────────────────────────────────────────────────────────

export class LLMCleaner {
  private groq: Groq;

  constructor() {
    // Same Groq initialization pattern as lib/scraping/llm_extractor.ts
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
  }

  /**
   * Normalizes an array of raw events using the LLM.
   * Processes in batches of BATCH_SIZE to avoid saturating the API.
   * Falls back to raw data (pendiente_limpieza: true) on per-event failures.
   */
  async limpiar(eventos: EventoCrudo[]): Promise<EventoNormalizado[]> {
    if (!process.env.GROQ_API_KEY) {
      console.warn("[LLMCleaner] GROQ_API_KEY not set — returning raw fallbacks");
      return eventos.map((e) => this.fallback(e));
    }

    const resultado: EventoNormalizado[] = [];

    for (let i = 0; i < eventos.length; i += BATCH_SIZE) {
      const batch = eventos.slice(i, i + BATCH_SIZE);
      const cleaned = await this.procesarBatch(batch, i);
      resultado.push(...cleaned);
    }

    return resultado;
  }

  private async procesarBatch(
    batch: EventoCrudo[],
    offset: number
  ): Promise<EventoNormalizado[]> {
    const input = {
      eventos: batch.map((e, i) => ({
        idx: offset + i,
        titulo: e.titulo,
        descripcion: e.descripcion_raw,
        fecha: e.fecha_raw,
        ubicacion: e.ubicacion_raw,
      })),
    };

    try {
      console.log(
        `[LLMCleaner] Processing batch of ${batch.length} events (offset ${offset})`
      );

      const completion = await this.groq.chat.completions.create({
        model: "llama-3.1-8b-instant", // Same model as llm_extractor.ts
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(input) },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Empty LLM response");

      const parsed = JSON.parse(content);
      const validated = ResponseSchema.parse(parsed);

      return batch.map((raw, i) => {
        const globalIdx = offset + i;
        const normalized = validated.eventos.find((e) => e.idx === globalIdx);
        if (!normalized) {
          console.warn(`[LLMCleaner] Missing idx ${globalIdx} in response — using fallback`);
          return this.fallback(raw);
        }
        try {
          return {
            titulo: normalized.titulo,
            descripcion: normalized.descripcion,
            fecha_inicio: new Date(normalized.fecha_inicio),
            fecha_fin: normalized.fecha_fin
              ? new Date(normalized.fecha_fin)
              : undefined,
            ubicacion: normalized.ubicacion,
            estado: normalized.estado,
            municipio: normalized.municipio,
            tipo_evento: normalized.tipo_evento,
            url_origen: raw.url_origen,
            imagen_url: raw.imagen_url,
            fuente: raw.fuente,
          };
        } catch {
          return this.fallback(raw);
        }
      });
    } catch (err) {
      console.error(
        `[LLMCleaner] Batch (offset ${offset}) failed — using fallbacks:`,
        err
      );
      return batch.map((raw) => this.fallback(raw));
    }
  }

  /** Returns the event with raw data and pendiente_limpieza flag */
  private fallback(raw: EventoCrudo): EventoNormalizado {
    return {
      titulo: raw.titulo,
      descripcion: raw.descripcion_raw,
      fecha_inicio: new Date(),
      ubicacion: raw.ubicacion_raw,
      estado: "",
      tipo_evento: "otro",
      url_origen: raw.url_origen,
      imagen_url: raw.imagen_url,
      fuente: raw.fuente,
      pendiente_limpieza: true,
    };
  }
}
