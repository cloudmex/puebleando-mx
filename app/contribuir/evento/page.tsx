import { getPlaces, getEvents } from "@/lib/queries";
import ContribuirEventoClientWrapper from "./ContribuirEventoClientWrapper";

export const metadata = { title: "Publicar evento – Puebleando" };

export default async function ContribuirEventoPage() {
  const [places, events] = await Promise.all([getPlaces(), getEvents()]);
  return (
    <main style={{ width: "100%", height: "100dvh", overflow: "hidden" }}>
       <ContribuirEventoClientWrapper places={places} events={events} />
    </main>
  );
}
