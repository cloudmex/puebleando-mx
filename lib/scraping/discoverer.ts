import { z } from 'zod';
import Groq from 'groq-sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

// ── Category normalization ────────────────────────────────────────────
// Must match the IDs in the `categories` table (FK constraint)
const ALLOWED_CATEGORIES = [
  'gastronomia', 'cultura', 'naturaleza', 'mercados', 'artesanos', 'festivales',
] as const;

function normalizeCategory(raw: string): string {
  const n = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if ((ALLOWED_CATEGORIES as readonly string[]).includes(n)) return n;
  if (n.includes('gastro') || n.includes('comida') || n.includes('chef')) return 'gastronomia';
  if (n.includes('cultur') || n.includes('arte') || n.includes('museo') || n.includes('teatro') || n.includes('exposicion')) return 'cultura';
  if (n.includes('natural') || n.includes('ecotour') || n.includes('parque')) return 'naturaleza';
  if (n.includes('mercado') || n.includes('tianguis')) return 'mercados';
  if (n.includes('artesano') || n.includes('artesania')) return 'artesanos';
  return 'festivales'; // safe fallback — always in categories table
}

// ── Schema ────────────────────────────────────────────────────────────

const SourceSchema = z.object({
  name: z.string(),
  base_url: z.string().url(),
  // Accept ANY string from the LLM; normalizeCategory() maps it to a valid FK value before inserting
  default_category: z.string().catch('festivales'),
});

const DiscoverySchema = z.object({
  sources: z.array(SourceSchema.catchall(z.unknown())),
});

// ── Result type returned by discoverNewSources ────────────────────────

export interface DiscoveryResult {
  nuevas: any[];              // newly inserted sources
  existentes_sources: any[];  // sources that were already in the DB
  invalidas: string[];        // URL did not respond
}

// ── SourceDiscoverer ───────────────────────────────────────────────────

export class SourceDiscoverer {
  private groq: Groq;
  private db: SupabaseClient | Pool;

  constructor(db: SupabaseClient | Pool) {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
    this.db = db;
  }

  private isSupabase(db: any): db is SupabaseClient {
    return typeof (db as any).from === 'function';
  }

  // ── URL reachability check ──────────────────────────────────────────

