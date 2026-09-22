"use client";

import React, { useState } from "react";
import { Header } from "@/components/Header";
import { SearchForm } from "@/components/SearchForm";
import { ResultsList } from "@/components/ResultsList";
import { MapView } from "@/components/map/MapView";
import { SettingsModal } from "@/components/SettingsModal";
import { ShareModal } from "@/components/ShareModal";
import { MobileFloatingToggle } from "@/components/mobile/MobileFloatingToggle";
import { MobileSearchSummary } from "@/components/mobile/MobileSearchSummary";
import { MobileBranchPreview } from "@/components/mobile/MobileBranchPreview";
import { MobilePinningBanner } from "@/components/mobile/MobilePinningBanner";
import { useSearchState } from "@/hooks/useSearchState";
import { LatLng, ScoredBranch } from "@/lib/geo";

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
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [isSearchCollapsed, setIsSearchCollapsed] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<ScoredBranch | null>(null);

  // Switch to map view when pin targeting is activated
  const handleTogglePinPersonId = (id: string) => {
    const nextId = state.activePinPersonId === id ? null : id;
    setActivePinPersonId(nextId);
    if (nextId) {
      setMobileView("map");
    }
  };

  // When search completes with branches, switch to map and collapse search
  const handleSearchSubmit = async () => {
    const hasBranches = await executeSearch();
    if (hasBranches) {
      setIsSearchCollapsed(true);
      setMobileView("map");
    }
  };

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
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Header
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
      />

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Pinning Banner on Mobile */}
        {state.activePinPersonId && (
          <MobilePinningBanner
            activePerson={state.persons.find((p) => p.id === state.activePinPersonId) || null}
            onDone={() => setActivePinPersonId(null)}
          />
        )}

        {/* Left Search / Results Sidebar */}
        <div
          className={`w-full md:w-[440px] md:min-w-[390px] h-full flex flex-col border-r border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 z-10 overflow-hidden shadow-lg md:shadow-none transition-colors ${
            mobileView === "map" ? "hidden md:flex" : "flex"
          }`}
        >
          {/* If results exist and search is collapsed on mobile */}
          {state.branches.length > 0 && isSearchCollapsed ? (
            <MobileSearchSummary
              persons={state.persons}
              query={state.query}
              onExpand={() => setIsSearchCollapsed(false)}
            />
          ) : (
            <div className="shrink-0">
              <SearchForm
                persons={state.persons}
                onAddPerson={addPerson}
                onRemovePerson={removePerson}
                onRenamePerson={renamePerson}
                onUpdatePersonLocation={updatePersonLocation}
                activePinPersonId={state.activePinPersonId}
                onTogglePinPersonId={handleTogglePinPersonId}
                pointA={state.pointA}
                pointB={state.pointB}
                query={state.query}
                activePinMode={state.activePinMode}
                isLoading={state.isLoading}
                onPointAChange={setPointA}
                onPointBChange={setPointB}
                onQueryChange={setQuery}
                onTogglePinMode={(mode) => {
                  const nextMode = state.activePinMode === mode ? null : mode;
                  setActivePinMode(nextMode);
                  if (nextMode) setMobileView("map");
                }}
                onSwapPoints={swapPoints}
                onSubmit={handleSearchSubmit}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <ResultsList
              branches={state.branches}
              midpoint={state.midpoint}
              totalDistanceAB={state.totalDistanceAB}
              highlightedBranchId={state.highlightedBranchId}
              error={state.error}
              onHoverBranch={(id) => {
                setHighlightedBranchId(id);
                const found = state.branches.find((b) => b.id === id);
                if (found) setSelectedBranch(found);
              }}
            />
          </div>
        </div>

        {/* Right Map View */}
        <div
          className={`flex-1 h-full relative overflow-hidden bg-slate-100 dark:bg-slate-950 ${
            mobileView === "list" ? "hidden md:block" : "block"
          }`}
        >
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
            onSelectBranch={(b) => setSelectedBranch(b)}
            onMapClick={handleMapClick}
            onMarkerDrag={handleMarkerDrag}
            onFallbackToOsm={() =>
              saveSettings({ ...settings, activeProvider: "osm" })
            }
          />

          {/* Mobile Selected Branch Preview Card */}
          {selectedBranch && mobileView === "map" && (
            <MobileBranchPreview
              branch={selectedBranch}
              onClose={() => setSelectedBranch(null)}
              onViewDetails={(b) => {
                setSelectedBranch(b);
                setHighlightedBranchId(b.id);
                setMobileView("list");
              }}
            />
          )}
        </div>

        {/* Mobile Floating Toggle Switcher */}
        <MobileFloatingToggle
          activeView={mobileView}
          onToggle={setMobileView}
          resultCount={state.branches.length}
        />
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
