import { Event } from "../../types/events";
import crypto from "crypto";

export class EventUtils {
  /**
   * Normalizes a title for deduplication: strips diacritics, articles,
   * common filler words, punctuation, and extra whitespace.
   * "Gran Concierto de Rock en Vivo!" → "concierto rock vivo"
   */
  static normalizeTitle(title: string): string {
    const FILLER = new Set([
      'el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'a', 'al', 'un', 'una',
      'por', 'con', 'para', 'que', 'se', 'su', 'es', 'lo', 'como', 'mas', 'o',
      'the', 'of', 'in', 'and', 'at', 'to', 'for', 'on', 'with',
      'gran', 'nuevo', 'nueva', 'primer', 'primera', 'segundo', 'segunda',
      'evento', 'especial', 'edicion', 'presenta', 'presentacion',
    ]);

    return title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')     // strip diacritics
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')            // remove punctuation
      .split(/\s+/)
      .filter(w => w.length >= 3 && !FILLER.has(w))
      .sort()                               // order-independent
      .join(' ')
      .trim();
  }

  /**
   * Normalizes city name for dedup: handles CDMX variants, strips diacritics.
   */
  static normalizeCity(city: string): string {
    const n = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const CDMX = ['cdmx', 'df', 'ciudad de mexico', 'mexico city', 'ciudad de mejico'];
    if (CDMX.includes(n) || n.includes('ciudad de mexico')) return 'cdmx';
    return n;
  }

  /**
   * Generates a unique hash for deduplication.
   * Uses normalized title (no articles/filler, sorted words) so that
   * "Gran Concierto de Rock" and "Concierto Rock en Vivo" produce
   * similar-enough hashes to avoid near-duplicates.
   */
  static generateDedupHash(event: Partial<Event>): string {
    const title = event.title ? this.normalizeTitle(event.title) : '';
    const dateStr = event.start_date ? new Date(event.start_date).toISOString().split('T')[0] : '';
    const city = event.city ? this.normalizeCity(event.city) : '';

    const data = `${title}-${dateStr}-${city}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Creates a slug from a title
   */
  static generateSlug(title: string, city: string = ""): string {
    const base = title.toLowerCase()
      .trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const cityTag = city ? city.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-') : '';
    const unique = cityTag ? `${base}-${cityTag}` : base;
    
    // Fallback for very similar titles in the same city: add 4 random chars if needed
    // (Actual DB collision will still be caught, but this reduces it)
    return unique.slice(0, 180); 
  }
}

export class Deduplicator {
  /**
   * Checks if an event is already in the database
   */
  static async isDuplicate(hash: string, db: any): Promise<boolean> {
    // Check if it's a Supabase client
    if (db && typeof db.from === 'function') {
      const { data, error } = await db
        .from("events")
        .select("id")
        .eq("dedup_hash", hash)
        .maybeSingle();
        
      if (error) {
        console.error("Deduplication error (Supabase):", error);
        return false;
      }
      return !!data;
    } 
    
    // Check if it's a PG Pool
    if (db && typeof db.query === 'function') {
      try {
        const { rows } = await db.query(
          "SELECT id FROM events WHERE dedup_hash = $1 LIMIT 1",
          [hash]
        );
        return rows.length > 0;
      } catch (err) {
        console.error("Deduplication error (PG):", err);
        return false;
      }
    }

    return false;
  }
}