  private async isUrlReachable(url: string): Promise<boolean> {
    // Assume social media URLs are reachable (they block simple bot checks)
    if (url.includes('facebook.com') || url.includes('instagram.com') || url.includes('tiktok.com')) return true;

    for (const method of ['HEAD', 'GET'] as const) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);
        const res = await fetch(url, {
          method,
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PueblandoBot/1.0)' },
          redirect: 'follow',
        });
        clearTimeout(timer);
        // 200-399 = OK; 405 = HEAD not allowed but server exists; 403 = blocked but server exists
        if (res.status < 400 || res.status === 403 || res.status === 405) return true;
      } catch {
        // timeout or network error — try next method
      }
    }
    return false;
  }

  // ── Fetch existing sources from DB ──────────────────────────────────
  private async getExistingSources(): Promise<Map<string, any>> {
    try {
      if (this.isSupabase(this.db)) {
        const { data } = await this.db
          .from('scraping_sources')
          .select('*');
        return new Map((data ?? []).map((r: any) => [r.base_url, r]));
      } else {
        const { rows } = await (this.db as Pool).query(
          'SELECT * FROM scraping_sources'
        );
        return new Map(rows.map((r: any) => [r.base_url, r]));
      }
    } catch {
      return new Map();
    }
  }

  // ── Main discovery ──────────────────────────────────────────────────

  async discoverNewSources(
    location: string = 'toda la República Mexicana (los 32 estados)',
    attempt: number = 1
  ): Promise<DiscoveryResult> {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not set');
    }

    const existingSources = await this.getExistingSources();
    const existingUrls = Array.from(existingSources.keys()).slice(0, 20).join('\n');

    const promptAttemptRules = attempt > 1 
      ? `\n\n¡ALERTA DE BÚSQUEDA PROFUNDA (Intento ${attempt})!\nOBLIGATORIO: EXCLUYE por completo Facebook e Instagram en este intento. Concéntrate EXCLUSIVAMENTE en plataformas de boletos (Ticketmaster, Eventbrite, Boletia), sitios web oficiales del gobierno (.gob.mx), y portales de noticias locales verificables de ${location}.`
      : "";

    const systemPrompt = `Eres un investigador de OSINT especializado en cultura y turismo local de México.
Tu misión es encontrar sitios web y REDES SOCIALES que tengan AGENDAS o CARTELERAS de eventos reales con fechas específicas para: ${location}.

FUENTES YA CONOCIDAS (NO REPETIR):
${existingUrls}

PRIORIDAD DE BÚSQUEDA:
1. PÁGINAS DE FACEBOOK REALES (sección /events) de lugares MUY CONOCIDOS. Si no estás 100% seguro de que el username de Facebook existe, NO LO USES.
2. AGENDAS CULTURALES gubernamentales (sección /agenda, /cartelera, /eventos).
3. Museos, Teatros y Centros Culturales locales (busca sus sitios web oficiales).
4. Plataformas comprobables como Eventbrite, Ticketmaster, Boletia, o Resident Advisor filtradas por ${location} o recintos famosos.

REGLAS TÉCNICAS (CRÍTICAS):
1. Busca al menos 8-10 fuentes distintas.
2. **PROHIBIDO INVENTAR URLs O USAR PLACEHOLDERS**. Si dudas de una URL de Facebook/Instagram, mejor proporciona el sitio web oficial u otra página web verificable.
3. Nunca uses números repetidos en URLs de redes sociales (ej. no uses 12345... ni 10444...). Las URLs deben ser de páginas reales.
4. No incluyas fuentes nacionales genéricas ni las fuentes ya conocidas listadas arriba.${promptAttemptRules}

ESTRUCTURA DE SALIDA (JSON):
{
  "sources": [
    {
      "name": "Nombre descriptivo del sitio o cuenta",
      "base_url": "https://facebook.com/usuario/events",
      "default_category": "cultura"
    }
  ]
}`;

    let candidates: z.infer<typeof SourceSchema>[] = [];
    
    if (process.env.SERPER_API_KEY) {
      console.log(`[Discoverer] Asking SERPER (Live Internet) to discover sources for: ${location} (Attempt ${attempt})...`);
      
      const query = attempt === 1 
        ? `Eventos cartelera agenda ${location} site:facebook.com`
        : `Agenda cultural cartelera eventos boletos ${location}`;
      
      try {
        const response = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "X-API-KEY": process.env.SERPER_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ q: query, gl: "mx", hl: "es", num: 15 })
        });
        
        const data = await response.json();
        if (data.organic && Array.isArray(data.organic)) {
          candidates = data.organic.map((item: any) => {
            // Clean up URLs
            let cleanUrl = item.link;
            // If it's a generic Facebook path, append /events
            if (cleanUrl.includes('facebook.com') && !cleanUrl.includes('/events') && (cleanUrl.match(/\//g) || []).length <= 4) {
              // Ensure no trailing slash before appending /events
              cleanUrl = cleanUrl.replace(/\/$/, '') + '/events';
            }
            return {
              name: item.title,
              base_url: cleanUrl,
              default_category: "cultura"
            };
          }).filter((c: any) => {
             // Exclude URLs with complex parameters for tracking
             if (c.base_url.includes('?') && !c.base_url.includes('eventbrite.com/d/')) return false;
             return true;
          });
          console.log(`[Discoverer] Serper found ${candidates.length} candidate sources`);
        }
      } catch (err) {
        console.error('[Discoverer] Failed to fetch from Serper API:', err);
      }
    } else {
      console.log(`[Discoverer] Asking Groq to discover LOCAL + SOCIAL sources for: ${location}...`);
      const completion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Encuentra sitios con AGENDA DE EVENTOS con fechas para: ${location}.
IMPORTANTE: Solo fuentes con cartelera/agenda real (museos, teatros, institutos de cultura, portales de turismo municipal).
NO incluyas periódicos, noticias, ocesa, timeout, boletia, eventbrite ni mexicoescultura.`,
          },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.4,
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) return { nuevas: [], existentes_sources: [], invalidas: [] };

      try {
        const parsed = JSON.parse(responseContent);
        const validated = DiscoverySchema.parse(parsed);
        candidates = validated.sources;
        console.log(`[Discoverer] LLM proposed ${candidates.length} candidate sources`);
      } catch (error) {
        console.error('[Discoverer] Failed to parse LLM response:', error);
        return { nuevas: [], existentes_sources: [], invalidas: [] };
      }
    }

    // ── Phase 2: filter existing and validate reachable in parallel ──
    const existentes_sources: any[] = [];
    const candidatesToValidate = candidates.filter(c => {
      // Basic hallucination check for placeholder IDs (e.g., 104444... or 12345...)
      if (/(\d)\1{5,}/.test(c.base_url) || c.base_url.includes('123456')) {
        console.log(`[Discoverer] Skipping placeholder/fake URL: ${c.base_url}`);
        return false;
      }
      if (existingSources.has(c.base_url)) {
        existentes_sources.push(existingSources.get(c.base_url));
        return false;
      }
      return true;
    });

    console.log(`[Discoverer] Validating ${candidatesToValidate.length} new candidates in parallel...`);
    
    const validationResults = await Promise.all(
      candidatesToValidate.map(async (source) => {
        const reachable = await this.isUrlReachable(source.base_url);
        return { source, reachable };
      })
    );

    const nuevas: any[] = [];
    const invalidas: string[] = [];
    const defaultConfig = {
      depth: 1,
      max_pages: 5,
      selectors: { item: 'article', title: 'h2', image: 'img' },
    };

    for (const { source, reachable } of validationResults) {
      if (!reachable) {
        console.log(`[Discoverer] Unreachable: ${source.base_url}`);
        invalidas.push(source.base_url);
        continue;
      }

      // ── Phase 4: insert into DB ───────────────────────────────────────
      try {
        const safeCategory = normalizeCategory(source.default_category);
        const sourceToInsert = { ...source, default_category: safeCategory };

        if (this.isSupabase(this.db)) {
          const { data, error } = await this.db
            .from('scraping_sources')
            .insert({ ...sourceToInsert, parser_config: defaultConfig, is_active: true, target_location: location })
            .select()
            .single();
          if (!error && data) {
            console.log(`[Discoverer] Inserted: ${source.base_url} (Target: ${location})`);
            nuevas.push(data);
          }
        } else {
          const res = await (this.db as Pool).query(
            `INSERT INTO scraping_sources (name, base_url, default_category, parser_config, is_active, target_location)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (base_url) DO UPDATE SET target_location = EXCLUDED.target_location
             RETURNING *`,
            [
              sourceToInsert.name,
              sourceToInsert.base_url,
              sourceToInsert.default_category,
              JSON.stringify(defaultConfig),
              true,
              location,
            ]
          );
          if (res.rows.length > 0) {
            console.log(`[Discoverer] Inserted/Updated: ${source.base_url} (Target: ${location})`);
            nuevas.push(res.rows[0]);
          }
        }
      } catch (dbErr: any) {
        console.error(`[Discoverer] DB error for ${source.base_url}:`, dbErr.message);
      }
    }

    console.log(
      `[Discoverer] Done — nuevas: ${nuevas.length}, existentes: ${existentes_sources.length}, invalidas: ${invalidas.length}`
    );
    return { nuevas, existentes_sources, invalidas };
  }
}
