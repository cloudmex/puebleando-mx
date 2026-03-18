"use client";

import dynamic from "next/dynamic";

import { Place } from "@/types";
import { Event } from "@/types/events";

const ContribuirEventoClient = dynamic<Props>(
  () => import("./ContribuirEventoClient"),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-terracota border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium">Cargando mapa interactivo...</p>
        </div>
      </div>
    ),
  }
);

interface Props {
  places: Place[];
  events: Event[];
}

export default function ContribuirEventoClientWrapper({ places, events }: Props) {
  return <ContribuirEventoClient places={places} events={events} />;
}
