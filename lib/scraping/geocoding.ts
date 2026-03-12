/**
 * Geocoding Service
 * Converts addresses to latitude/longitude using Mapbox Geocoding API
 */

export class GeocodingService {
  private static MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  /**
   * Geocodes an address string to [latitude, longitude]
   */
  static async geocode(address: string): Promise<[number, number] | null> {
    if (!this.MAPBOX_TOKEN || !address) return null;

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${this.MAPBOX_TOKEN}&limit=1`;
      const response = await fetch(url);
      
      if (!response.ok) return null;

      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        return [lat, lng];
      }
    } catch (err) {
      console.error("Geocoding error:", err);
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
