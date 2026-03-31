"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ToastProps {
  message: string;
  show: boolean;
  onHide: () => void;
  type?: "success" | "error";
}

export default function Toast({ message, show, onHide, type = "success" }: ToastProps) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onHide, 2600);
    return () => clearTimeout(t);
  }, [show, onHide]);

  const isSuccess = type === "success";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 24, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 16, opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed z-[60] left-4 right-4 mx-auto"
          style={{
            bottom: "calc(var(--bottomnav-h) + 12px)",
            maxWidth: 380,
          }}
        >
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
            style={{
              background: isSuccess
                ? "linear-gradient(135deg, var(--secondary), #2a8a70)"
                : "var(--error)",
              color: "white",
              boxShadow: isSuccess
                ? "0 8px 24px rgba(26,92,82,0.25)"
                : "0 8px 24px rgba(176,58,46,0.25)",
            }}
          >
            <span
              className="flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs shrink-0"
              style={{ background: "rgba(255,255,255,0.20)" }}
            >
              {isSuccess ? "✓" : "✕"}
            </span>
            <p className="text-sm font-medium">{message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
