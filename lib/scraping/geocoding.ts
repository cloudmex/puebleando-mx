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

    let coords: [number, number] | null = null;
    let isGenericMatch = false;

    try {
      // 1. Try Mapbox
      const params = new URLSearchParams({
        access_token: this.MAPBOX_TOKEN,
        limit: "1",
        country: "MX",
        proximity: "-102,23", // center of Mexico
      });
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?${params}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const feat = data.features[0];
          coords = [feat.center[1], feat.center[0]];
          
          // Check if Mapbox fell back heavily (e.g. didn't find the POI, just returning the whole city "place" or "region")
          if (feat.place_type && (feat.place_type.includes("place") || feat.place_type.includes("region") || feat.place_type.includes("country"))) {
            isGenericMatch = true;
          }
        }
      }
    } catch (err) {
      console.error("Mapbox geocode error:", err);
    }

    // 2. Fallback to OpenStreetMap (Nominatim) if Mapbox missed or fell back to a generic Region/City
    if (!coords || isGenericMatch) {
      try {
        const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
        const osmRes = await fetch(osmUrl, {
          headers: { "User-Agent": "puebleando-mx-geocoder/1.0" }
        });
        if (osmRes.ok) {
          const osmData = await osmRes.json();
          if (osmData && osmData.length > 0) {
            // OSM found a good specific match, override Mapbox's fallback
            coords = [parseFloat(osmData[0].lat), parseFloat(osmData[0].lon)];
          }
        }
      } catch (err) {
        console.error("OSM Geocoding error:", err);
      }
    }

    geocodeCache.set(cacheKey, coords);
    return coords;
  }
  /**
   * Geocodes the main plaza/zócalo of a Mexican town or city.
   * Used as last-resort fallback when venue-specific geocoding fails.
   * Returns the plaza center coords, or falls back to city center if no plaza found.
   */
  static async geocodePlaza(city: string, state?: string): Promise<[number, number] | null> {
    // Try the zócalo first, then plaza principal, then generic city center
    const queries = [
      `zócalo ${city}${state ? `, ${state}` : ''}, México`,
      `plaza principal ${city}${state ? `, ${state}` : ''}, México`,
      `${city}${state ? `, ${state}` : ''}, México`,
    ];

    for (const query of queries) {
      const coords = await this.geocode(query);
      if (coords) return coords;
    }
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
