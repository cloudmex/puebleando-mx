import { notFound } from "next/navigation";
import { getEvent } from "@/lib/queries";
import EventDetailView from "./EventDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EventoPage({ params }: Props) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) notFound();

  return <EventDetailView event={event} />;
}
