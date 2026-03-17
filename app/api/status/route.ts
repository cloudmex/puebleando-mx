import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getSupabaseClient } from "@/lib/supabase";

async function checkPostgres() {
  const pool = getPool();
  if (!pool) return { ok: false, message: "DATABASE_URL no configurado" };
  const t0 = Date.now();
  try {
    await pool.query("SELECT 1");
    const [{ count }] = (await pool.query("SELECT COUNT(*) as count FROM places")).rows;
    const [{ events }] = (await pool.query("SELECT COUNT(*) as events FROM events")).rows;
    return { ok: true, message: `Conectado`, latency: Date.now() - t0, places: Number(count), events: Number(events) };
  } catch (err: any) {
    return { ok: false, message: err.message, latency: Date.now() - t0 };
  }
}

async function checkSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, message: "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY no configurados" };
  const t0 = Date.now();
  try {
    const { count: placesCount, error: e1 } = await supabase
      .from("places")
      .select("*", { count: "exact", head: true });
    if (e1) throw e1;
    const { count: eventsCount, error: e2 } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true });
    if (e2) throw e2;
    return { ok: true, message: "Conectado", latency: Date.now() - t0, places: placesCount ?? 0, events: eventsCount ?? 0 };
  } catch (err: any) {
    return { ok: false, message: err.message, latency: Date.now() - t0 };
  }
}

async function checkMapbox() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return { ok: false, message: "NEXT_PUBLIC_MAPBOX_TOKEN no configurado" };
  return { ok: true, message: "Token configurado" };
}

async function checkScraping() {
  const pool = getPool();
  const supabase = getSupabaseClient();
  const t0 = Date.now();
  try {
    if (pool) {
      const [{ count: sources }] = (await pool.query("SELECT COUNT(*) as count FROM scraping_sources")).rows;
      const [{ count: jobs }] = (await pool.query("SELECT COUNT(*) as count FROM scraping_jobs")).rows;
      return { ok: true, message: "Tablas disponibles", latency: Date.now() - t0, sources: Number(sources), jobs: Number(jobs) };
    }
    if (supabase) {
      const { count: sources } = await supabase.from("scraping_sources").select("*", { count: "exact", head: true });
      const { count: jobs } = await supabase.from("scraping_jobs").select("*", { count: "exact", head: true });
      return { ok: true, message: "Tablas disponibles", latency: Date.now() - t0, sources: sources ?? 0, jobs: jobs ?? 0 };
    }
    return { ok: false, message: "Sin base de datos configurada" };
  } catch (err: any) {
    return { ok: false, message: err.message, latency: Date.now() - t0 };
  }
}

export async function GET() {
  const [postgres, supabase, mapbox, scraping] = await Promise.all([
    checkPostgres(),
    checkSupabase(),
    checkMapbox(),
    checkScraping(),
  ]);

  const allOk = [postgres, supabase, mapbox, scraping].every((s) => s.ok);
  const anyOk = [postgres, supabase].some((s) => s.ok);

  return NextResponse.json(
    {
      status: allOk ? "ok" : anyOk ? "degraded" : "error",
      timestamp: new Date().toISOString(),
      services: { postgres, supabase, mapbox, scraping },
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
