"use client";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { ContentSubmission, Claim } from "@/types";

type SubmissionRow = ContentSubmission & { user_name?: string };
type ClaimRow = Claim & { user_name?: string };

interface Props {
  initialSubmissions: SubmissionRow[];
  initialClaims: ClaimRow[];
}

export default function ModeracionClient({ initialSubmissions, initialClaims }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"submissions" | "claims">("submissions");
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [claims, setClaims] = useState(initialClaims);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function authHeader(): Promise<Record<string, string>> {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    if (!url || !key) return {};
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function approveSubmission(id: string) {
    const headers = await authHeader();
    const res = await fetch(`/api/admin/submissions/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ reviewer_note: notes[id] }),
    });
    if (res.ok) setSubmissions((s) => s.filter((x) => x.id !== id));
  }

  async function rejectSubmission(id: string) {
    const headers = await authHeader();
    const res = await fetch(`/api/admin/submissions/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ reviewer_note: notes[id] }),
    });
    if (res.ok) setSubmissions((s) => s.filter((x) => x.id !== id));
  }

  async function approveClaim(id: string) {
    const headers = await authHeader();
    const res = await fetch(`/api/admin/claims/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
    });
    if (res.ok) setClaims((c) => c.filter((x) => x.id !== id));
  }

  async function rejectClaim(id: string) {
    const headers = await authHeader();
    const res = await fetch(`/api/admin/claims/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ admin_note: notes[id] }),
    });
    if (res.ok) setClaims((c) => c.filter((x) => x.id !== id));
  }

  const TAB_STYLE = (active: boolean) => ({
    flex: 1,
    padding: "10px 0",
    background: "none",
    border: "none",
    borderBottom: active ? "2px solid var(--terracota)" : "2px solid transparent",
    color: active ? "var(--terracota)" : "var(--text-muted)",
    fontWeight: active ? 700 : 400,
    fontSize: "0.875rem",
    cursor: "pointer",
    transition: "all 0.15s",
  });

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        <button style={TAB_STYLE(tab === "submissions")} onClick={() => setTab("submissions")}>
          Contenido pendiente ({submissions.length})
        </button>
        <button style={TAB_STYLE(tab === "claims")} onClick={() => setTab("claims")}>
          Reclamaciones ({claims.length})
        </button>
      </div>

      {/* Submissions */}
      {tab === "submissions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {submissions.length === 0 && (
            <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 0" }}>
              Sin contenido pendiente ✓
            </p>
          )}
          {submissions.map((s) => {
            const p = s.payload as Record<string, unknown>;
            return (
              <div
                key={s.id}
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: 16,
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <span
                      className="tag"
                      style={{ background: s.content_type === "place" ? "#e8f4f0" : "#fef3e2", color: s.content_type === "place" ? "var(--jade)" : "#b7791f", marginRight: 8 }}
                    >
                      {s.content_type === "place" ? "📍 Lugar" : "🎉 Evento"}
                    </span>
                    <strong style={{ color: "var(--text)" }}>
                      {String(p.name ?? p.title ?? "Sin título")}
                    </strong>
                  </div>
                  <span className="label-muted" style={{ fontSize: "0.75rem" }}>
                    por {s.user_name ?? "usuario"}
                  </span>
                </div>
                {!!p.description && (
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 8, lineHeight: 1.4 }}>
                    {String(p.description).slice(0, 200)}...
                  </p>
                )}
                {!!p.town && (
                  <p className="label-muted" style={{ fontSize: "0.8rem", marginBottom: 10 }}>
                    📍 {String(p.town)}, {String(p.state ?? "")}
                  </p>
                )}
                <textarea
                  placeholder="Nota al usuario (opcional)"
                  value={notes[s.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                  rows={2}
                  style={{
                    width: "100%",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)",
                    padding: "8px 12px",
                    fontSize: "0.85rem",
                    color: "var(--text)",
                    resize: "vertical",
                    marginBottom: 10,
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => approveSubmission(s.id)}
                    style={{
                      flex: 1, height: 36, background: "var(--jade)", color: "#fff",
                      border: "none", borderRadius: "var(--r-xl)", fontWeight: 600,
                      fontSize: "0.875rem", cursor: "pointer",
                    }}
                  >
                    ✓ Aprobar
                  </button>
                  <button
                    onClick={() => rejectSubmission(s.id)}
                    style={{
                      flex: 1, height: 36, background: "var(--bg-muted)", color: "var(--text-secondary)",
                      border: "1px solid var(--border)", borderRadius: "var(--r-xl)", fontWeight: 600,
                      fontSize: "0.875rem", cursor: "pointer",
                    }}
                  >
                    ✕ Rechazar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Claims */}
      {tab === "claims" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {claims.length === 0 && (
            <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 0" }}>
              Sin reclamaciones pendientes ✓
            </p>
          )}
          {claims.map((c) => (
            <div
              key={c.id}
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: 16,
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <span
                    className="tag"
                    style={{ background: "#fef3e2", color: "#b7791f", marginRight: 8 }}
                  >
                    {c.content_type === "place" ? "📍 Lugar" : "🎉 Evento"} #{c.content_id}
                  </span>
                </div>
                <span className="label-muted" style={{ fontSize: "0.75rem" }}>
                  por {c.user_name ?? "usuario"}
                </span>
              </div>
              {c.reason && (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 10, fontStyle: "italic" }}>
                  "{c.reason}"
                </p>
              )}
              <textarea
                placeholder="Nota al usuario (opcional)"
                value={notes[c.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                rows={2}
                style={{
                  width: "100%",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "8px 12px",
                  fontSize: "0.85rem",
                  color: "var(--text)",
                  resize: "vertical",
                  marginBottom: 10,
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => approveClaim(c.id)}
                  style={{
                    flex: 1, height: 36, background: "var(--jade)", color: "#fff",
                    border: "none", borderRadius: "var(--r-xl)", fontWeight: 600,
                    fontSize: "0.875rem", cursor: "pointer",
                  }}
                >
                  ✓ Aprobar
                </button>
                <button
                  onClick={() => rejectClaim(c.id)}
                  style={{
                    flex: 1, height: 36, background: "var(--bg-muted)", color: "var(--text-secondary)",
                    border: "1px solid var(--border)", borderRadius: "var(--r-xl)", fontWeight: 600,
                    fontSize: "0.875rem", cursor: "pointer",
                  }}
                >
                  ✕ Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
