"use client";

import { useState, useEffect, useCallback } from "react";
import { AppSettings, LocationPoint, MapProvider, SearchState } from "@/types";
import { ScoredBranch, LatLng } from "@/lib/geo";

export function useSearchState() {
  const [settings, setSettings] = useState<AppSettings>({
    googleMapsApiKey: "",
    activeProvider: "osm",
  });

  const [state, setState] = useState<SearchState>({
    pointA: null,
    pointB: null,
    query: "Starbucks",
    activePinMode: null,
    branches: [],
    midpoint: null,
    totalDistanceAB: null,
    isLoading: false,
    error: null,
    highlightedBranchId: null,
  });

  // Load settings from localStorage
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem("halfway_google_maps_key") || "";
      const savedProvider = (localStorage.getItem("halfway_active_provider") as MapProvider | null) || "osm";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettings({
        googleMapsApiKey: savedKey,
        activeProvider: savedKey && savedProvider === "google" ? "google" : "osm",
      });
    } catch {}
  }, []);

  const saveSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem("halfway_google_maps_key", newSettings.googleMapsApiKey);
      localStorage.setItem("halfway_active_provider", newSettings.activeProvider);
    } catch {}
  }, []);

  const setPointA = useCallback((point: LocationPoint | null) => {
    setState((prev) => ({ ...prev, pointA: point }));
  }, []);

  const setPointB = useCallback((point: LocationPoint | null) => {
    setState((prev) => ({ ...prev, pointB: point }));
  }, []);

  const setQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, query }));
  }, []);

  const setActivePinMode = useCallback((mode: "A" | "B" | null) => {
    setState((prev) => ({ ...prev, activePinMode: mode }));
  }, []);

  const setHighlightedBranchId = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, highlightedBranchId: id }));
  }, []);

  const swapPoints = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pointA: prev.pointB,
      pointB: prev.pointA,
    }));
  }, []);

  const executeSearch = useCallback(async () => {
    if (!state.pointA || !state.pointB || !state.query.trim()) {
      setState((prev) => ({
        ...prev,
        error: "Please provide Point A, Point B, and a target venue/brand name.",
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const res = await fetch("/api/search-midpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointA: { lat: state.pointA.lat, lng: state.pointA.lng },
          pointB: { lat: state.pointB.lat, lng: state.pointB.lng },
          query: state.query.trim(),
          apiKey: settings.googleMapsApiKey || undefined,
          preferredProvider: settings.activeProvider,
        }),
      });

      const data: {
        success?: boolean;
        error?: string;
        branches?: ScoredBranch[];
        midpoint?: LatLng;
        totalDistanceAB?: number;
      } = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to search for midpoint branches");
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        branches: data.branches || [],
        midpoint: data.midpoint || null,
        totalDistanceAB: data.totalDistanceAB ?? null,
        activePinMode: null,
      }));

      // Update URL query params
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        params.set("a_lat", state.pointA.lat.toString());
        params.set("a_lng", state.pointA.lng.toString());
        params.set("a_name", state.pointA.address);
        params.set("b_lat", state.pointB.lat.toString());
        params.set("b_lng", state.pointB.lng.toString());
        params.set("b_name", state.pointB.address);
        params.set("q", state.query.trim());
        window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred while finding branches.";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [state.pointA, state.pointB, state.query, settings]);

  // Read URL query params on initial mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const aLat = params.get("a_lat");
    const aLng = params.get("a_lng");
    const aName = params.get("a_name");
    const bLat = params.get("b_lat");
    const bLng = params.get("b_lng");
    const bName = params.get("b_name");
    const q = params.get("q");

    if (aLat && aLng) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPointA({
        lat: parseFloat(aLat),
        lng: parseFloat(aLng),
        address: aName || `${aLat}, ${aLng}`,
      });
    }
    if (bLat && bLng) {
      setPointB({
        lat: parseFloat(bLat),
        lng: parseFloat(bLng),
        address: bName || `${bLat}, ${bLng}`,
      });
    }
    if (q) {
      setQuery(q);
    }
  }, [setPointA, setPointB, setQuery]);

  return {
    state,
    settings,
    saveSettings,
    setPointA,
    setPointB,
    setQuery,
    setActivePinMode,
    setHighlightedBranchId,
    swapPoints,
    executeSearch,
  };
}
