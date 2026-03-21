import PlanInput from "./planear/PlanInput";

export const metadata = {
  title: "Puebleando — Planea tu fin de semana en México",
  description: "Escribe una ciudad y te armamos el itinerario perfecto con los mejores lugares y eventos.",
};

export default function HomePage() {
  return <PlanInput />;
}
