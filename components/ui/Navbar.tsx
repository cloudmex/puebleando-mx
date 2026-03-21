"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";

/* ── Inline SVG icons ──────────────────── */
function MapIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2C8.24 2 6 4.24 6 7c0 4.5 5 13 5 13s5-8.5 5-13c0-2.76-2.24-5-5-5z" />
      <circle cx="11" cy="7.5" r="1.75" fill={active ? "currentColor" : "none"} stroke="none" />
    </svg>
  );
}
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
      <rect x="3" y="3" width="16" height="16" rx="2" />
      <line x1="15" y1="1" x2="15" y2="5" />
      <line x1="7" y1="1" x2="7" y2="5" />
      <line x1="3" y1="9" x2="19" y2="9" />
      <line x1="7" y1="13" x2="9" y2="13" />
      <line x1="7" y1="16" x2="11" y2="16" />
    </svg>
  );
}
function AccountIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="8" r="3.5" fill={active ? "currentColor" : "none"} stroke={active ? "none" : "currentColor"} />
      <path d="M4 19c0-3.866 3.134-7 7-7s7 3.134 7 7" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/",          label: "Planear",   Icon: PlanIcon },
  { href: "/mapa",      label: "Mapa",      Icon: MapIcon },
  { href: "/explorar",  label: "Explorar",  Icon: ExploreIcon },
  { href: "/mi-cuenta", label: "Mi cuenta", Icon: AccountIcon },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <>
      {/* ── Top bar — brand only ────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center px-5"
        style={{
          height: "calc(var(--topbar-h) + var(--safe-top))",
          paddingTop: "var(--safe-top)",
          background: "var(--dark)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <Link href="/" className="flex items-center gap-2">
          <span
            className="font-bold text-white"
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: "1.1rem",
              letterSpacing: "-0.01em",
            }}
          >
            puebleando
          </span>
          <span style={{ fontSize: "1rem", lineHeight: 1 }}>🌮</span>
        </Link>
      </header>

      {/* ── Bottom nav ──────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex"
        style={{
          height: "calc(var(--bottomnav-h) + var(--safe-bottom))",
          paddingBottom: "var(--safe-bottom)",
          background: "var(--bg)",
          borderTop: "1px solid var(--border)",
        }}
      >
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active =
            href === "/"
              ? pathname === "/" || pathname.startsWith("/planear")
              : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className="relative flex-1">
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 inset-x-0 h-0.5"
                  style={{ background: "var(--terracota)" }}
                />
              )}
              <motion.div
                whileTap={{ scale: 0.88 }}
                className="flex flex-col items-center justify-center gap-1 h-full"
                style={{ color: active ? "var(--terracota)" : "var(--text-muted)" }}
              >
                <Icon active={active} />
                <span
                  className="font-medium"
                  style={{ fontSize: "0.68rem", letterSpacing: "0.01em" }}
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
