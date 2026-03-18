import { getPlaces, getEvents } from "@/lib/queries";
import ExplorarClient from "./ExplorarClient";

export default async function ExplorarPage() {
  const [places, events] = await Promise.all([getPlaces(), getEvents()]);
  return <ExplorarClient places={places} events={events} />;
}
