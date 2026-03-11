export const dynamic = "force-dynamic";
import { getPlaces, getEvents } from "@/lib/queries";
import HomeClient from "./HomeClient";

export default async function HomePage() {
  const [places, events] = await Promise.all([getPlaces(), getEvents()]);
  return <HomeClient places={places} events={events} />;
}
