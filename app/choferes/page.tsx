import { Suspense } from "react";
import ChoferesClient from "./ChoferesClient";

export const metadata = {
  title: "Choferes — Puebleando Guadalajara",
  description: "Encuentra tu chofer personal para pueblear por Guadalajara y alrededores",
};

export default function ChoferesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: "var(--topbar-h)" }}>
        <p className="label-sm" style={{ color: "var(--text-muted)" }}>Cargando...</p>
      </div>
    }>
      <ChoferesClient />
    </Suspense>
  );
}
