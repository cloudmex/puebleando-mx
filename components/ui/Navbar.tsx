"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";

/* ── Inline SVG icons (refined strokes) ──────────────────── */
function ExploreIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="9" />
      <path d="M14.5 7.5l-3 6-6 3 3-6 6-3z" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}
function PlanIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="16" height="16" rx="3" />
      <line x1="15" y1="1" x2="15" y2="5" />
      <line x1="7" y1="1" x2="7" y2="5" />
      <line x1="3" y1="9" x2="19" y2="9" />
      <line x1="7" y1="13" x2="9" y2="13" />
      <line x1="7" y1="16" x2="11" y2="16" />
    </svg>
  );
}
function SavedIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill={active ? "currentColor" : "none"} stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 18.5l-7.5-7A4.24 4.24 0 0 1 5 4.5a4.24 4.24 0 0 1 6 0 4.24 4.24 0 0 1 6 0 4.24 4.24 0 0 1 1.5 7l-7.5 7z" />
    </svg>
  );
}
function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="8" r="3.5" fill={active ? "currentColor" : "none"} stroke={active ? "none" : "currentColor"} />
      <path d="M4 19c0-3.866 3.134-7 7-7s7 3.134 7 7" />
    </svg>
  );
}
function ChoferIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="4" />
      <path d="M3.5 11h3.5M15 11h3.5M11 3.5v3.5M11 15v3.5" />
      <path d="M5.5 5.5l2.5 2.5M14 14l2.5 2.5M5.5 16.5l2.5-2.5M14 8l2.5-2.5"
        fill={active ? "currentColor" : "none"} />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/",          label: "Planear",   Icon: PlanIcon },
  { href: "/explorar",  label: "Explorar",  Icon: ExploreIcon },
  { href: "/choferes",  label: "Pueblear",  Icon: ChoferIcon },
  { href: "/rutas",     label: "Guardados", Icon: SavedIcon },
  { href: "/mi-cuenta", label: "Perfil",    Icon: ProfileIcon },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, profile, loading } = useAuth();

  const initial = profile?.display_name?.charAt(0)?.toUpperCase()
    || user?.email?.charAt(0)?.toUpperCase()
    || "?";
  const firstName = profile?.display_name?.split(" ")[0] ?? "";

  return (
    <>
      {/* ── Top bar — glassmorphic brand ────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 glass"
        style={{
          height: "calc(var(--topbar-h) + var(--safe-top))",
          paddingTop: "var(--safe-top)",
        }}
      >
        <Link href="/" className="flex items-center gap-2">
          <span
            className="font-bold"
            style={{
              fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
              fontSize: "1.15rem",
              letterSpacing: "-0.02em",
              color: "var(--on-surface)",
            }}
          >
            Puebleando
          </span>
        </Link>

        {/* Auth-aware right side */}
        {!loading && (
          user ? (
            <Link
              href="/mi-cuenta"
              className="flex items-center gap-2"
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--r-full)",
                  background: "linear-gradient(135deg, var(--primary), var(--primary-container))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
                  flexShrink: 0,
                }}
              >
                {initial}
              </div>
              {firstName && (
                <span
                  className="hidden sm:inline"
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--on-surface)",
                    maxWidth: 100,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {firstName}
                </span>
              )}
            </Link>
          ) : (
            <Link
              href="/auth/login"
              style={{
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "var(--primary)",
                textDecoration: "none",
                padding: "6px 14px",
                borderRadius: "var(--r-full)",
                border: "1.5px solid var(--primary)",
              }}
            >
              Ingresar
            </Link>
          )
        )}
      </header>

      {/* ── Bottom nav — clean, modern ──────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex glass"
        aria-label="Navegación principal"
        style={{
          height: "calc(var(--bottomnav-h) + var(--safe-bottom))",
          paddingBottom: "var(--safe-bottom)",
        }}
      >
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active =
            href === "/"
              ? pathname === "/" || pathname.startsWith("/planear") || pathname.startsWith("/mapa")
              : href === "/explorar"
                ? pathname.startsWith("/explorar") || pathname.startsWith("/lugar")
                : href === "/choferes"
                  ? pathname.startsWith("/choferes") || pathname.startsWith("/pueblear")
                  : href === "/rutas"
                    ? pathname.startsWith("/rutas")
                    : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className="relative flex-1" aria-current={active ? "page" : undefined} aria-label={label}>
              <motion.div
                whileTap={{ scale: 0.88 }}
                className="flex flex-col items-center justify-center gap-1 h-full"
                style={{ color: active ? "var(--primary)" : "var(--text-muted)" }}
              >
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute -top-0.5 rounded-full"
                    style={{
                      width: 32,
                      height: 3,
                      background: "linear-gradient(135deg, var(--primary), var(--primary-container))",
                      borderRadius: "var(--r-full)",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <Icon active={active} />
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: active ? 700 : 500,
                    letterSpacing: "0.01em",
                  }}
                >
                  {label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
