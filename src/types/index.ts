import { LatLng, ScoredBranch } from "@/lib/geo";

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
}

export interface Person {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  color?: string;
}

export type MapProvider = "osm" | "google";

export interface AppSettings {
  googleMapsApiKey: string;
  activeProvider: MapProvider;
}

export interface SearchState {
  persons: Person[];
  activePinPersonId: string | null;
  pointA?: LocationPoint | null;
  pointB?: LocationPoint | null;
  activePinMode?: "A" | "B" | null;
  query: string;
  branches: ScoredBranch[];
  midpoint: LatLng | null;
  totalDistanceAB: number | null;
  isLoading: boolean;
  error: string | null;
  highlightedBranchId: string | null;
}
