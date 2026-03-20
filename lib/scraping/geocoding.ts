/**
 * Geocoding Service
 * Converts addresses to latitude/longitude using Mapbox Geocoding API
 */

// Module-level cache: address → [lat, lng] | null
// Avoids repeated Mapbox calls for the same city/address within a server session.
const geocodeCache = new Map<string, [number, number] | null>();

export class GeocodingService {
  private static MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  /**
   * Geocodes an address string to [latitude, longitude]
   */
  static async geocode(address: string): Promise<[number, number] | null> {
    if (!this.MAPBOX_TOKEN || !address) return null;

    const cacheKey = address.trim().toLowerCase();
    if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey)!;

    try {
      // country=MX restricts results to Mexico.
      // proximity biases results toward the geographic center of Mexico.
      const params = new URLSearchParams({
        access_token: this.MAPBOX_TOKEN,
        limit: "1",
        country: "MX",
        proximity: "-102,23", // center of Mexico
      });
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?${params}`;
      const response = await fetch(url);

      if (!response.ok) { geocodeCache.set(cacheKey, null); return null; }

      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        const coords: [number, number] = [lat, lng];
        geocodeCache.set(cacheKey, coords);
        return coords;
      }
    } catch (err) {
      console.error("Geocoding error:", err);
    }

    geocodeCache.set(cacheKey, null);
    return null;
  }
  /**
   * Reverse geocodes [lat, lng] to a human-readable location (City, State, Country)
   */
  static async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    if (!this.MAPBOX_TOKEN) return null;

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${this.MAPBOX_TOKEN}&types=place,region&limit=1`;
      const response = await fetch(url);
      
      if (!response.ok) return null;

      const data = await response.json();
      if (data.features && data.features.length > 0) {
        return data.features[0].place_name;
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    }

    return null;
  }
}
