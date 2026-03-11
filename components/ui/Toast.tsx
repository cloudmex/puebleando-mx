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

  const bg = type === "success" ? "var(--jade)" : "var(--rojo)";
  const icon = type === "success" ? "✓" : "✕";

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
            className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg"
            style={{ background: bg, color: "white", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}
          >
            <span
              className="flex items-center justify-center w-5 h-5 rounded-full font-bold text-xs shrink-0"
              style={{ background: "rgba(255,255,255,0.25)" }}
            >
              {icon}
            </span>
            <p className="text-sm font-medium">{message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
