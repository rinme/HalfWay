"use client";

import React from "react";
import dynamic from "next/dynamic";
import { LocationPoint, MapProvider } from "@/types";
import { ScoredBranch, LatLng } from "@/lib/geo";

const LeafletMap = dynamic(
  () => import("./LeafletMap").then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 animate-pulse flex items-center justify-center text-xs text-zinc-400">
        Loading Map...
      </div>
    ),
  }
);

const GoogleMap = dynamic(
  () => import("./GoogleMap").then((mod) => mod.GoogleMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 animate-pulse flex items-center justify-center text-xs text-zinc-400">
        Loading Google Maps...
      </div>
    ),
  }
);

export interface MapViewProps {
  provider: MapProvider;
  googleMapsApiKey: string;
  pointA: LocationPoint | null;
  pointB: LocationPoint | null;
  midpoint: LatLng | null;
  branches: ScoredBranch[];
  activePinMode: "A" | "B" | null;
  highlightedBranchId: string | null;
  onMapClick: (coord: LatLng) => void;
  onMarkerDrag: (point: "A" | "B", coord: LatLng) => void;
  onFallbackToOsm: () => void;
}

export function MapView(props: MapViewProps) {
  if (props.provider === "google" && props.googleMapsApiKey) {
    return (
      <GoogleMap
        apiKey={props.googleMapsApiKey}
        pointA={props.pointA}
        pointB={props.pointB}
        midpoint={props.midpoint}
        branches={props.branches}
        activePinMode={props.activePinMode}
        highlightedBranchId={props.highlightedBranchId}
        onMapClick={props.onMapClick}
        onMarkerDrag={props.onMarkerDrag}
        onFallbackToOsm={props.onFallbackToOsm}
      />
    );
  }

  return (
    <LeafletMap
      pointA={props.pointA}
      pointB={props.pointB}
      midpoint={props.midpoint}
      branches={props.branches}
      activePinMode={props.activePinMode}
      highlightedBranchId={props.highlightedBranchId}
      onMapClick={props.onMapClick}
      onMarkerDrag={props.onMarkerDrag}
    />
  );
}
