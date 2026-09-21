import { SimpleLRUCache } from "./cache";

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

export const geocodeCache = new SimpleLRUCache<GeocodeResult[]>(200, 30 * 60 * 1000);
export const reverseCache = new SimpleLRUCache<string>(200, 30 * 60 * 1000);

export async function geocodeAddress(
  query: string,
  provider: "osm" | "google" = "osm",
  apiKey?: string
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `${provider}:${apiKey ? "key:" : "nokey:"}${trimmed.toLowerCase()}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  if (provider === "google" && apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        trimmed
      )}&key=${apiKey}`;
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (data.status === "OK" && Array.isArray(data.results)) {
        const parsed: GeocodeResult[] = data.results.slice(0, 5).map((item: any) => ({
          label: item.formatted_address,
          lat: item.geometry.location.lat,
          lng: item.geometry.location.lng,
        }));
        geocodeCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch {
      // Fallback to OSM
    }
  }

  // Fallback to OpenStreetMap / Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      trimmed
    )}&limit=5&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "HalfwayFinder/1.0 (https://github.com/halfway-finder)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any[];
    const parsed: GeocodeResult[] = data.map((item) => ({
      label: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
    geocodeCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    return [];
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  provider: "osm" | "google" = "osm",
  apiKey?: string
): Promise<string> {
  const cacheKey = `${provider}:${apiKey ? "key:" : "nokey:"}${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = reverseCache.get(cacheKey);
  if (cached) return cached;

  if (provider === "google" && apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (data.status === "OK" && data.results?.[0]) {
        const addr = data.results[0].formatted_address;
        reverseCache.set(cacheKey, addr);
        return addr;
      }
    } catch {
      // Fallback to OSM
    }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "HalfwayFinder/1.0 (https://github.com/halfway-finder)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = (await res.json()) as any;
    const addr = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    reverseCache.set(cacheKey, addr);
    return addr;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
