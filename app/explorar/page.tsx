import { getPlaces } from "@/lib/queries";
import ExplorarClient from "./ExplorarClient";

export default async function ExplorarPage() {
  const places = await getPlaces();
  return <ExplorarClient places={places} />;
}
