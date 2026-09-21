import {
  BranchCandidate,
  LatLng,
  ScoredBranch,
  computeMidpoint,
  haversineDistance,
  scoreAndRankBranches,
} from "./geo";
import { fetchOverpassVenues } from "./overpass";

export async function fetchGooglePlaces(
  midpoint: LatLng,
  query: string,
  apiKey: string,
  radiusMeters: number = 10000
): Promise<BranchCandidate[]> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${midpoint.lat},${midpoint.lng}&radius=${radiusMeters}&keyword=${encodeURIComponent(
      query
    )}&key=${apiKey}`;
    const res = await fetch(url);
    const data = (await res.json()) as any;
    if (data.status === "OK" && Array.isArray(data.results)) {
      return data.results.slice(0, 30).map((place: any) => ({
        id: `google-${place.place_id}`,
        name: place.name,
        address: place.vicinity || place.name,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function searchMidpointVenues(params: {
  pointA: LatLng;
  pointB: LatLng;
  query: string;
  apiKey?: string;
  preferredProvider?: "osm" | "google";
}): Promise<{
  midpoint: LatLng;
  totalDistanceAB: number;
  radiusUsedKm: number;
  branches: ScoredBranch[];
}> {
  const { pointA, pointB, query, apiKey, preferredProvider = "osm" } = params;
  const midpoint = computeMidpoint(pointA, pointB);
  const totalDistanceAB = haversineDistance(pointA, pointB);

  let candidates: BranchCandidate[] = [];

  if (preferredProvider === "google" && apiKey) {
    candidates = await fetchGooglePlaces(midpoint, query, apiKey, 10000);
  }

  if (candidates.length === 0) {
    candidates = await fetchOverpassVenues(midpoint, query, 10000);
  }

  const scored = scoreAndRankBranches(pointA, pointB, candidates, 3.0);

  return {
    midpoint,
    totalDistanceAB,
    radiusUsedKm: 10,
    branches: scored,
  };
}
