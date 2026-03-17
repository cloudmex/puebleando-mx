/**
 * GET /api/scraping/debug
 * Health check for every component of the scraping pipeline.
 * Returns a structured report so issues are visible without reading server logs.
 *
 * GET /api/scraping/debug?testUrl=https://ejemplo.com
 * Also runs a full pipeline test on a specific URL:
 *   fetch → extract text → LLM → show raw LLM output
 * (Does NOT save to DB — safe to call at any time)
 */
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getSupabaseClient } from "@/lib/supabase";
import Groq from "groq-sdk";

interface CheckResult {
  ok: boolean;
  detail: string;
  latency_ms?: number;
}

interface DebugReport {
  timestamp: string;
  checks: Record<string, CheckResult>;
  jobs_summary?: { total: number; completed: number; failed: number; running: number };
  recent_failures?: { source: string; error: string; at: string }[];
  pipeline_test?: Record<string, unknown>;
}

// ── Individual checks ────────────────────────────────────────────────

async function checkDatabase(): Promise<CheckResult> {
  const t0 = Date.now();
  const supabase = getSupabaseClient();
  const pool = getPool();
  try {
    if (supabase) {
      const { error } = await supabase.from("scraping_sources").select("id").limit(1);
      if (error) throw error;
      return { ok: true, detail: "Supabase OK", latency_ms: Date.now() - t0 };
    }
    if (pool) {
      await pool.query("SELECT 1");
      return { ok: true, detail: "PostgreSQL OK", latency_ms: Date.now() - t0 };
    }
    return { ok: false, detail: "No DATABASE_URL or Supabase env vars set" };
  } catch (err: any) {
    return { ok: false, detail: err.message, latency_ms: Date.now() - t0 };
  }
}

async function checkGroq(): Promise<CheckResult> {
  const t0 = Date.now();
  if (!process.env.GROQ_API_KEY) {
    return { ok: false, detail: "GROQ_API_KEY not set" };
  }
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const res = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: 'Respond with only the word "ok"' }],
      max_tokens: 5,
    });
    const reply = res.choices[0]?.message?.content?.trim().toLowerCase() ?? "";
    return {
      ok: reply.includes("ok"),
      detail: `Model responded: "${reply}"`,
      latency_ms: Date.now() - t0,
    };
  } catch (err: any) {
    return { ok: false, detail: err.message, latency_ms: Date.now() - t0 };
  }
}

async function checkCloudflare(): Promise<CheckResult> {
  const t0 = Date.now();
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) {
    return { ok: false, detail: "CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID not set" };
  }
  try {
    // Verify token via the CF API — lightweight call
    const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      return { ok: true, detail: `Token valid (${data.result?.status})`, latency_ms: Date.now() - t0 };
    }
    return { ok: false, detail: JSON.stringify(data.errors), latency_ms: Date.now() - t0 };
  } catch (err: any) {
    return { ok: false, detail: err.message, latency_ms: Date.now() - t0 };
  }
}

async function checkMapbox(): Promise<CheckResult> {
  const t0 = Date.now();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return { ok: false, detail: "NEXT_PUBLIC_MAPBOX_TOKEN not set" };
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/Guadalajara.json?access_token=${token}&limit=1`
    );
    if (res.ok) return { ok: true, detail: "Mapbox geocoding reachable", latency_ms: Date.now() - t0 };
    return { ok: false, detail: `HTTP ${res.status}`, latency_ms: Date.now() - t0 };
  } catch (err: any) {
    return { ok: false, detail: err.message, latency_ms: Date.now() - t0 };
  }
}

async function getJobsSummary() {
  const supabase = getSupabaseClient();
  const pool = getPool();
  try {
    if (supabase) {
      const { data } = await supabase
        .from("scraping_jobs")
        .select("status, error_message, started_at, source_id")
        .order("started_at", { ascending: false })
        .limit(20);
      return summarizeJobs(data ?? []);
    }
    if (pool) {
      const { rows } = await pool.query(
        "SELECT status, error_message, started_at, source_id FROM scraping_jobs ORDER BY started_at DESC LIMIT 20"
      );
      return summarizeJobs(rows);
    }
  } catch {
    return null;
  }
  return null;
}

function summarizeJobs(rows: any[]) {
  const counts = { total: rows.length, completed: 0, failed: 0, running: 0 };
  const failures: { source: string; error: string; at: string }[] = [];
  for (const r of rows) {
    if (r.status === "completed") counts.completed++;
    else if (r.status === "failed") {
      counts.failed++;
      failures.push({ source: r.source_id ?? "?", error: r.error_message ?? "unknown", at: r.started_at });
    } else if (r.status === "running") counts.running++;
  }
  return { summary: counts, failures: failures.slice(0, 5) };
}

// ── Pipeline test on a real URL ──────────────────────────────────────

async function testPipeline(url: string): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { url };

  // Step 1: Fetch URL directly (bypass Cloudflare to isolate issues)
  let html = "";
  const t1 = Date.now();
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PueblandoDebug/1.0)" },
    });
    html = await res.text();
    result.fetch = {
      ok: res.ok,
      status: res.status,
      bytes: html.length,
      latency_ms: Date.now() - t1,
      preview: html.slice(0, 300).replace(/\s+/g, " "),
    };
  } catch (err: any) {
    result.fetch = { ok: false, error: err.message };
    return result;
  }

  // Step 2: LLM extraction on the raw HTML
  if (!process.env.GROQ_API_KEY) {
    result.llm = { ok: false, error: "GROQ_API_KEY not set" };
    return result;
  }
  const t2 = Date.now();
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const cleaned = html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<[^>]*>/gm, " ")
      .replace(/\s\s+/g, " ")
      .trim()
      .slice(0, 8000); // smaller context for debug speed

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Extrae eventos de este texto. Devuelve JSON: {"events":[{"titulo":"...","fecha":"...","lugar":"..."}]}. Si no hay eventos devuelve {"events":[]}.`,
        },
        { role: "user", content: cleaned },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    result.llm = {
      ok: true,
      events_found: (parsed.events ?? []).length,
      latency_ms: Date.now() - t2,
      raw_response: parsed,
    };
  } catch (err: any) {
    result.llm = { ok: false, error: err.message, latency_ms: Date.now() - t2 };
  }

  return result;
}

// ── Route handler ────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const testUrl = searchParams.get("testUrl");

  // Run all health checks in parallel
  const [db, groq, cloudflare, mapbox, jobsData] = await Promise.all([
    checkDatabase(),
    checkGroq(),
    checkCloudflare(),
    checkMapbox(),
    getJobsSummary(),
  ]);

  const report: DebugReport = {
    timestamp: new Date().toISOString(),
    checks: { database: db, groq, cloudflare, mapbox },
    jobs_summary: jobsData?.summary,
    recent_failures: jobsData?.failures,
  };

  if (testUrl) {
    report.pipeline_test = await testPipeline(testUrl);
  }

  const allOk = Object.values(report.checks).every((c) => c.ok);
  return NextResponse.json(report, { status: allOk ? 200 : 207 });
}
