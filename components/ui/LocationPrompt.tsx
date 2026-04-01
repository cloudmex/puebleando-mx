"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "puebleando_location_dismissed";

/**
 * One-time prompt asking the user to share their location.
 * Dismissed permanently via localStorage once the user acts.
 */
export default function LocationPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed or if API unavailable
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (!("geolocation" in navigator)) return;

    // Check current permission state (if API available)
    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") {
          // Already granted, no need to prompt
          localStorage.setItem(STORAGE_KEY, "granted");
        } else if (result.state === "prompt") {
          // Show after a short delay so the app feels loaded first
          setTimeout(() => setVisible(true), 1500);
        }
        // "denied" → don't bother asking
      });
    } else {
      // Fallback: just show it
      setTimeout(() => setVisible(true), 1500);
    }
  }, []);

  const handleAllow = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      () => {
        localStorage.setItem(STORAGE_KEY, "granted");
        setVisible(false);
      },
      () => {
        // User denied in the browser prompt
        localStorage.setItem(STORAGE_KEY, "denied");
        setVisible(false);
      }
    );
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "dismissed");
    setVisible(false);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          style={{
            position: "fixed",
            bottom: "calc(var(--bottomnav-h, 60px) + 16px)",
            left: 16,
            right: 16,
            zIndex: 900,
            background: "var(--surface, #fff)",
            borderRadius: "var(--r-lg, 16px)",
            boxShadow: "var(--shadow-sheet, 0 -2px 24px rgba(0,0,0,.12))",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Icon + text */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span
              style={{
                fontSize: 32,
                lineHeight: 1,
                flexShrink: 0,
              }}
              aria-hidden
            >
              📍
            </span>
            <div>
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: 15,
                  color: "var(--text, #1A1410)",
                }}
              >
                Descubre lugares cerca de ti
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "var(--text-secondary, #5C5248)",
                  lineHeight: 1.4,
                }}
              >
                Activa tu ubicación para ver experiencias, rutas y pueblos
                cercanos.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={handleDismiss}
              style={{
                background: "none",
                border: "none",
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 500,
                color: "var(--text-muted, #9B9088)",
                cursor: "pointer",
                borderRadius: "var(--r-md, 12px)",
              }}
            >
              Ahora no
            </button>
            <button
              onClick={handleAllow}
              style={{
                background: "var(--primary, #9c3d2a)",
                color: "#fff",
                border: "none",
                padding: "8px 20px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: "var(--r-md, 12px)",
                cursor: "pointer",
              }}
            >
              Activar ubicación
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
