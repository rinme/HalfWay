import {
  BranchCandidate,
  LatLng,
  PersonCoord,
  ScoredBranch,
  computeCentroid,
  haversineDistance,
  scoreAndRankBranchesMulti,
} from "./geo";
import { fetchOverpassVenues } from "./overpass";

interface GooglePlaceItem {
  place_id: string;
  name: string;
  vicinity?: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface GooglePlacesResponse {
  status: string;
  results?: GooglePlaceItem[];
}

export async function fetchGooglePlaces(
  midpoint: LatLng,
  query: string,
  apiKey: string,
  radiusMeters: number = 10000
): Promise<BranchCandidate[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${midpoint.lat},${midpoint.lng}&radius=${radiusMeters}&keyword=${encodeURIComponent(
      query
    )}&key=${apiKey}`;
    const res = await fetch(url, { signal: controller.signal });
    const data = (await res.json()) as GooglePlacesResponse;
    if (data.status === "OK" && Array.isArray(data.results)) {
      return data.results.slice(0, 30).map((place) => ({
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
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface SearchMidpointParams {
  persons?: PersonCoord[];
  pointA?: LatLng;
  pointB?: LatLng;
  query: string;
  apiKey?: string;
  preferredProvider?: "osm" | "google";
}

export async function searchMidpointVenues(params: SearchMidpointParams): Promise<{
  midpoint: LatLng;
  totalDistanceAB: number;
  radiusUsedKm: number;
  branches: ScoredBranch[];
}> {
  const { query, preferredProvider = "osm" } = params;

  let persons: PersonCoord[] = [];
  if (params.persons && params.persons.length > 0) {
    persons = params.persons;
  } else if (params.pointA && params.pointB) {
    persons = [
      { id: "person-a", name: "Person A", lat: params.pointA.lat, lng: params.pointA.lng },
      { id: "person-b", name: "Person B", lat: params.pointB.lat, lng: params.pointB.lng },
    ];
  }

  const midpoint = computeCentroid(persons);
  const totalDistanceAB =
    persons.length >= 2
      ? haversineDistance(
          { lat: persons[0].lat, lng: persons[0].lng },
          { lat: persons[1].lat, lng: persons[1].lng }
        )
      : 0;

  const resolvedApiKey =
    params.apiKey ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY;

  let candidates: BranchCandidate[] = [];

  if (preferredProvider === "google" && resolvedApiKey) {
    candidates = await fetchGooglePlaces(midpoint, query, resolvedApiKey, 10000);
  }

  if (candidates.length === 0) {
    candidates = await fetchOverpassVenues(midpoint, query, 10000);
  }

  const scored = scoreAndRankBranchesMulti(persons, candidates, 3.0);

  return {
    midpoint,
    totalDistanceAB,
    radiusUsedKm: 10,
    branches: scored,
  };
}

