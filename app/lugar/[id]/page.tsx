import { notFound } from "next/navigation";
import { getPlace } from "@/lib/queries";
import LugarDetailView from "./LugarDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LugarPage({ params }: Props) {
  const { id } = await params;
  const place = await getPlace(id);

  if (!place) notFound();

  return <LugarDetailView place={place} />;
}
