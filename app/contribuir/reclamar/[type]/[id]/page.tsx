import { notFound } from "next/navigation";
import Link from "next/link";
import { getPlace } from "@/lib/queries";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPool } from "@/lib/db";
import ReclamarClient from "./ReclamarClient";

interface Props {
  params: Promise<{ type: string; id: string }>;
}

async function getContentName(type: string, id: string): Promise<string | null> {
  if (type === "place") {
    const place = await getPlace(id);
    return place?.name ?? null;
  }
  // event
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query("SELECT title FROM events WHERE id=$1 OR slug=$1", [id]);
      if (rows[0]) return String(rows[0].title);
    } catch { /* fallthrough */ }
  }
  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const { data } = await supabase.from("events").select("title").eq("id", id).single();
    return data?.title ?? null;
  }
  return null;
}

async function hasPendingClaim(type: string, id: string): Promise<boolean> {
  // This is a server component; we can't check the current user without cookies
  // Return false — client will handle showing status after submit
  return false;
}

export default async function ReclamarPage({ params }: Props) {
  const { type, id } = await params;

  if (!["place", "event"].includes(type)) notFound();

  const contentName = await getContentName(type, id);
  if (!contentName) notFound();

  return (
    <main
      style={{
        paddingTop: "calc(var(--topbar-h) + 20px)",
        paddingBottom: "calc(var(--bottomnav-h) + 80px)",
        minHeight: "100dvh",
        background: "var(--bg)",
      }}
    >
      <div style={{ background: "var(--dark)", padding: "16px 20px 0" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <Link
            href={type === "place" ? `/lugar/${id}` : `/evento/${id}`}
            style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem", textDecoration: "none" }}
          >
            ← Volver
          </Link>
          <h1
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#fff",
              margin: "8px 0 4px",
            }}
          >
            Reclamar este {type === "place" ? "lugar" : "evento"}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.875rem", marginBottom: 16 }}>
            ¿Eres el dueño o responsable? Solicita ownership.
          </p>
          <div className="mexican-stripe" style={{ opacity: 0.65 }} />
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 20px" }}>
        <ReclamarClient
          contentType={type as "place" | "event"}
          contentId={id}
          contentName={contentName}
          hasPendingClaim={false}
        />
      </div>
    </main>
  );
}
