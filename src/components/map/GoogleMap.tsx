"use client";

import React, { useEffect, useRef, useState } from "react";
import { LocationPoint } from "@/types";
import { ScoredBranch, LatLng } from "@/lib/geo";

export interface GoogleMapProps {
  apiKey: string;
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

export function GoogleMap({
  apiKey,
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

    const initialLat = pointA?.lat || 13.7563;
    const initialLng = pointA?.lng || 100.5018;

    const map = new google.maps.Map(mapContainerRef.current, {
      center: { lat: initialLat, lng: initialLng },
      zoom: 12,
    });

    map.addListener("click", (e: any) => {
      if (e.latLng) {
        onMapClickRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
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

    // Marker A
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
        if (e.latLng) {
          onMarkerDragRef.current("A", { lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
      });
    }

    // Marker B
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
        if (e.latLng) {
          onMarkerDragRef.current("B", { lat: e.latLng.lat(), lng: e.latLng.lng() });
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

      const infoWindow = new google.maps.InfoWindow({
        content:
          `<strong>#${idx + 1} ${b.name}</strong><br/>${b.address}<br/><br/>` +
          `To A: ${b.distA} km | To B: ${b.distB} km<br/>` +
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
  }, [isLoaded, pointA, pointB, midpoint, branches, highlightedBranchId]);

  return (
    <div
      ref={mapContainerRef}
      className={`w-full h-full relative z-0 ${
        activePinMode ? "cursor-crosshair" : ""
      }`}
    />
  );
}
