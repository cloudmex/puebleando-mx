import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getPool } from "@/lib/db";

export async function GET() {
  const supabase = getSupabaseClient();
  const pool = getPool();

  try {
    let sources = [];
    let jobs = [];
    let events = [];

    if (supabase) {
      const { data: sourcesData } = await supabase.from("scraping_sources").select("*");
      const { data: jobsData } = await supabase.from("scraping_jobs").select("*").order("started_at", { ascending: false }).limit(10);
      const { data: eventsData } = await supabase.from("events").select("*").order("scraped_at", { ascending: false }).limit(20);
      sources = sourcesData || [];
      jobs = jobsData || [];
      events = eventsData || [];
    } else if (pool) {
      const sourcesRes = await pool.query("SELECT * FROM scraping_sources");
      const jobsRes = await pool.query("SELECT * FROM scraping_jobs ORDER BY started_at DESC LIMIT 10");
      const eventsRes = await pool.query("SELECT * FROM events ORDER BY scraped_at DESC LIMIT 20");
      sources = sourcesRes.rows;
      jobs = jobsRes.rows;
      events = eventsRes.rows;
    }

    return NextResponse.json({ sources, jobs, events });
  } catch (err: any) {
    console.error("Admin data API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  const pool = getPool();

  try {
    const { name, base_url, default_category } = await request.json();

    if (supabase) {
      const { error } = await supabase.from("scraping_sources").insert({
        name,
        base_url,
        default_category,
        parser_config: { depth: 1, max_pages: 5 }
      });
      if (error) throw error;
    } else if (pool) {
      await pool.query(
        "INSERT INTO scraping_sources (name, base_url, default_category, parser_config) VALUES ($1, $2, $3, $4)",
        [name, base_url, default_category, JSON.stringify({ depth: 1, max_pages: 5 })]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error creating source:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export async function DELETE(request: Request) {
  const supabase = getSupabaseClient();
  const pool = getPool();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) throw new Error("Event ID is required");

    if (supabase) {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    } else if (pool) {
      await pool.query("DELETE FROM events WHERE id = $1", [id]);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting event:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
