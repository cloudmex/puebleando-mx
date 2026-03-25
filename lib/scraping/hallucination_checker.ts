/**
 * HallucinationChecker
 *
 * Verifies that each extracted event is actually backed by evidence in the
 * original source text, rather than invented/hallucinated by the LLM.
 *
 * Verdicts:
 *   confirmed  — title, date, and location are all clearly present in the source
 *   partial    — event exists in the source but some key fields are inferred/missing
 *                (kept, but flagged as pendiente_revision with lower confidence)
 *   unverified — event does not appear in the source, or critical data contradicts it
 *                (discarded)
 *
 * Auto-confirmed sources (skips the LLM call):
 *   - Structured JSON/JSON-LD (API responses, schema.org Event)
 *   - Apify social-media structured output
 */

import Groq from 'groq-sdk';
import { z } from 'zod';
import { DENUEVenueVerifier } from './denue';

export interface VerificationResult {
  idx: number;
  verdict: 'confirmed' | 'partial' | 'unverified';
  reason?: string;
}

// ── Zod schema ─────────────────────────────────────────────────────────────

const VerificationItemSchema = z.object({
  idx: z.number(),
  verdict: z.enum(['confirmed', 'partial', 'unverified']),
  reason: z.string().nullish(),
});

const ResponseSchema = z.object({
  verifications: z.array(VerificationItemSchema),
});

// ── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un verificador de hechos especializado en eventos culturales.
Recibirás:
1. Un fragmento del texto fuente original de una página web.
2. Una lista de eventos que un sistema extrajo de esa página.

Tu tarea es determinar si cada evento está REALMENTE respaldado por el texto fuente.

VEREDICTOS:
- "confirmed": El título (o palabras clave de él) Y al menos la fecha O la ubicación están claramente presentes en el texto fuente.
- "partial": El evento claramente existe en el texto fuente pero le faltan datos importantes (fecha exacta ausente, ciudad no mencionada, descripción inventada). Puede publicarse con revisión.
- "unverified": El evento NO aparece en el texto fuente, o sus datos clave (lugar, fecha, nombre) contradicen directamente lo que dice el texto.

REGLAS:
- Una mención breve en el texto (ej: nombre del evento en una lista) es suficiente para "confirmed" si los demás datos son plausibles.
- No penalices si el LLM añadió un año razonable a una fecha incompleta.
- Sí marca "unverified" si el evento parece completamente inventado o si la ciudad/venue contradice el texto.
- Si el texto fuente es un JSON estructurado con campos claros (type:Event, startDate, location), marca todos como "confirmed" directamente.
- Responde ÚNICAMENTE con JSON válido, sin texto adicional.

