"use client";

import React, { useEffect, useRef, useState } from "react";
import { LocationPoint, Person } from "@/types";
import { ScoredBranch, LatLng } from "@/lib/geo";

export interface GoogleMapProps {
  apiKey: string;
  // Multi-person props
  persons?: Person[];
  activePinPersonId?: string | null;
  onPersonMarkerDrag?: (personId: string, coord: LatLng) => void;
  // Backward compatibility props
  pointA?: LocationPoint | null;
  pointB?: LocationPoint | null;
  midpoint: LatLng | null;
  branches: ScoredBranch[];
  activePinMode?: "A" | "B" | null;
  highlightedBranchId: string | null;
  onMapClick: (coord: LatLng) => void;
  onMarkerDrag?: (point: "A" | "B", coord: LatLng) => void;
  onFallbackToOsm: () => void;
}

const DEFAULT_COLORS = [
  "#10b981", // Emerald
  "#8b5cf6", // Violet
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#3b82f6", // Blue
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f97316", // Orange
];

function getPersonLabel(person: Person, idx: number): string {
  if (!person.name || !person.name.trim()) {
    return String(idx + 1);
  }
  const trimmed = person.name.trim();
  const personNumMatch = trimmed.match(/^Person\s*(\d+)$/i);
  if (personNumMatch) {
    return personNumMatch[1];
  }
  if (trimmed.length <= 2) {
    return trimmed.toUpperCase();
  }
  return trimmed.charAt(0).toUpperCase();
}

