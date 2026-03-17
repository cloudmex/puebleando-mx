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
  default_category: z.string().default('experiencias'),
});

const DiscoverySchema = z.object({
  sources: z.array(SourceSchema),
});

// ── Result type returned by discoverNewSources ────────────────────────

export interface DiscoveryResult {
  nuevas: any[];         // inserted into DB
  existentes: string[];  // base_url already in DB
  invalidas: string[];   // URL did not respond
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

  // ── Fetch existing base_urls from DB ────────────────────────────────

  private async getExistingUrls(): Promise<Set<string>> {
    try {
      if (this.isSupabase(this.db)) {
        const { data } = await this.db
          .from('scraping_sources')
          .select('base_url');
        return new Set((data ?? []).map((r: any) => r.base_url));
      } else {
        const { rows } = await (this.db as Pool).query(
          'SELECT base_url FROM scraping_sources'
        );
        return new Set(rows.map((r: any) => r.base_url));
      }
    } catch {
      return new Set();
    }
  }

  // ── Main discovery ──────────────────────────────────────────────────

  async discoverNewSources(
    location: string = 'toda la República Mexicana (los 32 estados)'
  ): Promise<DiscoveryResult> {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not set');
    }

    const systemPrompt = `Eres un investigador de OSINT especializado en cultura y turismo local de México.
Tu misión es encontrar sitios web LOCALES y REGIONALES que tengan AGENDAS o CARTELERAS de eventos reales con fechas específicas para: ${location}.

PRIORIDAD DE BÚSQUEDA (en orden estricto):
1. AGENDAS CULTURALES de municipios o estados: sitios con sección /agenda, /cartelera, /eventos (ej. cultura.jalisco.gob.mx/agenda, turismo.cdmx.gob.mx/eventos)
2. MUSEOS, TEATROS y CENTROS CULTURALES locales con programación propia (ej. teatrodegollado.com, museofuerte.gob.mx)
3. INSTITUTOS y SECRETARÍAS de cultura estatales o municipales (ej. imca.gob.mx, secult.gob.mx)
4. MERCADOS y FERIAS con calendario de eventos (ej. mercadocoronaoficial.com)
5. Blogs de turismo LOCAL que listen eventos con fechas concretas

NO INCLUIR (bajo ninguna circunstancia):
- Periódicos o noticias generales (debate.com.mx, noroeste.com, lavoz*) — no tienen fechas estructuradas
- Sitios nacionales: ocesa, timeout, boletia, eventbrite, mexicoescultura, ticketmaster
- Sitios sin sección específica de eventos o agenda

REGLAS TÉCNICAS:
1. Busca al menos 6-8 fuentes con agenda/cartelera REAL para: ${location}.
2. Si conoces que un sitio tiene sección /agenda o /eventos, inclúyela en la URL base.
3. Prefiere .gob.mx y centros culturales oficiales sobre blogs.
4. Si no conoces la URL exacta, usa solo el dominio raíz (no inventes subrutas).

ESTRUCTURA DE SALIDA (JSON):
{
  "sources": [
    {
      "name": "Nombre descriptivo del sitio",
      "base_url": "https://url-exacta.com/agenda",
      "default_category": "cultura"
    }
  ]
}`;

    console.log(`[Discoverer] Asking Groq to discover LOCAL sources for: ${location}...`);

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
    if (!responseContent) return { nuevas: [], existentes: [], invalidas: [] };

    let candidates: z.infer<typeof SourceSchema>[] = [];
    try {
      const parsed = JSON.parse(responseContent);
      const validated = DiscoverySchema.parse(parsed);
      candidates = validated.sources;
      console.log(`[Discoverer] LLM proposed ${candidates.length} candidate sources`);
    } catch (error) {
      console.error('[Discoverer] Failed to parse LLM response:', error);
      return { nuevas: [], existentes: [], invalidas: [] };
    }

    // ── Phase 2: check existing URLs ───────────────────────────────────
    const existingUrls = await this.getExistingUrls();
    const existentes: string[] = [];
    const invalidas: string[] = [];
    const nuevas: any[] = [];

    const defaultConfig = {
      depth: 1,
      max_pages: 5,
      selectors: { item: 'article', title: 'h2', image: 'img' },
    };

    for (const source of candidates) {
      // Skip if already in DB
      if (existingUrls.has(source.base_url)) {
        console.log(`[Discoverer] Already exists: ${source.base_url}`);
        existentes.push(source.base_url);
        continue;
      }

      // ── Phase 3: validate URL is reachable ───────────────────────────
      console.log(`[Discoverer] Validating: ${source.base_url} ...`);
      const reachable = await this.isUrlReachable(source.base_url);
      if (!reachable) {
        console.log(`[Discoverer] Unreachable, skipping: ${source.base_url}`);
        invalidas.push(source.base_url);
        continue;
      }

      // ── Phase 4: insert into DB ───────────────────────────────────────
      try {
        // Normalize to a category that actually exists in the categories FK table
        const safeCategory = normalizeCategory(source.default_category);
        const sourceToInsert = { ...source, default_category: safeCategory };

        if (this.isSupabase(this.db)) {
          const { data, error } = await this.db
            .from('scraping_sources')
            .insert({ ...sourceToInsert, parser_config: defaultConfig, is_active: true })
            .select()
            .single();
          if (!error && data) {
            console.log(`[Discoverer] Inserted: ${source.base_url}`);
            nuevas.push(data);
          }
        } else {
          const res = await (this.db as Pool).query(
            `INSERT INTO scraping_sources (name, base_url, default_category, parser_config, is_active)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (base_url) DO NOTHING
             RETURNING *`,
            [
              sourceToInsert.name,
              sourceToInsert.base_url,
              sourceToInsert.default_category,
              JSON.stringify(defaultConfig),
              true,
            ]
          );
          if (res.rows.length > 0) {
            console.log(`[Discoverer] Inserted: ${source.base_url}`);
            nuevas.push(res.rows[0]);
          } else {
            existentes.push(source.base_url);
          }
        }
      } catch (dbErr: any) {
        console.error(`[Discoverer] DB error for ${source.base_url}:`, dbErr.message);
      }
    }

    console.log(
      `[Discoverer] Done — nuevas: ${nuevas.length}, existentes: ${existentes.length}, invalidas: ${invalidas.length}`
    );
    return { nuevas, existentes, invalidas };
  }
}
