"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabaseClient } from "@/lib/supabase";
import type { Place, Claim, ContentSubmission } from "@/types";
import DashboardClient from "./DashboardClient";

export default function DashboardFetcher() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [ownedPlaces, setOwnedPlaces] = useState<Place[]>([]);
  const [submissions, setSubmissions] = useState<ContentSubmission[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login?redirect=/mi-cuenta");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      const supabase = getSupabaseClient();
      if (!supabase) { setDataLoading(false); return; }

      const session = (await supabase.auth.getSession()).data.session;
      if (!session) { setDataLoading(false); return; }

      const token = session.access_token;
      const userId = session.user.id;
      const headers = { Authorization: `Bearer ${token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" };

      // Fetch owned places
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (url) {
        const [placesRes, subsRes, claimsRes] = await Promise.allSettled([
          fetch(`${url}/rest/v1/places?submitted_by=eq.${userId}&select=*`, { headers }),
          fetch(`${url}/rest/v1/content_submissions?user_id=eq.${userId}&select=*&order=created_at.asc`, { headers }),
          fetch(`${url}/rest/v1/claims?user_id=eq.${userId}&select=*&order=created_at.desc`, { headers }),
        ]);

        if (placesRes.status === "fulfilled" && placesRes.value.ok) {
          const data = await placesRes.value.json();
          setOwnedPlaces(data ?? []);
        }
        if (subsRes.status === "fulfilled" && subsRes.value.ok) {
          const data = await subsRes.value.json();
          setSubmissions(data ?? []);
        }
        if (claimsRes.status === "fulfilled" && claimsRes.value.ok) {
          const data = await claimsRes.value.json();
          setClaims(data ?? []);
        }
      }

      setDataLoading(false);
    }

    fetchData();
  }, [user]);

  if (loading || (user && dataLoading)) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
        Cargando...
      </div>
    );
  }

  if (!user || !profile) return null;

  return (
    <DashboardClient
      profile={profile}
      ownedPlaces={ownedPlaces}
      submissions={submissions}
      claims={claims}
    />
  );
}
