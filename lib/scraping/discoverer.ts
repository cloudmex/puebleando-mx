import { z } from 'zod';
import Groq from 'groq-sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

const SourceSchema = z.object({
  name: z.string(),
  base_url: z.string().url(),
  default_category: z.enum([
    'festivales', 'cultura', 'música', 'conciertos', 'baile', 
    'ferias', 'gastronomía', 'experiencias', 'exposiciones', 
    'familia', 'turismo', 'comunidad', 'deportes', 'tradiciones'
  ]).default('experiencias'),
});

const DiscoverySchema = z.object({
  sources: z.array(SourceSchema)
});

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

  /**
   * Prompts the LLM to discover new event sources across Mexico
   */
  async discoverNewSources(location: string = "toda la República Mexicana (los 32 estados)"): Promise<any[]> {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY not set");
    }

    const systemPrompt = `Eres un experto investigador de fuentes digitales y OSINT enfocado en México.
Tu objetivo es descubrir sitios web reales, verídicos y funcionales que publiquen carteleras de eventos en ${location}.

DOMINIOS DE CONFIANZA (Úsalos si aplican a la zona):
- mexicoescultura.com (Nacional/Cultura)
- cultura.[estado].gob.mx (Estatales)
- carteleracultural.org
- ocesa.com.mx (Conciertos)
- timeoutmexico.mx (CDMX y Nacional)
- dondeir.com (CDMX y Nacional)
- cartelera.cdmx.gob.mx (CDMX)
- boletia.com / eventbrite.com.mx (Boletaje)

REGLAS CRÍTICAS DE URLs:
1. NO INVENTES subrutas como "/cancun" o "/eventos". Si no conoces la ruta exacta, proporciona la URL RAÍZ del dominio de confianza (ej. "https://www.timeoutmexico.mx").
2. NUNCA uses "timeout.com.mx", el dominio correcto es "timeoutmexico.mx".
3. Para sitios de gobierno, usa siempre la estructura oficial (ej. "https://cultura.jalisco.gob.mx").
4. Si la ubicación es un municipio (ej. Benito Juárez/Cancún), busca el portal oficial del ayuntamiento o la secretaría de turismo del estado de Quintana Roo.

REGLA ESTRICTA 1: Las URLs deben ser verídicas. Es preferible devolver 5 fuentes REALES que 50 inventadas.
REGLA ESTRICTA 2: Devuelve un JSON con la estructura solicitada.

ESTRUCTURA DE SALIDA:
{
  "sources": [
    {
      "name": "Nombre real del sitio",
      "base_url": "https://url-real-y-verificada.com",
      "default_category": "cultura"
    }
  ]
}`;

    console.log(`[Discoverer] Asking Groq to discover new sources for: ${location}...`);
    
    const completion = await this.groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Busca fuentes de eventos en: ${location}` }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) return [];

    try {
      const parsed = JSON.parse(responseContent);
      const validated = DiscoverySchema.parse(parsed);
      const newSources = [];

      // Insert discovered sources into the DB
      for (const source of validated.sources) {
        try {
          // Default parser config for new sources
          const defaultConfig = {
            depth: 1,
            max_pages: 5,
            selectors: { item: "article", title: "h2", image: "img" }
          };

          if (this.isSupabase(this.db)) {
            const { data, error } = await this.db.from('scraping_sources').insert({
              ...source,
              parser_config: defaultConfig,
              is_active: true
            }).select().single();
            
            if (!error && data) newSources.push(data);
          } else {
            // Postgres fallback
            const res = await this.db.query(
              `INSERT INTO scraping_sources (name, base_url, default_category, parser_config, is_active) 
               VALUES ($1, $2, $3, $4, $5) 
               ON CONFLICT (base_url) DO NOTHING 
               RETURNING *`,
              [source.name, source.base_url, source.default_category, JSON.stringify(defaultConfig), true]
            );
            if (res.rows.length > 0) newSources.push(res.rows[0]);
          }
        } catch (dbErr: any) {
          // Expected if URL already exists (unique constraint)
          console.log(`[Discoverer] Skipped source ${source.base_url} (might already exist)`);
        }
      }

      console.log(`[Discoverer] Successfully added ${newSources.length} new sources.`);
      return newSources;

    } catch (error) {
      console.error("[Discoverer] Failed to parse or validate LLM response:", error);
      return [];
    }
  }
}
