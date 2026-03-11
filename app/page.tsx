import { getPlaces } from "@/lib/queries";
import HomeClient from "./HomeClient";

export default async function HomePage() {
  const places = await getPlaces();
  return <HomeClient places={places} />;
}
