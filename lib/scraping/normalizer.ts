import { Event, ScrapingSource } from "../../types/events";
import crypto from "crypto";

export class EventNormalizer {
  /**
   * Normalizes raw content into a list of Event objects
   */
  static normalize(rawContent: string, source: ScrapingSource): Partial<Event>[] {
    const events: Partial<Event>[] = [];
    const selectors = source.parser_config.selectors;
    
    if (!selectors) return events;

    // Note: Since we are in a server environment without the DOM, 
    // we would typically use a library like 'cheerio'. 
    // For this implementation, we will use regex as a fallback or assume
    // the Cloudflare Crawler could return structured data if requested.
    
    // Simple regex-based extraction for demonstration if HTML is returned
    // In a production app, Cheerio would be preferred.
    
    // Example logic for Guadalajara Secreta (simplified)
    if (source.base_url.includes("guadalajarasecreta.com")) {
      const articleMatches = rawContent.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/g);
      for (const match of articleMatches) {
        const articleHtml = match[1];
        
        const titleMatch = articleHtml.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
        
        const linkMatch = articleHtml.match(/href="([^"]+)"/);
        const url = linkMatch ? linkMatch[1] : '';
        
        const imageMatch = articleHtml.match(/src="([^"]+)"/);
        const image = imageMatch ? imageMatch[1] : '';

        // Try to find a date in the text (e.g. "15 de marzo")
        const dateMatch = articleHtml.match(/(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i);
        let startDate = new Date().toISOString();
        if (dateMatch) {
          // Very basic conversion logic
          const monthMap: Record<string, number> = {
            enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
            julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
          };
          const day = parseInt(dateMatch[1]);
          const month = monthMap[dateMatch[2].toLowerCase()];
          const d = new Date();
          d.setMonth(month, day);
          startDate = d.toISOString();
        }

        if (title && url) {
          events.push({
            title,
            source_url: url,
            image_url: image,
            source_name: source.name,
            category: source.default_category,
            start_date: startDate,
            status: 'nuevo'
          });
        }
      }
    } else {
      // Generic fallback using selectors from parser_config
      const itemSelector = selectors.item || 'article';
      const titleSelector = selectors.title || 'h2';
      
      // Since we are using regex for now, we'll try to find items
      const itemRegex = new RegExp(`<${itemSelector}[^>]*>([\\s\\S]*?)</${itemSelector}>`, 'g');
      const itemMatches = rawContent.matchAll(itemRegex);
      
      for (const match of itemMatches) {
        const itemHtml = match[1];
        const titleMatch = itemHtml.match(new RegExp(`<${titleSelector}[^>]*>([\\s\\S]*?)</${titleSelector}>`));
        const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
        const linkMatch = itemHtml.match(/href="([^"]+)"/);
        const url = linkMatch ? linkMatch[1] : '';
        const imageMatch = itemHtml.match(/src="([^"]+)"/);
        
        if (title && url) {
          events.push({
            title,
            source_url: url,
            image_url: imageMatch ? imageMatch[1] : '',
            source_name: source.name,
            category: source.default_category,
            start_date: new Date().toISOString(),
            status: 'nuevo'
          });
        }
      }
    }
    
    return events;
  }

  /**
   * Generates a unique hash for deduplication
   */
  static generateDedupHash(event: Partial<Event>): string {
    const data = `${event.title?.toLowerCase()}-${event.start_date}-${event.city?.toLowerCase()}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Creates a slug from a title
   */
  static generateSlug(title: string): string {
    return title.toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
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
