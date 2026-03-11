import { SupabaseClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { CloudflareCrawler } from "./cloudflare";
import { EventNormalizer, Deduplicator } from "./normalizer";
import { GeocodingService } from "./geocoding";
import { ScrapingSource, Event, ScrapingJob } from "../../types/events";

export class ScrapingOrchestrator {
  private crawler: CloudflareCrawler;
  private db: SupabaseClient | Pool;

  constructor(db: SupabaseClient | Pool) {
    this.crawler = new CloudflareCrawler();
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
      let crawlResult;
      
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

      if (crawlResult.status === "failed") {
        throw new Error(`Cloudflare crawl failed: ${crawlResult.error}`);
      }

      // 5. Process pages
      let newCount = 0;
      let dupCount = 0;
      let failCount = 0;

      for (const page of crawlResult.result?.pages || []) {
        const potentialEvents = EventNormalizer.normalize(page.content, source);

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
            const hash = EventNormalizer.generateDedupHash(pEvent);
            const isDup = await Deduplicator.isDuplicate(hash, this.db);

            if (isDup) {
              dupCount++;
              continue;
            }

            // Geocode if necessary
            if (pEvent.address && (!pEvent.latitude || !pEvent.longitude)) {
              const coords = await GeocodingService.geocode(pEvent.address);
              if (coords) {
                pEvent.latitude = coords[0];
                pEvent.longitude = coords[1];
              }
            }

            // Insert event
            const eventData = {
              ...pEvent,
              slug: EventNormalizer.generateSlug(pEvent.title!),
              source_name: source.name,
              source_url: page.url,
              dedup_hash: hash,
              status: "nuevo",
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
