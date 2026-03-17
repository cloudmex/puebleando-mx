"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Place, Claim, ContentSubmission } from "@/types";
import DashboardClient from "./DashboardClient";

export default function DashboardFetcher() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [ownedPlaces, setOwnedPlaces] = useState<Place[]>([]);
  const [ownedEvents, setOwnedEvents] = useState<any[]>([]);
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
      try {
        // Determine auth token: mock in local, real JWT in production
        const isLocal = !isSupabaseConfigured();
        const token = isLocal
          ? localStorage.getItem("puebleando_mock_token")
          : null; // production path uses the /api/dashboard/data server-side auth

        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch("/api/dashboard/data", { headers });
        if (res.ok) {
          const data = await res.json();
          setOwnedPlaces(data.places ?? []);
          setOwnedEvents(data.events ?? []);
          setSubmissions(data.submissions ?? []);
          setClaims(data.claims ?? []);
        }
      } catch (err) {
        console.error("[DashboardFetcher] fetch error", err);
      } finally {
        setDataLoading(false);
      }
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
      ownedEvents={ownedEvents}
      submissions={submissions}
      claims={claims}
    />
  );
}
