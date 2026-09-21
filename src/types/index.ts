import { LatLng, ScoredBranch } from "@/lib/geo";

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
}

export type MapProvider = "osm" | "google";

export interface AppSettings {
  googleMapsApiKey: string;
  activeProvider: MapProvider;
}

export interface SearchState {
  pointA: LocationPoint | null;
  pointB: LocationPoint | null;
  query: string;
  activePinMode: "A" | "B" | null;
  branches: ScoredBranch[];
  midpoint: LatLng | null;
  totalDistanceAB: number | null;
  isLoading: boolean;
  error: string | null;
  highlightedBranchId: string | null;
}
