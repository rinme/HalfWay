"use client";

import { useState, useEffect, useCallback } from "react";
import { AppSettings, LocationPoint, MapProvider, Person, SearchState } from "@/types";
import { ScoredBranch, LatLng } from "@/lib/geo";

export const PERSON_COLORS = [
  "#10b981", // Emerald
  "#8b5cf6", // Violet
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#3b82f6", // Blue
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f97316", // Orange
];

export function useSearchState() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const envKey =
      (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) || "";
    return {
      googleMapsApiKey: "",
      activeProvider: envKey ? "google" : "osm",
    };
  });

  const [state, setState] = useState<SearchState>({
    persons: [
      { id: "person-1", name: "Person 1", address: "", lat: 0, lng: 0, color: PERSON_COLORS[0] },
      { id: "person-2", name: "Person 2", address: "", lat: 0, lng: 0, color: PERSON_COLORS[1] },
    ],
    activePinPersonId: null,
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
      const savedProvider = localStorage.getItem("halfway_active_provider") as MapProvider | null;
      const envKey =
        (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) || "";

      let activeProvider: MapProvider = "osm";
      if (savedProvider) {
        if (savedProvider === "google" && (savedKey || envKey)) {
          activeProvider = "google";
        } else {
          activeProvider = "osm";
        }
      } else {
        if (savedKey || envKey) {
          activeProvider = "google";
        } else {
          activeProvider = "osm";
        }
      }

      setSettings({
        googleMapsApiKey: savedKey,
        activeProvider,
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

  const addPerson = useCallback(() => {
    setState((prev) => {
      if (prev.persons.length >= 8) return prev;
      const nextIdx = prev.persons.length + 1;
      const newPerson: Person = {
        id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `Person ${nextIdx}`,
        address: "",
        lat: 0,
        lng: 0,
        color: PERSON_COLORS[(nextIdx - 1) % PERSON_COLORS.length],
      };
      return {
        ...prev,
        persons: [...prev.persons, newPerson],
      };
    });
  }, []);

  const removePerson = useCallback((id: string) => {
    setState((prev) => {
      if (prev.persons.length <= 2) return prev;
      const updatedPersons = prev.persons.filter((p) => p.id !== id);
      const updatedActivePinId = prev.activePinPersonId === id ? null : prev.activePinPersonId;
      const p0 = updatedPersons[0];
      const p1 = updatedPersons[1];
      return {
        ...prev,
        persons: updatedPersons,
        activePinPersonId: updatedActivePinId,
        pointA: p0 && p0.address ? { address: p0.address, lat: p0.lat, lng: p0.lng } : prev.pointA,
        pointB: p1 && p1.address ? { address: p1.address, lat: p1.lat, lng: p1.lng } : prev.pointB,
        activePinMode:
          updatedActivePinId === p0?.id ? "A" : updatedActivePinId === p1?.id ? "B" : null,
      };
    });
  }, []);

  const renamePerson = useCallback((id: string, newName: string) => {
    setState((prev) => ({
      ...prev,
      persons: prev.persons.map((p) => (p.id === id ? { ...p, name: newName } : p)),
    }));
  }, []);

  const updatePersonLocation = useCallback(
    (id: string, loc: { address: string; lat: number; lng: number }) => {
      setState((prev) => {
        const updatedPersons = prev.persons.map((p) =>
          p.id === id ? { ...p, address: loc.address, lat: loc.lat, lng: loc.lng } : p
        );
        let pointA = prev.pointA;
        let pointB = prev.pointB;
        if (updatedPersons[0]?.id === id) {
          pointA = { address: loc.address, lat: loc.lat, lng: loc.lng };
        } else if (updatedPersons[1]?.id === id) {
          pointB = { address: loc.address, lat: loc.lat, lng: loc.lng };
        }
        return {
          ...prev,
          persons: updatedPersons,
          pointA,
          pointB,
        };
      });
    },
    []
  );

  const setActivePinPersonId = useCallback((id: string | null) => {
    setState((prev) => {
      let activePinMode: "A" | "B" | null = null;
      if (id && prev.persons[0]?.id === id) {
        activePinMode = "A";
      } else if (id && prev.persons[1]?.id === id) {
        activePinMode = "B";
      }
      return {
        ...prev,
        activePinPersonId: id,
        activePinMode,
      };
    });
  }, []);

  const setPointA = useCallback((point: LocationPoint | null) => {
    setState((prev) => {
      const updatedPersons = [...prev.persons];
      if (updatedPersons[0]) {
        updatedPersons[0] = {
          ...updatedPersons[0],
          address: point ? point.address : "",
          lat: point ? point.lat : 0,
          lng: point ? point.lng : 0,
        };
      }
      return {
        ...prev,
        pointA: point,
        persons: updatedPersons,
      };
    });
  }, []);

  const setPointB = useCallback((point: LocationPoint | null) => {
    setState((prev) => {
      const updatedPersons = [...prev.persons];
      if (updatedPersons[1]) {
        updatedPersons[1] = {
          ...updatedPersons[1],
          address: point ? point.address : "",
          lat: point ? point.lat : 0,
          lng: point ? point.lng : 0,
        };
      }
      return {
        ...prev,
        pointB: point,
        persons: updatedPersons,
      };
    });
  }, []);

  const setQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, query }));
  }, []);

  const setActivePinMode = useCallback((mode: "A" | "B" | null) => {
    setState((prev) => ({
      ...prev,
      activePinMode: mode,
      activePinPersonId:
        mode === "A" ? prev.persons[0]?.id ?? null : mode === "B" ? prev.persons[1]?.id ?? null : null,
    }));
  }, []);

  const setHighlightedBranchId = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, highlightedBranchId: id }));
  }, []);

  const swapPoints = useCallback(() => {
    setState((prev) => {
      const updatedPersons = [...prev.persons];
      if (updatedPersons.length >= 2) {
        const tempAddr = updatedPersons[0].address;
        const tempLat = updatedPersons[0].lat;
        const tempLng = updatedPersons[0].lng;
        updatedPersons[0] = {
          ...updatedPersons[0],
          address: updatedPersons[1].address,
          lat: updatedPersons[1].lat,
          lng: updatedPersons[1].lng,
        };
        updatedPersons[1] = {
          ...updatedPersons[1],
          address: tempAddr,
          lat: tempLat,
          lng: tempLng,
        };
      }
      return {
        ...prev,
        pointA: prev.pointB,
        pointB: prev.pointA,
        persons: updatedPersons,
      };
    });
  }, []);

  const executeSearch = useCallback(async () => {
    const hasValidLegacy = state.pointA && state.pointB;
    const hasValidPersons =
      state.persons.length >= 2 &&
      state.persons.every((p) => p.address && (p.lat !== 0 || p.lng !== 0));

    if (!state.query.trim() || (!hasValidLegacy && !hasValidPersons)) {
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
          persons: state.persons.map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address,
            lat: p.lat,
            lng: p.lng,
            color: p.color,
          })),
          pointA: state.pointA
            ? { lat: state.pointA.lat, lng: state.pointA.lng }
            : state.persons[0] && (state.persons[0].lat !== 0 || state.persons[0].lng !== 0)
            ? { lat: state.persons[0].lat, lng: state.persons[0].lng }
            : undefined,
          pointB: state.pointB
            ? { lat: state.pointB.lat, lng: state.pointB.lng }
            : state.persons[1] && (state.persons[1].lat !== 0 || state.persons[1].lng !== 0)
            ? { lat: state.persons[1].lat, lng: state.persons[1].lng }
            : undefined,
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
        activePinPersonId: null,
      }));

      // Update URL query params
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (state.persons[0] && (state.persons[0].lat !== 0 || state.persons[0].lng !== 0)) {
          params.set("a_lat", state.persons[0].lat.toString());
          params.set("a_lng", state.persons[0].lng.toString());
          params.set("a_name", state.persons[0].address);
        }
        if (state.persons[1] && (state.persons[1].lat !== 0 || state.persons[1].lng !== 0)) {
          params.set("b_lat", state.persons[1].lat.toString());
          params.set("b_lng", state.persons[1].lng.toString());
          params.set("b_name", state.persons[1].address);
        }
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
  }, [state.pointA, state.pointB, state.persons, state.query, settings]);

  // Read URL query params on initial mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const shareCode = params.get("s");

    if (shareCode) {
      fetch(`/api/share?code=${encodeURIComponent(shareCode)}`)
        .then((res) => res.json())
        .then(
          (data: {
            success?: boolean;
            data?: {
              query?: string;
              persons?: Person[];
            };
          }) => {
            if (data.success && data.data) {
              const sharedPersons = data.data.persons;
              const sharedQuery = data.data.query;
              setState((prev) => {
                let updatedPersons = prev.persons;
                let pointA = prev.pointA;
                let pointB = prev.pointB;
                if (Array.isArray(sharedPersons) && sharedPersons.length >= 2) {
                  updatedPersons = sharedPersons;
                  pointA = {
                    address: sharedPersons[0].address,
                    lat: sharedPersons[0].lat,
                    lng: sharedPersons[0].lng,
                  };
                  pointB = {
                    address: sharedPersons[1].address,
                    lat: sharedPersons[1].lat,
                    lng: sharedPersons[1].lng,
                  };
                }
                return {
                  ...prev,
                  persons: updatedPersons,
                  pointA,
                  pointB,
                  query: sharedQuery || prev.query,
                };
              });
            }
          }
        )
        .catch(() => {});
      return;
    }

    const aLat = params.get("a_lat");
    const aLng = params.get("a_lng");
    const aName = params.get("a_name");
    const bLat = params.get("b_lat");
    const bLng = params.get("b_lng");
    const bName = params.get("b_name");
    const q = params.get("q");

    if (aLat && aLng) {
      const parsedLat = parseFloat(aLat);
      const parsedLng = parseFloat(aLng);
      if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)) {
        setPointA({
          lat: parsedLat,
          lng: parsedLng,
          address: aName || `${aLat}, ${aLng}`,
        });
      }
    }
    if (bLat && bLng) {
      const parsedLat = parseFloat(bLat);
      const parsedLng = parseFloat(bLng);
      if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)) {
        setPointB({
          lat: parsedLat,
          lng: parsedLng,
          address: bName || `${bLat}, ${bLng}`,
        });
      }
    }
    if (q) {
      setQuery(q);
    }
  }, [setPointA, setPointB, setQuery]);

  return {
    state,
    settings,
    saveSettings,
    addPerson,
    removePerson,
    renamePerson,
    updatePersonLocation,
    setActivePinPersonId,
    setPointA,
    setPointB,
    setQuery,
    setActivePinMode,
    setHighlightedBranchId,
    swapPoints,
    executeSearch,
  };
}
