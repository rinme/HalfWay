"use client";

import React, { useState } from "react";
import { Header } from "@/components/Header";
import { SearchForm } from "@/components/SearchForm";
import { ResultsList } from "@/components/ResultsList";
import { MapView } from "@/components/map/MapView";
import { SettingsModal } from "@/components/SettingsModal";
import { useSearchState } from "@/hooks/useSearchState";
import { LatLng } from "@/lib/geo";

export default function HalfwayFinderPage() {
  const {
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
  } = useSearchState();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleMapClick = async (coord: LatLng) => {
    if (state.activePinMode === "A") {
      try {
        const res = await fetch(`/api/reverse-geocode?lat=${coord.lat}&lng=${coord.lng}`);
        const data = await res.json();
        setPointA({ lat: coord.lat, lng: coord.lng, address: data.address || `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}` });
      } catch {
        setPointA({ lat: coord.lat, lng: coord.lng, address: `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}` });
      }
      setActivePinMode(state.pointB ? null : "B");
    } else if (state.activePinMode === "B") {
      try {
        const res = await fetch(`/api/reverse-geocode?lat=${coord.lat}&lng=${coord.lng}`);
        const data = await res.json();
        setPointB({ lat: coord.lat, lng: coord.lng, address: data.address || `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}` });
      } catch {
        setPointB({ lat: coord.lat, lng: coord.lng, address: `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}` });
      }
      setActivePinMode(null);
    }
  };

  const handleMarkerDrag = async (point: "A" | "B", coord: LatLng) => {
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${coord.lat}&lng=${coord.lng}`);
      const data = await res.json();
      const addr = data.address || `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`;
      if (point === "A") {
        setPointA({ lat: coord.lat, lng: coord.lng, address: addr });
      } else {
        setPointB({ lat: coord.lat, lng: coord.lng, address: addr });
      }
    } catch {
      if (point === "A") {
        setPointA({ lat: coord.lat, lng: coord.lng, address: `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}` });
      } else {
        setPointB({ lat: coord.lat, lng: coord.lng, address: `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}` });
      }
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Header
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Search / Results Sidebar */}
        <div className="w-full md:w-[440px] md:min-w-[390px] h-[50vh] md:h-full flex flex-col border-r border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 z-10 overflow-hidden shadow-lg md:shadow-none transition-colors">
          <div className="shrink-0">
            <SearchForm
              pointA={state.pointA}
              pointB={state.pointB}
              query={state.query}
              activePinMode={state.activePinMode}
              isLoading={state.isLoading}
              onPointAChange={setPointA}
              onPointBChange={setPointB}
              onQueryChange={setQuery}
              onTogglePinMode={(mode) =>
                setActivePinMode(state.activePinMode === mode ? null : mode)
              }
              onSwapPoints={swapPoints}
              onSubmit={executeSearch}
            />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <ResultsList
              branches={state.branches}
              midpoint={state.midpoint}
              totalDistanceAB={state.totalDistanceAB}
              highlightedBranchId={state.highlightedBranchId}
              error={state.error}
              onHoverBranch={setHighlightedBranchId}
            />
          </div>
        </div>

        {/* Right Map View */}
        <div className="flex-1 h-[50vh] md:h-full relative overflow-hidden bg-slate-100 dark:bg-slate-950">
          <MapView
            provider={settings.activeProvider}
            googleMapsApiKey={settings.googleMapsApiKey}
            pointA={state.pointA}
            pointB={state.pointB}
            midpoint={state.midpoint}
            branches={state.branches}
            activePinMode={state.activePinMode}
            highlightedBranchId={state.highlightedBranchId}
            onMapClick={handleMapClick}
            onMarkerDrag={handleMarkerDrag}
            onFallbackToOsm={() =>
              saveSettings({ ...settings, activeProvider: "osm" })
            }
          />
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={saveSettings}
      />
    </div>
  );
}

