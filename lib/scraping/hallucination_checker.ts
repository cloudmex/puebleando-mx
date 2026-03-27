/**
 * HallucinationChecker — TEXT-BASED verification (no LLM)
 *
 * Verifies that each extracted event is actually backed by evidence in the
 * original source text using direct string matching and keyword overlap.
 *
 * Previous approach used llama-3.1-8b to verify — but a small LLM checking
 * another small LLM's output is unreliable. Direct text search is faster,
 * deterministic, and more accurate.
 *
 * Verdicts:
 *   confirmed  — title keywords found in source + at least date or venue present
 *   partial    — some title keywords found but missing date/venue evidence
 *   unverified — title keywords NOT found in source text at all
 *
 * Auto-confirmed sources:
 *   - Structured JSON with Event schema fields (title, startDate/start_date)
 *   - JSON-LD with schema.org Event type
 *   - Apify structured output
 */

import { DENUEVenueVerifier } from './denue';

export interface VerificationResult {
  idx: number;
  verdict: 'confirmed' | 'partial' | 'unverified';
  reason?: string;
}

// ── Text normalization ──────────────────────────────────────────────────────

/** Strip diacritics, lowercase, collapse whitespace */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract meaningful keywords from a title (skip stopwords, short words) */
function extractKeywords(title: string): string[] {
  const STOPWORDS = new Set([
    'el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'a', 'al', 'un', 'una',
    'por', 'con', 'para', 'que', 'se', 'su', 'es', 'lo', 'como', 'mas', 'o',
    'the', 'of', 'in', 'and', 'at', 'to', 'for', 'on', 'with', 'is', 'this',
    'evento', 'events', 'event', 'mx', 'mexico',
  ]);

  return norm(title)
    .split(/[\s\-_/|·•,.:;()[\]{}]+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
}

/** Check if a date string (ISO or partial) appears in the source text */
function dateFoundInSource(startDate: string, sourceNorm: string): boolean {
  if (!startDate) return false;

  const d = new Date(startDate);
  if (isNaN(d.getTime())) return false;

  const day = d.getUTCDate();
  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const monthShort = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  const month = d.getUTCMonth();
  const year = d.getUTCFullYear();

  // Try: "15 de marzo", "15 marzo", "marzo 15"
  const dayStr = String(day);
  const patterns = [
    `${dayStr} de ${monthNames[month]}`,
    `${dayStr} ${monthNames[month]}`,
    `${monthNames[month]} ${dayStr}`,
    `${dayStr} de ${monthShort[month]}`,
    `${dayStr}/${String(month + 1).padStart(2, '0')}`,
    `${dayStr}-${String(month + 1).padStart(2, '0')}`,
    // ISO partial: "2026-03-15"
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  ];

  return patterns.some(p => sourceNorm.includes(p));
}

// ── Structured source detection ─────────────────────────────────────────────

/**
 * Returns true when the source is structured data with actual event fields.
 * More strict than before: requires event-like field names, not just any JSON.
 */
function isStructuredEventSource(sourceContent: string): boolean {
  const trimmed = sourceContent.trim();

  // JSON-LD with schema.org Event
  if (trimmed.includes('"@type"') && trimmed.includes('"Event"')) return true;

  // Must be JSON (object or array)
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return false;

  // Check for event-like field names in the first 2000 chars
  const sample = trimmed.slice(0, 2000).toLowerCase();
  const eventFields = ['start_date', 'startdate', 'start_time', 'event_name', 'title', 'venue', 'location'];
  const matchCount = eventFields.filter(f => sample.includes(`"${f}"`)).length;

  // Need at least 2 event-like fields to auto-confirm
  return matchCount >= 2;
}

// ── Strip HTML ──────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── HallucinationChecker class ──────────────────────────────────────────────

export class HallucinationChecker {
  private denue: DENUEVenueVerifier;

  constructor() {
    this.denue = new DENUEVenueVerifier();
  }

  /**
   * Verifies a batch of events against the original page source using
   * direct text matching. No LLM calls — deterministic and fast.
   *
   * Returns one VerificationResult per input event (same order).
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
    if (events.length === 0) {
      return [];
    }

    // Structured event sources (JSON-LD, API responses with event fields) are auto-confirmed
    if (isStructuredEventSource(rawSourceContent)) {
      console.log('[HallucinationChecker] Structured event source detected — auto-confirming all events');
      return events.map((_, idx) => ({ idx, verdict: 'confirmed', reason: 'Fuente estructurada con campos de evento' }));
    }

    // Prepare normalized source text for matching
    const sourceText = stripHtml(rawSourceContent);
    const sourceNorm = norm(sourceText);

    console.log(`[HallucinationChecker] Text-based verification of ${events.length} events (source: ${sourceNorm.length} chars)...`);

    const results: VerificationResult[] = events.map((event, idx) => {
      const title = event.title || '';
      const keywords = extractKeywords(title);

      if (keywords.length === 0) {
        return { idx, verdict: 'unverified' as const, reason: 'Titulo sin palabras clave significativas' };
      }

      // Count how many title keywords appear in the source
      const found = keywords.filter(kw => sourceNorm.includes(kw));
      const ratio = found.length / keywords.length;

      // Check for date and venue evidence
      const hasDateEvidence = dateFoundInSource(event.start_date || '', sourceNorm);
      const hasVenueEvidence = event.venue_name
        ? norm(event.venue_name).split(/\s+/).filter(w => w.length >= 3).some(w => sourceNorm.includes(w))
        : false;
      const hasCityEvidence = event.city
        ? sourceNorm.includes(norm(event.city))
        : false;
      const hasLocationEvidence = hasVenueEvidence || hasCityEvidence;

      // Decision logic:
      // - ≥60% keywords found + (date OR location) → confirmed
      // - ≥40% keywords found OR (date + location) → partial
      // - <40% keywords and no supporting evidence → unverified
      if (ratio >= 0.6 && (hasDateEvidence || hasLocationEvidence)) {
        return {
          idx,
          verdict: 'confirmed' as const,
          reason: `${found.length}/${keywords.length} palabras clave encontradas` +
            (hasDateEvidence ? ' + fecha' : '') +
            (hasLocationEvidence ? ' + ubicacion' : ''),
        };
      }

      if (ratio >= 0.6) {
        // Good keyword match but no date/venue — likely real but incomplete
        return {
          idx,
          verdict: 'partial' as const,
          reason: `${found.length}/${keywords.length} palabras clave, sin fecha/venue en fuente`,
        };
      }

      if (ratio >= 0.4 || (hasDateEvidence && hasLocationEvidence)) {
        return {
          idx,
          verdict: 'partial' as const,
          reason: `${found.length}/${keywords.length} palabras clave` +
            (hasDateEvidence ? ' + fecha' : '') +
            (hasLocationEvidence ? ' + ubicacion' : ''),
        };
      }

      // Low keyword match — likely hallucinated
      return {
        idx,
        verdict: 'unverified' as const,
        reason: `Solo ${found.length}/${keywords.length} palabras clave encontradas en fuente`,
      };
    });

    // ── DENUE ground-truth upgrade ────────────────────────────────────────
    // For 'partial' events with venue + coords, check DENUE for physical existence.
    // A DENUE hit upgrades 'partial' → 'confirmed'.
    if (process.env.DENUE_API_TOKEN) {
      for (let i = 0; i < results.length; i++) {
        if (results[i].verdict !== 'partial') continue;
        const e = events[i];
        if (!e.venue_name || !e.latitude || !e.longitude) continue;

        try {
          const match = await this.denue.findNearby(e.venue_name, e.latitude, e.longitude, 800);
          if (match) {
            results[i] = {
              idx: i,
              verdict: 'confirmed',
              reason: `Venue verificado en DENUE: "${match.name}" a ${Math.round(match.distanceMeters)}m`,
            };
          }
        } catch { /* DENUE lookup failed — keep as partial */ }
      }
    }

    const counts = results.reduce(
      (acc, r) => { acc[r.verdict]++; return acc; },
      { confirmed: 0, partial: 0, unverified: 0 }
    );
    console.log(`[HallucinationChecker] Results — confirmed: ${counts.confirmed}, partial: ${counts.partial}, unverified: ${counts.unverified}`);

    return results;
  }
}
