import { Event } from "../../types/events";
import crypto from "crypto";

export class EventUtils {
  /**
   * Generates a unique hash for deduplication
   * Modified to be more robust for LLM results
   */
  static generateDedupHash(event: Partial<Event>): string {
    const title = event.title ? event.title.toLowerCase().trim() : '';
    const dateStr = event.start_date ? new Date(event.start_date).toISOString().split('T')[0] : '';
    const city = event.city ? event.city.toLowerCase().trim() : '';
    
    const data = `${title}-${dateStr}-${city}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Creates a slug from a title
   */
  static generateSlug(title: string, city: string = ""): string {
    const base = title.toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    const cityTag = city ? city.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-') : '';
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
