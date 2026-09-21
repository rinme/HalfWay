"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { LocationPoint } from "@/types";
import { ScoredBranch, LatLng } from "@/lib/geo";

export interface LeafletMapProps {
  pointA: LocationPoint | null;
  pointB: LocationPoint | null;
  midpoint: LatLng | null;
  branches: ScoredBranch[];
  activePinMode: "A" | "B" | null;
  highlightedBranchId: string | null;
  onMapClick: (coord: LatLng) => void;
  onMarkerDrag: (point: "A" | "B", coord: LatLng) => void;
}

export function LeafletMap({
  pointA,
  pointB,
  midpoint,
  branches,
  activePinMode,
  highlightedBranchId,
  onMapClick,
  onMarkerDrag,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const onMarkerDragRef = useRef(onMarkerDrag);
  onMarkerDragRef.current = onMarkerDrag;

  // Initialize map instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Prevent reinitialization error in case container has leftover Leaflet ID
    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    const initialLat = pointA?.lat || 13.7563;
    const initialLng = pointA?.lng || 100.5018;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 12,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    map.on("click", (e: L.LeafletMouseEvent) => {
      onMapClickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Update layers and markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    // Helper to create SVG / div icon
    const createPinIcon = (text: string, bgColor: string, size = 32) => {
      return L.divIcon({
        className: "custom-div-icon",
        html: `<div style="background-color: ${bgColor}; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: ${
          size > 28 ? 12 : 10
        }px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer;">${text}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    };

    // Marker A
    if (pointA) {
      bounds.push([pointA.lat, pointA.lng]);
      const markerA = L.marker([pointA.lat, pointA.lng], {
        icon: createPinIcon("A", "#10b981", 34),
        draggable: true,
      }).addTo(layerGroup);

      markerA.bindPopup(`<strong>Point A</strong><br/>${pointA.address}`);
      markerA.on("dragend", (e: any) => {
        const pos = e.target.getLatLng();
        onMarkerDragRef.current("A", { lat: pos.lat, lng: pos.lng });
      });
    }

    // Marker B
    if (pointB) {
      bounds.push([pointB.lat, pointB.lng]);
      const markerB = L.marker([pointB.lat, pointB.lng], {
        icon: createPinIcon("B", "#8b5cf6", 34),
        draggable: true,
      }).addTo(layerGroup);

      markerB.bindPopup(`<strong>Point B</strong><br/>${pointB.address}`);
      markerB.on("dragend", (e: any) => {
        const pos = e.target.getLatLng();
        onMarkerDragRef.current("B", { lat: pos.lat, lng: pos.lng });
      });
    }

    // Line and Midpoint
    if (pointA && pointB) {
      L.polyline(
        [
          [pointA.lat, pointA.lng],
          [pointB.lat, pointB.lng],
        ],
        { color: "#6366f1", weight: 3, dashArray: "6, 6", opacity: 0.7 }
      ).addTo(layerGroup);
    }

    if (midpoint) {
      bounds.push([midpoint.lat, midpoint.lng]);
      const midMarker = L.marker([midpoint.lat, midpoint.lng], {
        icon: createPinIcon("🎯", "#f43f5e", 28),
      }).addTo(layerGroup);
      midMarker.bindPopup("<strong>Fair Midpoint</strong>");

      // 3km inner circle, 10km outer circle
      L.circle([midpoint.lat, midpoint.lng], {
        radius: 3000,
        color: "#6366f1",
        fillColor: "#6366f1",
        fillOpacity: 0.05,
        weight: 1,
        dashArray: "4, 4",
      }).addTo(layerGroup);

      L.circle([midpoint.lat, midpoint.lng], {
        radius: 10000,
        color: "#94a3b8",
        fillColor: "transparent",
        weight: 1,
        dashArray: "4, 4",
      }).addTo(layerGroup);
    }

    // Branches
    branches.forEach((b, idx) => {
      bounds.push([b.lat, b.lng]);
      const isHighlighted = highlightedBranchId === b.id;
      const marker = L.marker([b.lat, b.lng], {
        icon: createPinIcon(
          `${idx + 1}`,
          isHighlighted ? "#4f46e5" : idx === 0 ? "#f59e0b" : "#475569",
          isHighlighted ? 34 : 26
        ),
      }).addTo(layerGroup);

      marker.bindPopup(
        `<strong>#${idx + 1} ${b.name}</strong><br/>${b.address}<br/><br/>` +
          `To A: ${b.distA} km | To B: ${b.distB} km<br/>` +
          `Fairness: <strong>${b.fairnessScore} km</strong><br/><br/>` +
          `<a href="${b.googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="color: #4f46e5; text-decoration: underline;">Open Directions</a>`
      );

      if (isHighlighted) {
        marker.openPopup();
      }
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds as any, { padding: [50, 50], maxZoom: 15 });
    }
  }, [pointA, pointB, midpoint, branches, highlightedBranchId]);

  return (
    <div
      ref={mapContainerRef}
      className={`w-full h-full relative z-0 ${
        activePinMode ? "cursor-crosshair" : ""
      }`}
    />
  );
}
