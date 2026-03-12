import { SupabaseClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { CloudflareCrawler } from "./cloudflare";
import { EventUtils, Deduplicator } from "./normalizer";
import { LLMExtractor } from "./llm_extractor";
import { GeocodingService } from "./geocoding";
import { ScrapingSource, Event, ScrapingJob } from "../../types/events";

export class ScrapingOrchestrator {
  private crawler: CloudflareCrawler;
  private llm: LLMExtractor;
  private db: SupabaseClient | Pool;

  constructor(db: SupabaseClient | Pool) {
    this.crawler = new CloudflareCrawler();
    this.llm = new LLMExtractor();
    this.db = db;
  }

  private isSupabase(db: any): db is SupabaseClient {
    return typeof (db as any).from === 'function';
  }

  /**
   * Runs a complete scraping cycle for a specific source
   */
  async runJob(sourceId: string): Promise<string> {
    let source: ScrapingSource | null = null;

    // 1. Fetch source config
    if (this.isSupabase(this.db)) {
      const { data, error } = await this.db
        .from("scraping_sources")
        .select("*")
        .eq("id", sourceId)
        .single();
      if (error || !data) throw new Error(`Source not found: ${error?.message}`);
      source = data as ScrapingSource;
    } else {
      const { rows } = await this.db.query("SELECT * FROM scraping_sources WHERE id = $1", [sourceId]);
      if (rows.length === 0) throw new Error(`Source not found: ${sourceId}`);
      source = rows[0] as ScrapingSource;
    }

    // 2. Create job record
    let jobId: string;
    if (this.isSupabase(this.db)) {
      const { data, error } = await this.db
        .from("scraping_jobs")
        .insert({
          source_id: sourceId,
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error || !data) throw new Error(`Failed to create job: ${error?.message}`);
      jobId = data.id;
    } else {
      const res = await this.db.query(
        "INSERT INTO scraping_jobs (source_id, status, started_at) VALUES ($1, $2, $3) RETURNING id",
        [sourceId, "running", new Date().toISOString()]
      );
      jobId = res.rows[0].id;
    }

    try {
      // 3. Trigger Crawl (with simulation support)
      let crawlResult: any;
      
      try {
        if (process.env.SIMULATE_SCRAPING === 'true') {
          console.log("Simulating scraping for:", source.name);
          crawlResult = {
            status: 'completed' as const,
            result: {
              pages: [{
                url: source.base_url,
                content: `<html><body><article><h2>Evento Simulado en ${source.name} - ${new Date().toLocaleTimeString()}</h2><p>Descripción de prueba</p><div class="location">Guadalajara Centro</div><a href="${source.base_url}/test-event">Leer más</a></article></body></html>`,
                status: 200
              }]
            }
          };
        } else {
          const cfJobId = await this.crawler.startCrawl(source.base_url, {
            maxDepth: source.parser_config?.depth || 1,
            limit: source.parser_config?.max_pages || 10,
            render: source.parser_config?.render !== undefined ? source.parser_config.render : true
          });

          // 4. Wait for completion
          crawlResult = await this.crawler.waitForCompletion(cfJobId);
        }
      } catch (err: any) {
        console.warn(`[Orchestrator] Crawl attempt failed for ${source.base_url}: ${err.message}`);
        // Instead of throwing, we record the error in the job and return early for this job
        if (this.isSupabase(this.db)) {
          await this.db.from("scraping_jobs").update({
            status: "failed",
            finished_at: new Date().toISOString(),
            error_message: err.message,
          }).eq("id", jobId);
        } else {
          await this.db.query("UPDATE scraping_jobs SET status = $1, finished_at = $2, error_message = $3 WHERE id = $4", ["failed", new Date().toISOString(), err.message, jobId]);
        }
        return jobId;
      }

      if (crawlResult?.status === "failed") {
        console.warn(`[Orchestrator] Cloudflare crawl reported failure: ${crawlResult.error}`);
        // Continue processing if there are pages, otherwise return
        if (!crawlResult.result?.pages?.length) {
           return jobId;
        }
      }

      // 5. Process pages
      let newCount = 0;
      let dupCount = 0;
      let failCount = 0;

      for (const page of crawlResult.result?.pages || []) {
        // Send page content to Groq LLM instead of regex parsing
        const potentialEvents = await this.llm.extractEvents(page.content, source, page.url);

        for (const pEvent of potentialEvents) {
          try {
            // Simulator override: ensure we have coordinates and a valid category
            if (process.env.SIMULATE_SCRAPING === 'true') {
              pEvent.latitude = 20.6719;
              pEvent.longitude = -103.3488;
              pEvent.address = "Avenida Vallarta, Guadalajara, Jalisco";
              pEvent.category = "cultura";
              pEvent.image_url = "https://images.unsplash.com/photo-1599401732682-964082269a84?auto=format&fit=crop&q=80&w=1000";
              pEvent.short_description = "Un recorrido increíble por los murales históricos de la ciudad.";
              pEvent.venue_name = "Instituto Cultural Cabañas";
            }
            const hash = EventUtils.generateDedupHash(pEvent);
            const isDup = await Deduplicator.isDuplicate(hash, this.db);

            if (isDup) {
              dupCount++;
              continue;
            }

            // Geocode if necessary
            if (!pEvent.latitude || !pEvent.longitude) {
              const searchString = [
                pEvent.venue_name,
                pEvent.address,
                pEvent.city,
                pEvent.state,
                "México"
              ].filter(Boolean).join(", ");

              if (searchString.length > 5) {
                console.log(`[Orchestrator] Attempting geocode for: ${searchString}`);
                let coords = await GeocodingService.geocode(searchString);
                
                // Fallback 1: Try without venue_name (just address/city)
                if (!coords && pEvent.venue_name) {
                   const fallbackSearch = [pEvent.address, pEvent.city, pEvent.state, "México"].filter(Boolean).join(", ");
                   if (fallbackSearch.length > 5) {
                     console.log(`[Orchestrator] Fallback geocode (no venue): ${fallbackSearch}`);
                     coords = await GeocodingService.geocode(fallbackSearch);
                   }
                }

                // Fallback 2: Try just city/state
                if (!coords && (pEvent.city || pEvent.state)) {
                   const citySearch = [pEvent.city, pEvent.state, "México"].filter(Boolean).join(", ");
                   console.log(`[Orchestrator] Fallback geocode (city only): ${citySearch}`);
                   coords = await GeocodingService.geocode(citySearch);
                }

                if (coords) {
                  pEvent.latitude = coords[0];
                  pEvent.longitude = coords[1];
                }
              }
            }

            // Insert event
            const slugTitle = pEvent.title || 'evento-sin-nombre';
            
            // --- CATEGORY MAPPING & NORMALIZATION ---
            const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            const allowedSlugs = ['gastronomia', 'cultura', 'naturaleza', 'mercados', 'artesanos', 'festivales'];
            
            let rawCat = pEvent.category || source.default_category || 'festivales';
            let normCat = normalize(rawCat);

            // Detailed mapping
            if (normCat.includes('musica') || normCat.includes('concierto') || normCat.includes('teatro') || normCat.includes('arte') || normCat.includes('show') || normCat.includes('cultura')) {
              normCat = 'cultura';
            } else if (normCat.includes('comida') || normCat.includes('gastro') || normCat.includes('chef')) {
              normCat = 'gastronomia';
            } else if (normCat.includes('feria') || normCat.includes('fiesta') || normCat.includes('festival')) {
              normCat = 'festivales';
            } else if (normCat.includes('naturaleza') || normCat.includes('verde') || normCat.includes('ecoturismo')) {
              normCat = 'naturaleza';
            }

            // Final safety fallback
            if (!allowedSlugs.includes(normCat)) {
              console.log(`[Orchestrator] Category '${rawCat}' normalized to '${normCat}' - Not in allowed list, falling back to 'festivales'`);
              normCat = 'festivales';
            } else {
              if (rawCat.toLowerCase() !== normCat) {
                console.log(`[Orchestrator] Category Mapped: '${rawCat}' -> '${normCat}'`);
              }
            }

            // --- DATE SANITATION ---
            const parseDate = (d: any) => {
              if (!d || typeof d !== 'string' || d.trim() === '') return null;
              try {
                const parsed = new Date(d);
                if (isNaN(parsed.getTime())) return null;
                return parsed.toISOString();
              } catch {
                return null;
              }
            };

            const startDate = parseDate(pEvent.start_date) || new Date().toISOString();
            const endDate = parseDate(pEvent.end_date);
            const pubDate = parseDate(pEvent.published_at);

            // Clean up data for DB
            const eventData: any = {
              title: (pEvent.title || 'Evento sin título').slice(0, 255),
              description: pEvent.description || '',
              short_description: pEvent.short_description || '',
              category: normCat,
              subcategory: pEvent.subcategory || '',
              tags: Array.isArray(pEvent.tags) ? pEvent.tags : [],
              start_date: startDate,
              end_date: endDate,
              time_text: pEvent.time_text || '',
              venue_name: pEvent.venue_name || '',
              address: pEvent.address || '',
              city: pEvent.city || '',
              state: pEvent.state || '',
              country: pEvent.country || 'México',
              latitude: typeof pEvent.latitude === 'number' ? pEvent.latitude : null,
              longitude: typeof pEvent.longitude === 'number' ? pEvent.longitude : null,
              price_text: pEvent.price_text || '',
              is_free: !!pEvent.is_free,
              image_url: pEvent.image_url || '',
              confidence_score: typeof pEvent.confidence_score === 'number' ? pEvent.confidence_score : 0.8,
              slug: EventUtils.generateSlug(slugTitle),
              dedup_hash: hash,
              source_name: pEvent.source_name || source.name,
              source_url: pEvent.source_url || page.url,
              source_type: 'llm_groq',
              status: pEvent.status || 'nuevo',
              published_at: pubDate,
              scraped_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            if (this.isSupabase(this.db)) {
              console.log(`[Orchestrator] Saving to Supabase: ${eventData.title} (Lat: ${eventData.latitude}, Cat: ${eventData.category})`);
              const { error } = await this.db.from("events").insert(eventData);
              if (error) throw error;
            } else {
              console.log(`[Orchestrator] Saving to PG: ${eventData.title} (Lat: ${eventData.latitude}, Cat: ${eventData.category})`);
              const columns = Object.keys(eventData).join(", ");
              const placeholders = Object.keys(eventData).map((_, i) => `$${i + 1}`).join(", ");
              const values = Object.values(eventData);
              await this.db.query(`INSERT INTO events (${columns}) VALUES (${placeholders})`, values);
            }

            newCount++;
          } catch (err) {
            console.error(`Failed to process event: ${pEvent.title}`, err);
            failCount++;
          }
        }
      }

      // 6. Update job status
      const jobUpdate = {
        status: "completed",
        finished_at: new Date().toISOString(),
        total_scraped: newCount + dupCount + failCount,
        new_events: newCount,
        updated_events: 0,
        failed_events: failCount,
      };

      if (this.isSupabase(this.db)) {
        await this.db.from("scraping_jobs").update(jobUpdate).eq("id", jobId);
        await this.db.from("scraping_sources").update({ last_run_at: new Date().toISOString() }).eq("id", source.id);
      } else {
        const setClause = Object.keys(jobUpdate).map((k, i) => `${k} = $${i + 1}`).join(", ");
        await this.db.query(`UPDATE scraping_jobs SET ${setClause} WHERE id = $${Object.keys(jobUpdate).length + 1}`, [...Object.values(jobUpdate), jobId]);
        await this.db.query("UPDATE scraping_sources SET last_run_at = $1 WHERE id = $2", [new Date().toISOString(), source.id]);
      }

    } catch (err: any) {
      if (this.isSupabase(this.db)) {
        await this.db.from("scraping_jobs").update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: err.message,
        }).eq("id", jobId);
      } else {
        await this.db.query("UPDATE scraping_jobs SET status = $1, finished_at = $2, error_message = $3 WHERE id = $4", ["failed", new Date().toISOString(), err.message, jobId]);
      }
      throw err;
    }

    return jobId;
  }
}
