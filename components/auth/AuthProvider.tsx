"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@/types";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { getRoutes } from "@/lib/routeStore";
import { getApiAuthHeader } from "@/lib/apiAuth";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function fetchProfile(userId: string) {
    try {
      const isLocal = !isSupabaseConfigured();
      const mockToken = isLocal ? localStorage.getItem("puebleando_mock_token") : null;

      const headers: Record<string, string> = {};
      if (mockToken) headers["Authorization"] = `Bearer ${mockToken}`;

      const res = await fetch("/api/auth/me", { headers });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile ?? null);
      }
    } catch {
      // silently fail
    }
  }

  async function migrateLocalRoutes() {
    const localRoutes = getRoutes();
    if (localRoutes.length === 0) return;

    try {
      const authHeaders = await getApiAuthHeader();
      if (!authHeaders["Authorization"]) return;

      // Fetch existing DB routes to avoid duplicates
      const existingRes = await fetch("/api/routes", { headers: authHeaders });
      const existingIds = new Set<string>();
      if (existingRes.ok) {
        const { routes } = await existingRes.json();
        (routes ?? []).forEach((r: { id: string }) => existingIds.add(r.id));
      }

      // Push only routes that don't exist in DB yet
      const toMigrate = localRoutes.filter((r) => !existingIds.has(r.id));
      await Promise.all(
        toMigrate.map((r) =>
          fetch("/api/routes", {
            method: "POST",
            headers: { ...authHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ id: r.id, name: r.name, description: r.description, stops: r.stops, created_at: r.created_at }),
          })
        )
      );
    } catch {
      // non-fatal — routes remain in localStorage as fallback
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      const mockToken = localStorage.getItem("puebleando_mock_token");
      if (mockToken) {
        const mockUser = { id: "local-admin", email: "local@puebleando.mx" } as User;
        setUser(mockUser);
        fetchProfile("local-admin");
        migrateLocalRoutes();
      }
      setLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        migrateLocalRoutes();
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
          migrateLocalRoutes();
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    if (!isSupabaseConfigured()) {
      localStorage.removeItem("puebleando_mock_token");
      setUser(null);
      setProfile(null);
      // Hard navigation to ensure state is cleared everywhere
      window.location.href = "/";
      return;
    }

    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.push("/");
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
