import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPool } from "@/lib/db";
import type { ContentSubmission, Claim } from "@/types";
import ModeracionClient from "./ModeracionClient";
import Link from "next/link";

type SubmissionRow = ContentSubmission & { user_name?: string };
type ClaimRow = Claim & { user_name?: string };

async function getPendingSubmissions(): Promise<SubmissionRow[]> {
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(`
        SELECT cs.*, up.display_name as user_name
        FROM content_submissions cs
        JOIN user_profiles up ON cs.user_id = up.id
        WHERE cs.status = 'pendiente_revision'
        ORDER BY cs.created_at ASC
      `);
      return rows as SubmissionRow[];
    } catch { /* fallthrough */ }
  }

  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const { data } = await supabase
      .from("content_submissions")
      .select("*, user_profiles(display_name)")
      .eq("status", "pendiente_revision")
      .order("created_at", { ascending: true });
    return (data ?? []) as SubmissionRow[];
  }

  return [];
}

async function getPendingClaims(): Promise<ClaimRow[]> {
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(`
        SELECT c.*, up.display_name as user_name
        FROM claims c
        JOIN user_profiles up ON c.user_id = up.id
        WHERE c.status = 'pending'
        ORDER BY c.created_at ASC
      `);
      return rows as ClaimRow[];
    } catch { /* fallthrough */ }
  }

  const supabase = getSupabaseServerClient(true);
  if (supabase) {
    const { data } = await supabase
      .from("claims")
      .select("*, user_profiles(display_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    return (data ?? []) as ClaimRow[];
  }

  return [];
}

export const metadata = { title: "Moderación – Admin Puebleando" };

export default async function ModeracionPage() {
  const [submissions, claims] = await Promise.all([
    getPendingSubmissions(),
    getPendingClaims(),
  ]);

  return (
    <main
      style={{
        paddingTop: "calc(var(--topbar-h) + 20px)",
        paddingBottom: "calc(var(--bottomnav-h) + 20px)",
        minHeight: "100dvh",
        background: "var(--bg-subtle)",
      }}
    >
      {/* Header */}
      <div style={{ background: "var(--dark)", padding: "20px 20px 0" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <Link
              href="/admin/scraping"
              style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem", textDecoration: "none" }}
            >
              ← Admin
            </Link>
          </div>
          <h1
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: "1.6rem",
              fontWeight: 700,
              color: "#fff",
              marginBottom: 4,
            }}
          >
            Moderación de contenido
          </h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.875rem", marginBottom: 16 }}>
            {submissions.length + claims.length} elementos pendientes de revisión
          </p>
          <div className="mexican-stripe" style={{ opacity: 0.65 }} />
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }}>
        <ModeracionClient initialSubmissions={submissions} initialClaims={claims} />
      </div>
    </main>
  );
}
