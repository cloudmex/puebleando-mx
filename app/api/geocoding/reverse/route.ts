import { NextResponse } from "next/server";
import { GeocodingService } from "@/lib/scraping/geocoding";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    const location = await GeocodingService.reverseGeocode(lat, lng);
    return NextResponse.json({ location });
  } catch (err: any) {
    console.error("Reverse Geocoding API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