export function GoogleMap({
  apiKey,
  persons,
  activePinPersonId,
  onPersonMarkerDrag,
  pointA,
  pointB,
  midpoint,
  branches,
  activePinMode,
  highlightedBranchId,
  onMapClick,
  onMarkerDrag,
  onFallbackToOsm,
}: GoogleMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const activeInfoWindowRef = useRef<any>(null);

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const onMarkerDragRef = useRef(onMarkerDrag);
  onMarkerDragRef.current = onMarkerDrag;

  const onPersonMarkerDragRef = useRef(onPersonMarkerDrag);
  onPersonMarkerDragRef.current = onPersonMarkerDrag;

  const onFallbackToOsmRef = useRef(onFallbackToOsm);
  onFallbackToOsmRef.current = onFallbackToOsm;

  // Load Google Maps script with error handling and fallback
  useEffect(() => {
    if (!apiKey) {
      onFallbackToOsmRef.current();
      return;
    }

    if (typeof window === "undefined") return;

    // Check if google maps is already loaded on window
    const google = (window as any).google;
    if (google?.maps) {
      setIsLoaded(true);
      return;
    }

    const scriptId = "google-maps-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    // Handle authentication failure (e.g. invalid API key)
    (window as any).gm_authFailure = () => {
      alert(
        "Google Maps authentication failed (invalid API key). Falling back to OpenStreetMap."
      );
      onFallbackToOsmRef.current();
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        apiKey
      )}&libraries=places`;
      script.async = true;
      script.onload = () => setIsLoaded(true);
      script.onerror = () => {
        alert("Failed to load Google Maps script. Switching back to OpenStreetMap.");
        onFallbackToOsmRef.current();
      };
      document.head.appendChild(script);
    } else {
      if ((window as any).google?.maps) {
        setIsLoaded(true);
      } else {
        const prevOnload = script.onload;
        script.onload = (e) => {
          if (typeof prevOnload === "function") (prevOnload as any)(e);
          setIsLoaded(true);
        };
      }
    }
  }, [apiKey]);

  // Initialize Map
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapInstanceRef.current) return;

    const google = (window as any).google;
    if (!google?.maps) return;

    const firstPerson = persons?.find(
      (p) =>
        typeof p.lat === "number" &&
        typeof p.lng === "number" &&
        (p.lat !== 0 || p.lng !== 0)
    );
    const initialLat = firstPerson?.lat || pointA?.lat || midpoint?.lat || 13.7563;
    const initialLng = firstPerson?.lng || pointA?.lng || midpoint?.lng || 100.5018;

    const map = new google.maps.Map(mapContainerRef.current, {
      center: { lat: initialLat, lng: initialLng },
      zoom: 12,
    });

    map.addListener("click", (e: any) => {
      if (e.latLng) {
        onMapClickRef.current({
          lat: typeof e.latLng.lat === "function" ? e.latLng.lat() : e.latLng.lat,
          lng: typeof e.latLng.lng === "function" ? e.latLng.lng() : e.latLng.lng,
        });
      }
    });

    mapInstanceRef.current = map;

    return () => {
      mapInstanceRef.current = null;
    };
  }, [isLoaded]);

  // Update Markers, Polylines, Circles, InfoWindows
  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;

    // Clear previous InfoWindow and overlays
    if (activeInfoWindowRef.current) {
      activeInfoWindowRef.current.close();
      activeInfoWindowRef.current = null;
    }
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];

    const openInfoWindow = (infoWindow: any, marker: any) => {
      if (activeInfoWindowRef.current) {
        activeInfoWindowRef.current.close();
      }
      infoWindow.open(map, marker);
      activeInfoWindowRef.current = infoWindow;
    };

    const bounds = new google.maps.LatLngBounds();
    let pointCount = 0;

    // Helper to create pin SVG icon
    const createPinSymbol = (color: string) => ({
      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      scale: 1.5,
      anchor: new google.maps.Point(12, 22),
      labelOrigin: new google.maps.Point(12, 9),
    });

    if (persons) {
      // Multi-person mode
      const validPersons = persons.filter(
        (p) =>
          p != null &&
          typeof p.lat === "number" &&
          typeof p.lng === "number" &&
          !isNaN(p.lat) &&
          !isNaN(p.lng) &&
          (p.lat !== 0 || p.lng !== 0)
      );

      validPersons.forEach((person, idx) => {
        const pos = { lat: person.lat, lng: person.lng };
        bounds.extend(pos);
        pointCount++;

        const color = person.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
        const label = getPersonLabel(person, idx);

        const marker = new google.maps.Marker({
          position: pos,
          map,
          draggable: true,
          personId: person.id,
          title: person.name || `Person ${idx + 1}`,
          icon: createPinSymbol(color),
          label: { text: label, color: "#ffffff", fontWeight: "bold", fontSize: "11px" },
        });
        overlaysRef.current.push(marker);

        const info = new google.maps.InfoWindow({
          content: `<strong>${person.name || `Person ${idx + 1}`}</strong><br/>${person.address}`,
        });
        marker.addListener("click", () => openInfoWindow(info, marker));

        marker.addListener("dragend", (e: any) => {
          if (e.latLng && onPersonMarkerDragRef.current) {
            onPersonMarkerDragRef.current(person.id, {
              lat: typeof e.latLng.lat === "function" ? e.latLng.lat() : e.latLng.lat,
              lng: typeof e.latLng.lng === "function" ? e.latLng.lng() : e.latLng.lng,
            });
          }
        });
      });

      // Hub-and-spoke dashed colored polylines from each person to centroid midpoint
      if (midpoint) {
        validPersons.forEach((person, idx) => {
          const color = person.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
          const line = new google.maps.Polyline({
            path: [
              { lat: person.lat, lng: person.lng },
              { lat: midpoint.lat, lng: midpoint.lng },
            ],
            strokeColor: color,
            strokeOpacity: 0.7,
            strokeWeight: 3,
            map,
          });
          overlaysRef.current.push(line);
        });
      }
    } else {
      // Legacy Point A / Point B mode
      if (pointA) {
        const pos = { lat: pointA.lat, lng: pointA.lng };
        bounds.extend(pos);
        pointCount++;

        const markerA = new google.maps.Marker({
          position: pos,
          map,
          draggable: true,
          title: "Point A",
          icon: createPinSymbol("#10b981"),
          label: { text: "A", color: "#ffffff", fontWeight: "bold", fontSize: "11px" },
        });
        overlaysRef.current.push(markerA);

        const infoA = new google.maps.InfoWindow({
          content: `<strong>Point A</strong><br/>${pointA.address}`,
        });
        markerA.addListener("click", () => openInfoWindow(infoA, markerA));

        markerA.addListener("dragend", (e: any) => {
          if (e.latLng && onMarkerDragRef.current) {
            onMarkerDragRef.current("A", {
              lat: typeof e.latLng.lat === "function" ? e.latLng.lat() : e.latLng.lat,
              lng: typeof e.latLng.lng === "function" ? e.latLng.lng() : e.latLng.lng,
            });
          }
        });
      }

      if (pointB) {
        const pos = { lat: pointB.lat, lng: pointB.lng };
        bounds.extend(pos);
        pointCount++;

        const markerB = new google.maps.Marker({
          position: pos,
          map,
          draggable: true,
          title: "Point B",
          icon: createPinSymbol("#8b5cf6"),
          label: { text: "B", color: "#ffffff", fontWeight: "bold", fontSize: "11px" },
        });
        overlaysRef.current.push(markerB);

        const infoB = new google.maps.InfoWindow({
          content: `<strong>Point B</strong><br/>${pointB.address}`,
        });
        markerB.addListener("click", () => openInfoWindow(infoB, markerB));

        markerB.addListener("dragend", (e: any) => {
          if (e.latLng && onMarkerDragRef.current) {
            onMarkerDragRef.current("B", {
              lat: typeof e.latLng.lat === "function" ? e.latLng.lat() : e.latLng.lat,
              lng: typeof e.latLng.lng === "function" ? e.latLng.lng() : e.latLng.lng,
            });
          }
        });
      }

      // Polyline connecting A and B
      if (pointA && pointB) {
        const line = new google.maps.Polyline({
          path: [
            { lat: pointA.lat, lng: pointA.lng },
            { lat: pointB.lat, lng: pointB.lng },
          ],
          strokeColor: "#6366f1",
          strokeOpacity: 0.7,
          strokeWeight: 3,
          map,
        });
        overlaysRef.current.push(line);
      }
    }

    // Midpoint and radius circles
    if (midpoint) {
      const pos = { lat: midpoint.lat, lng: midpoint.lng };
      bounds.extend(pos);
      pointCount++;

      const midMarker = new google.maps.Marker({
        position: pos,
        map,
        title: "Fair Midpoint",
        icon: createPinSymbol("#f43f5e"),
        label: { text: "🎯", color: "#ffffff", fontSize: "10px" },
      });
      overlaysRef.current.push(midMarker);

      const midInfo = new google.maps.InfoWindow({
        content: "<strong>Fair Midpoint</strong>",
      });
      midMarker.addListener("click", () => openInfoWindow(midInfo, midMarker));

      // 3km inner circle
      const innerCircle = new google.maps.Circle({
        center: pos,
        radius: 3000,
        strokeColor: "#6366f1",
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: "#6366f1",
        fillOpacity: 0.05,
        map,
      });
      overlaysRef.current.push(innerCircle);

      // 10km outer circle
      const outerCircle = new google.maps.Circle({
        center: pos,
        radius: 10000,
        strokeColor: "#94a3b8",
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: "#000000",
        fillOpacity: 0,
        map,
      });
      overlaysRef.current.push(outerCircle);
    }

    // Branches
    branches.forEach((b, idx) => {
      const pos = { lat: b.lat, lng: b.lng };
      bounds.extend(pos);
      pointCount++;

      const isHighlighted = highlightedBranchId === b.id;
      const markerColor = isHighlighted ? "#4f46e5" : idx === 0 ? "#f59e0b" : "#475569";

      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: `#${idx + 1} ${b.name}`,
        icon: createPinSymbol(markerColor),
        label: { text: `${idx + 1}`, color: "#ffffff", fontWeight: "bold", fontSize: "11px" },
      });
      overlaysRef.current.push(marker);

      const distanceBreakdown =
        b.distances && b.distances.length > 0
          ? b.distances.map((d) => `${d.name}: ${d.distance} km`).join(" | ")
          : `To A: ${b.distA ?? 0} km | To B: ${b.distB ?? 0} km`;

      const infoWindow = new google.maps.InfoWindow({
        content:
          `<strong>#${idx + 1} ${b.name}</strong><br/>${b.address}<br/><br/>` +
          `${distanceBreakdown}<br/>` +
          `Fairness: <strong>${b.fairnessScore} km</strong><br/><br/>` +
          `<a href="${b.googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="color: #4f46e5; text-decoration: underline;">Open Directions</a>`,
      });

      marker.addListener("click", () => openInfoWindow(infoWindow, marker));

      if (isHighlighted) {
        openInfoWindow(infoWindow, marker);
      }
    });

    if (pointCount === 1) {
      map.fitBounds(bounds);
      if (google?.maps?.event?.addListenerOnce) {
        google.maps.event.addListenerOnce(map, "idle", () => {
          if (typeof map.getZoom === "function" && map.getZoom() > 15) {
            map.setZoom(15);
          }
        });
      } else if (typeof map.addListener === "function") {
        const listener = map.addListener("idle", () => {
          if (typeof map.getZoom === "function" && map.getZoom() > 15) {
            map.setZoom(15);
          }
          if (listener && typeof listener.remove === "function") {
            listener.remove();
          }
        });
      }
    } else if (pointCount > 1) {
      map.fitBounds(bounds);
    }

    return () => {
      if (activeInfoWindowRef.current) {
        activeInfoWindowRef.current.close();
        activeInfoWindowRef.current = null;
      }
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
    };
  }, [isLoaded, persons, pointA, pointB, midpoint, branches, highlightedBranchId]);

  return (
    <div
      ref={mapContainerRef}
      className={`w-full h-full relative z-0 ${
        activePinMode || activePinPersonId ? "cursor-crosshair" : ""
      }`}
    />
  );
}
