import { BranchCandidate, LatLng } from "./geo";

export const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export async function fetchOverpassVenues(
  midpoint: LatLng,
  query: string,
  radiusMeters: number = 10000
): Promise<BranchCandidate[]> {
  const sanitized = escapeRegex(query.trim());
  if (!sanitized) return [];

  const overpassQuery = `[out:json][timeout:15];
(
  node(around:${radiusMeters},${midpoint.lat},${midpoint.lng})[~"^(name|brand|operator)$"~"${sanitized}",i];
  way(around:${radiusMeters},${midpoint.lat},${midpoint.lng})[~"^(name|brand|operator)$"~"${sanitized}",i];
);
out center tags 30;`;

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(mirror, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "HalfwayFinder/1.0",
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data = (await response.json()) as any;
      if (!data?.elements || !Array.isArray(data.elements)) continue;

      const results: BranchCandidate[] = [];
      for (const el of data.elements) {
        const lat = el.lat || el.center?.lat;
        const lng = el.lon || el.center?.lon;
        if (!lat || !lng) continue;

        const name = el.tags?.name || el.tags?.brand || query;
        const street = el.tags?.["addr:street"] || "";
        const city = el.tags?.["addr:city"] || "";
        const address =
          [street, city].filter(Boolean).join(", ") ||
          `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        results.push({
          id: `osm-${el.type}-${el.id}`,
          name,
          address,
          lat,
          lng,
        });
      }

      return results;
    } catch {
      // Mirror failed or timed out, loop to next mirror
      continue;
    }
  }

  return [];
}
