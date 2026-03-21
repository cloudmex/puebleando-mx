export const dynamic = "force-dynamic";
import { getPlaces, getEvents } from "@/lib/queries";
import HomeClient from "@/app/HomeClient";

export default async function MapaPage() {
  const [places, events] = await Promise.all([getPlaces(), getEvents()]);
  return <HomeClient places={places} events={events} />;
}
