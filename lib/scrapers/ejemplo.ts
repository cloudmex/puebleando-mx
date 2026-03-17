/**
 * Scraper de ejemplo — Cartelera CDMX
 * https://cartelera.cdmx.gob.mx/
 *
 * PREREQUISITO: instalar cheerio antes de usar este archivo:
 *   npm install cheerio
 *   npm install --save-dev @types/cheerio
 *
 * Patrón común para todos los scrapers en lib/scrapers/:
 *   - fetch nativo + cheerio para HTML estático
 *   - Headers realistas con User-Agent
 *   - Delay aleatorio de 1-3 s entre requests
 *   - Retorna EventoCrudo[] sin procesar
 *   - Limpieza/normalización delegada a lib/cleaner/llm-cleaner.ts
 */

import * as cheerio from "cheerio";
import type { EventoCrudo } from "@/lib/cleaner/llm-cleaner";

// ── Config ───────────────────────────────────────────────────────────

const BASE_URL = "https://cartelera.cdmx.gob.mx";
const FUENTE = "Cartelera CDMX";
const MAX_PAGES = 3;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Cache-Control": "no-cache",
};

// ── Helpers ──────────────────────────────────────────────────────────

function randomDelay(): Promise<void> {
  const ms = 1000 + Math.random() * 2000; // 1–3 s
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
  await randomDelay();
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function absoluteUrl(href: string): string {
  if (!href) return BASE_URL;
  if (href.startsWith("http")) return href;
  return href.startsWith("/") ? `${BASE_URL}${href}` : `${BASE_URL}/${href}`;
}

// ── Page parsers ─────────────────────────────────────────────────────

function parseListingPage(html: string): { events: EventoCrudo[]; nextPage?: string } {
  const $ = cheerio.load(html);
  const events: EventoCrudo[] = [];

  // Primary selectors — adjust if the site changes its markup
  const cards = $(".views-row, .event-item, article, .card").filter(
    (_: number, el: any) => $(el).find("h2, h3, .views-field-title").length > 0
  );

  cards.each((_: number, el: any) => {
    try {
      const titulo =
        $(el).find("h2, h3, .views-field-title").first().text().trim();
      const descripcion =
        $(el).find("p, .views-field-body, .description").first().text().trim();
      const fecha =
        $(el)
          .find(
            ".views-field-field-fecha, .date-display-single, time, [class*=fecha], [class*=date]"
          )
          .first()
          .text()
          .trim() ||
        $(el).find("time").attr("datetime") ||
        "";
      const ubicacion =
        $(el)
          .find(".views-field-field-lugar, .venue, [class*=lugar], address")
          .first()
          .text()
          .trim();
      const imagen =
        $(el).find("img").first().attr("src") ||
        $(el).find("img").first().attr("data-src") ||
        "";
      const enlace =
        $(el).find("a").first().attr("href") || "";

      if (!titulo) return;

      events.push({
        titulo,
        descripcion_raw: descripcion,
        fecha_raw: fecha,
        ubicacion_raw: ubicacion || "Ciudad de México",
        url_origen: absoluteUrl(enlace),
        imagen_url: imagen ? absoluteUrl(imagen) : undefined,
        fuente: FUENTE,
      });
    } catch (err) {
      console.warn("[CarteleraCDMX] Error parsing card:", err);
    }
  });

  // Pagination — look for "next page" link
  const nextHref =
    $("a[rel=next]").attr("href") ||
    $(".pager-next a").attr("href") ||
    $("[class*=next] a").attr("href");

  return {
    events,
    nextPage: nextHref ? absoluteUrl(nextHref) : undefined,
  };
}

// ── Main export ───────────────────────────────────────────────────────

/**
 * Scrapes Cartelera CDMX and returns raw events.
 * Feed the result to LLMCleaner.limpiar() to normalize.
 *
 * @example
 * import { scrapeCarteleraCDMX } from "@/lib/scrapers/ejemplo";
 * import { LLMCleaner } from "@/lib/cleaner/llm-cleaner";
 *
 * const raw = await scrapeCarteleraCDMX();
 * const cleaner = new LLMCleaner();
 * const normalized = await cleaner.limpiar(raw);
 */
export async function scrapeCarteleraCDMX(): Promise<EventoCrudo[]> {
  const allEvents: EventoCrudo[] = [];
  let url: string | undefined = BASE_URL;
  let page = 0;

  while (url && page < MAX_PAGES) {
    try {
      console.log(`[CarteleraCDMX] Fetching page ${page + 1}: ${url}`);
      const html = await fetchPage(url);
      const { events, nextPage } = parseListingPage(html);

      allEvents.push(...events);
      console.log(
        `[CarteleraCDMX] Page ${page + 1}: found ${events.length} events (total: ${allEvents.length})`
      );

      url = nextPage;
      page++;
    } catch (err) {
      console.error(`[CarteleraCDMX] Failed on page ${page + 1}:`, err);
      break;
    }
  }

  return allEvents;
}
