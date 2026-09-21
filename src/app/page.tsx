"use client";

import React, { useState } from "react";
import { Header } from "@/components/Header";
import { SearchForm } from "@/components/SearchForm";
import { ResultsList } from "@/components/ResultsList";
import { MapView } from "@/components/map/MapView";
import { SettingsModal } from "@/components/SettingsModal";
import { ShareModal } from "@/components/ShareModal";
import { useSearchState } from "@/hooks/useSearchState";
import { LatLng } from "@/lib/geo";

export default function HalfwayFinderPage() {
  const {
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
  } = useSearchState();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const handleMapClick = async (coord: LatLng) => {
    const targetPersonId =
      state.activePinPersonId ||
      (state.activePinMode === "A"
        ? state.persons[0]?.id
        : state.activePinMode === "B"
        ? state.persons[1]?.id
        : null);

    if (!targetPersonId) return;

    let address = `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`;
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${coord.lat}&lng=${coord.lng}`);
      const data = await res.json();
      if (data.address) {
        address = data.address;
      }
    } catch {
      // Fallback to coordinates
    }

    updatePersonLocation(targetPersonId, {
      lat: coord.lat,
      lng: coord.lng,
      address,
    });

    // Advance to next participant missing location, or clear pin mode if all have locations
    const remainingMissing = state.persons.find(
      (p) =>
        p.id !== targetPersonId &&
        (!p.address || !p.address.trim() || (p.lat === 0 && p.lng === 0))
    );

    if (remainingMissing) {
      setActivePinPersonId(remainingMissing.id);
    } else {
      setActivePinPersonId(null);
    }
  };

  const handlePersonMarkerDrag = async (personId: string, coord: LatLng) => {
    let address = `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`;
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${coord.lat}&lng=${coord.lng}`);
      const data = await res.json();
      if (data.address) {
        address = data.address;
      }
    } catch {
      // Fallback to coordinates
    }

    updatePersonLocation(personId, {
      lat: coord.lat,
      lng: coord.lng,
      address,
    });
  };

  const handleMarkerDrag = async (point: "A" | "B", coord: LatLng) => {
    const targetId = point === "A" ? state.persons[0]?.id : state.persons[1]?.id;
    if (targetId) {
      await handlePersonMarkerDrag(targetId, coord);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <Header
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
      />

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Search / Results Sidebar */}
        <div className="w-full md:w-[420px] md:min-w-[380px] h-[50vh] md:h-full flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 overflow-hidden shadow-lg md:shadow-none">
          <div className="shrink-0">
            <SearchForm
              persons={state.persons}
              onAddPerson={addPerson}
              onRemovePerson={removePerson}
              onRenamePerson={renamePerson}
              onUpdatePersonLocation={updatePersonLocation}
              activePinPersonId={state.activePinPersonId}
              onTogglePinPersonId={(id) =>
                setActivePinPersonId(state.activePinPersonId === id ? null : id)
              }
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

          <div className="flex-1 overflow-y-auto">
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
        <div className="flex-1 h-[50vh] md:h-full relative overflow-hidden">
          <MapView
            provider={settings.activeProvider}
            googleMapsApiKey={settings.googleMapsApiKey}
            persons={state.persons}
            activePinPersonId={state.activePinPersonId}
            onPersonMarkerDrag={handlePersonMarkerDrag}
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

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        persons={state.persons}
        query={state.query}
      />
    </div>
  );
}
