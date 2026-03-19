import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getPool } from "@/lib/db";
import { ScrapingOrchestrator } from "@/lib/scraping/orchestrator";
import { ScrapingSource } from "@/types/events";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

interface JobState {
  status: "running" | "completed" | "failed";
  progreso: string;
  resultado?: { nuevos: number; actualizados: number; errores: number };
  error?: string;
  startedAt: number;
}

// Module-level singleton — persists between requests on a VPS with `next start`
const activeJobs = new Map<string, JobState>();

function isSupabase(db: SupabaseClient | Pool): db is SupabaseClient {
  return typeof (db as SupabaseClient).from === "function";
}

// ── POST /api/scraping ──────────────────────────────────────────────
// Returns { status: "started", jobId } immediately; pipeline runs in background.
// Returns 409 if a job is already running (double-execution guard).
export async function POST(request: Request) {
  const alreadyRunning = [...activeJobs.values()].some(
    (j) => j.status === "running"
  );
  if (alreadyRunning) {
    return NextResponse.json(
      { status: "already_running", message: "Ya hay un scraping en progreso" },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const sourceId: string | undefined = body?.sourceId || undefined;

  const jobId = crypto.randomUUID();
  activeJobs.set(jobId, {
    status: "running",
    progreso: "Iniciando pipeline…",
    startedAt: Date.now(),
  });

  // Fire and forget — HTTP response is sent before pipeline completes
  runPipelineBackground(jobId, sourceId).catch((err) => {
    const prev = activeJobs.get(jobId);
    activeJobs.set(jobId, {
      ...(prev ?? { startedAt: Date.now() }),
      status: "failed",
      progreso: "Error inesperado en el pipeline",
      error: String(err?.message ?? err),
    });
  });

  return NextResponse.json({ status: "started", jobId });
}

// ── GET /api/scraping?jobId=xxx ─────────────────────────────────────
// Poll this endpoint every 3 s to track pipeline progress.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const job = activeJobs.get(jobId);
  if (!job) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    progreso: job.progreso,
    ...(job.resultado && { resultado: job.resultado }),
    ...(job.error && { error: job.error }),
  });
}

// ── Background pipeline ─────────────────────────────────────────────
async function runPipelineBackground(
  jobId: string,
  sourceId?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const pool = getPool();
  const db = supabase ?? pool;

  const update = (patch: Partial<JobState>) =>
    activeJobs.set(jobId, { ...activeJobs.get(jobId)!, ...patch });

  if (!db) {
    update({
      status: "failed",
      progreso: "Base de datos no configurada",
      error: "DATABASE_URL or Supabase env vars missing",
    });
    return;
  }

  let totalNuevos = 0;
  let totalErrores = 0;

  try {
    update({ progreso: "Obteniendo fuentes activas…" });

    const sources = sourceId
      ? await querySingleSource(db, sourceId)
      : await queryActiveSources(db);

    if (sources.length === 0) {
      update({
        status: "completed",
        progreso: "No hay fuentes activas para procesar",
        resultado: { nuevos: 0, actualizados: 0, errores: 0 },
      });
      return;
    }

    const orchestrator = new ScrapingOrchestrator(db);

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      update({
        progreso: `Procesando "${source.name}" (${i + 1}/${sources.length})…`,
      });

      try {
        const { jobId: completedJobId } = await orchestrator.runJob(source.id);
        const result = await queryJobResult(db, completedJobId);
        totalNuevos += result?.new_events ?? 0;
        totalErrores += result?.failed_events ?? 0;
      } catch (err) {
        console.error(`[Pipeline] Fuente "${source.name}" falló:`, err);
        totalErrores++;
      }
    }

    update({
      status: "completed",
      progreso: "Pipeline completado",
      resultado: { nuevos: totalNuevos, actualizados: 0, errores: totalErrores },
    });
  } catch (err: any) {
    update({
      status: "failed",
      progreso: "Error ejecutando el pipeline",
      error: err.message,
    });
  } finally {
    // Auto-cleanup after 5 minutes so the Map doesn't grow indefinitely
    setTimeout(() => activeJobs.delete(jobId), 5 * 60 * 1000);
  }
}

// ── DB helpers ──────────────────────────────────────────────────────
async function querySingleSource(
  db: SupabaseClient | Pool,
  sourceId: string
): Promise<ScrapingSource[]> {
  if (isSupabase(db)) {
    const { data } = await db
      .from("scraping_sources")
      .select("*")
      .eq("id", sourceId)
      .single();
    return data ? [data as ScrapingSource] : [];
  }
  const { rows } = await (db as Pool).query(
    "SELECT * FROM scraping_sources WHERE id = $1",
    [sourceId]
  );
  return rows as ScrapingSource[];
}

async function queryActiveSources(
  db: SupabaseClient | Pool
): Promise<ScrapingSource[]> {
  if (isSupabase(db)) {
    const { data } = await db
      .from("scraping_sources")
      .select("*")
      .eq("is_active", true);
    return (data ?? []) as ScrapingSource[];
  }
  const { rows } = await (db as Pool).query(
    "SELECT * FROM scraping_sources WHERE is_active = true"
  );
  return rows as ScrapingSource[];
}

async function queryJobResult(
  db: SupabaseClient | Pool,
  jobId: string
): Promise<{ new_events: number; failed_events: number } | null> {
  if (isSupabase(db)) {
    const { data } = await db
      .from("scraping_jobs")
      .select("new_events, failed_events")
      .eq("id", jobId)
      .single();
    return data;
  }
  const { rows } = await (db as Pool).query(
    "SELECT new_events, failed_events FROM scraping_jobs WHERE id = $1",
    [jobId]
  );
  return rows[0] ?? null;
}
