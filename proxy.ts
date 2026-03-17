import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/admin/:path*"],
};

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, allow access (dev/mock mode)
  if (!url || !anonKey) return NextResponse.next();

  // Extract token from cookie (Supabase stores it as sb-<project>-auth-token)
  const cookieHeader = request.headers.get("cookie") ?? "";
  let token: string | null = null;

  // Parse access token from any Supabase auth cookie
  const cookieParts = cookieHeader.split(";");
  for (const part of cookieParts) {
    const trimmed = part.trim();
    if (trimmed.includes("sb-") && trimmed.includes("-auth-token=")) {
      try {
        const value = trimmed.split("=").slice(1).join("=");
        const decoded = decodeURIComponent(value);
        const parsed = JSON.parse(decoded);
        if (parsed?.access_token) {
          token = parsed.access_token;
          break;
        }
      } catch {
        // continue
      }
    }
  }

  // Also check Authorization header as fallback
  if (!token) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) token = authHeader.slice(7);
  }

  if (!token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate token and get user
  try {
    const userRes = await fetch(`${url}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });

    if (!userRes.ok) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    const userData = await userRes.json();
    const userId = userData?.id;
    if (!userId) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    // Fetch profile to check trust_level
    const profileRes = await fetch(
      `${url}/rest/v1/user_profiles?id=eq.${userId}&select=trust_level`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          Accept: "application/json",
        },
      }
    );

    if (!profileRes.ok) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const profiles = await profileRes.json();
    const trustLevel = profiles?.[0]?.trust_level;

    if (trustLevel !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } catch {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