FORMATO:
{
  "verifications": [
    { "idx": 0, "verdict": "confirmed", "reason": "Título y fecha encontrados en el texto" },
    { "idx": 1, "verdict": "unverified", "reason": "No hay mención de este evento en la fuente" }
  ]
}`;

// ── HallucinationChecker class ──────────────────────────────────────────────

export class HallucinationChecker {
  private groq: Groq;
  private denue: DENUEVenueVerifier;

  constructor() {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
    this.denue = new DENUEVenueVerifier();
  }

  /**
   * Strips HTML tags to plain text. Kept minimal so we don't import from
   * LLMExtractor (avoids circular dep risk).
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]*>/gm, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Returns true when the source is structured data that doesn't need
   * LLM-based hallucination checking (API JSON, JSON-LD, Apify output).
   */
  private isStructuredSource(sourceContent: string): boolean {
    const trimmed = sourceContent.trim();
    // JSON array or object → likely structured API/Apify response
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) return true;
    // JSON-LD with schema.org Event embedded in HTML
    if (trimmed.includes('"@type"') && trimmed.includes('"Event"')) return true;
    return false;
  }

  /**
   * Verifies a batch of events against the original page source.
   * Returns one VerificationResult per input event (same order).
   * Never throws — returns 'partial' defaults on failure so events are kept for review.
   */
  async verify(
    events: Array<{
      title?: string | null;
      start_date?: string | null;
      city?: string | null;
      venue_name?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    }>,
    rawSourceContent: string
  ): Promise<VerificationResult[]> {
    if (!process.env.GROQ_API_KEY || events.length === 0) {
      return events.map((_, idx) => ({ idx, verdict: 'confirmed' }));
    }

    // Structured sources are auto-confirmed — no LLM call needed
    if (this.isStructuredSource(rawSourceContent)) {
      console.log('[HallucinationChecker] Structured source detected — auto-confirming all events');
      return events.map((_, idx) => ({ idx, verdict: 'confirmed' }));
    }

    // Prepare stripped source text — enough context without blowing the token budget
    const sourceText = this.stripHtml(rawSourceContent).slice(0, 12000);

    // Compact event summaries to keep the prompt lean
    const eventSummaries = events.map((e, idx) => ({
      idx,
      title: e.title || '(sin título)',
      date: e.start_date || '(sin fecha)',
      city: e.city || '(sin ciudad)',
      venue: e.venue_name || '(sin venue)',
    }));

    const userContent = JSON.stringify({
      source_text: sourceText,
      events: eventSummaries,
    });

    try {
      console.log(`[HallucinationChecker] Verifying ${events.length} events against source...`);

      let content: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const completion = await this.groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
          });
          content = completion.choices[0]?.message?.content ?? null;
          break;
        } catch (err: any) {
          if (err?.status === 429 && attempt < 2) {
            const waitSec = parseInt(err?.headers?.get?.('retry-after') || '15', 10) + 2;
            console.warn(`[HallucinationChecker] Rate limited — retrying in ${waitSec}s (attempt ${attempt + 1}/3)`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
          } else {
            throw err;
          }
        }
      }

      if (!content) throw new Error('Empty response from LLM');

      const parsed = JSON.parse(content);
      const validated = ResponseSchema.parse(parsed);

      const results: VerificationResult[] = events.map((_, i) => {
        const v = validated.verifications.find(r => r.idx === i) ?? validated.verifications[i];
        if (!v) return { idx: i, verdict: 'partial', reason: 'No verification returned' };
        return {
          idx: i,
          verdict: v.verdict,
          reason: v.reason ?? undefined,
        };
      });

      // ── DENUE ground-truth layer ────────────────────────────────────────
      // For events where the LLM returned 'partial' AND there's a venue name
      // with coordinates, query DENUE to see if the venue physically exists.
      // A DENUE hit upgrades 'partial' → 'confirmed'.
      // A DENUE miss on a named, coord-tagged venue keeps it as 'partial'
      // (not unverified — DENUE doesn't cover every small venue).
      if (process.env.DENUE_API_TOKEN) {
        for (let i = 0; i < results.length; i++) {
          if (results[i].verdict !== 'partial') continue;
          const e = events[i];
          if (!e.venue_name || !e.latitude || !e.longitude) continue;

          const match = await this.denue.findNearby(e.venue_name, e.latitude, e.longitude, 800);
          if (match) {
            results[i] = {
              idx: i,
              verdict: 'confirmed',
              reason: `Venue verificado en DENUE: "${match.name}" a ${Math.round(match.distanceMeters)}m`,
            };
          }
        }
      }

      const counts = results.reduce(
        (acc, r) => { acc[r.verdict]++; return acc; },
        { confirmed: 0, partial: 0, unverified: 0 }
      );
      console.log(`[HallucinationChecker] Results — confirmed: ${counts.confirmed}, partial: ${counts.partial}, unverified: ${counts.unverified}`);

      return results;
    } catch (err) {
      console.error('[HallucinationChecker] Verification failed, keeping all as partial:', err);
      // On failure, keep events but flag them — safer than discarding on error
      return events.map((_, idx) => ({ idx, verdict: 'partial', reason: 'Verification unavailable' }));
    }
  }
}
