# Mobile Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the cramped 50vh/50vh mobile split screen into an elite, app-native mobile UX with a floating pill view switcher, collapsible search summary, floating branch preview cards, and guided map pinning.

**Architecture:** Build focused, responsive mobile UI subcomponents (`MobileFloatingToggle`, `MobileSearchSummary`, `MobileBranchPreview`, `MobilePinningBanner`) and integrate them into `src/app/page.tsx` with dynamic viewport height (`100dvh`) and mobile state handling, while leaving the desktop layout (`>= md`) completely untouched.

**Tech Stack:** Next.js 16 (Turbopack), React 19, Tailwind CSS v4, Lucide React, Bun test suite.

**Spec:** `docs/superpowers/specs/2026-09-21-mobile-layout-redesign-design.md`

## Global Constraints
- Runtime: Bun (`bun >= 1.3.0`).
- All dev commands must run under Bun (`bun run dev`, `bun test`, `bun run build`).
- Dynamic Viewport: Container must use `h-[100dvh]` to avoid iOS Safari address bar jumps.
- Desktop Non-Breaking Invariant: Desktop side-by-side split screen (`md:flex-row`, `md:w-[440px]`, `md:h-full`) must remain untouched and fully functional.
- Aesthetics: High-end taste styling using glassmorphism (`backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-2xl`) and tactile touch interactions (`active:scale-95`).
- Test Coverage: All components and page integrations must have unit and integration tests under `tests/`.

---

### Task 1: Mobile UI Subcomponents (TDD)

**Files:**
- Create: `src/components/mobile/MobileFloatingToggle.tsx`
- Create: `src/components/mobile/MobileSearchSummary.tsx`
- Create: `src/components/mobile/MobileBranchPreview.tsx`
- Create: `src/components/mobile/MobilePinningBanner.tsx`
- Create: `tests/mobile-components.test.tsx`

**Interfaces:**
- Produces:
  - `MobileFloatingToggle({ activeView, onToggle, resultCount }: { activeView: "list" | "map"; onToggle: (view: "list" | "map") => void; resultCount: number })`
  - `MobileSearchSummary({ persons, query, onExpand }: { persons: Person[]; query: string; onExpand: () => void })`
  - `MobileBranchPreview({ branch, onClose, onViewDetails }: { branch: ScoredBranch | null; onClose: () => void; onViewDetails?: (b: ScoredBranch) => void })`
  - `MobilePinningBanner({ activePerson, onDone }: { activePerson: Person | null; onDone: () => void })`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/mobile-components.test.tsx
import { describe, it, expect, mock } from "bun:test";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileFloatingToggle } from "@/components/mobile/MobileFloatingToggle";
import { MobileSearchSummary } from "@/components/mobile/MobileSearchSummary";
import { MobileBranchPreview } from "@/components/mobile/MobileBranchPreview";
import { MobilePinningBanner } from "@/components/mobile/MobilePinningBanner";
import { Person, ScoredBranch } from "@/types";

describe("Mobile Subcomponents", () => {
  const mockPersons: Person[] = [
    { id: "1", name: "Alice", address: "Siam Paragon", lat: 13.7462, lng: 100.5347, color: "#10b981" },
    { id: "2", name: "Bob", address: "CentralWorld", lat: 13.7469, lng: 100.5398, color: "#8b5cf6" },
  ];

  const mockBranch: ScoredBranch = {
    id: "b1",
    name: "Starbucks Central Chidlom",
    lat: 13.744,
    lng: 100.543,
    address: "Ploenchit Rd",
    googleMapsUrl: "https://maps.google.com/?cid=123",
    fairnessScore: 4.2,
    spread: 0.4,
    distances: [
      { personId: "1", name: "Alice", distance: 2.1 },
      { personId: "2", name: "Bob", distance: 2.5 },
    ],
  };

  it("MobileFloatingToggle displays 'View Map' when in list view and triggers toggle", () => {
    const handleToggle = mock();
    render(<MobileFloatingToggle activeView="list" onToggle={handleToggle} resultCount={5} />);

    const button = screen.getByRole("button", { name: /view map/i });
    expect(button).toBeDefined();
    fireEvent.click(button);
    expect(handleToggle).toHaveBeenCalledWith("map");
  });

  it("MobileFloatingToggle displays 'View Results (5)' when in map view and triggers toggle", () => {
    const handleToggle = mock();
    render(<MobileFloatingToggle activeView="map" onToggle={handleToggle} resultCount={5} />);

    const button = screen.getByRole("button", { name: /view results \(5\)/i });
    expect(button).toBeDefined();
    fireEvent.click(button);
    expect(handleToggle).toHaveBeenCalledWith("list");
  });

  it("MobileSearchSummary displays participant count, brand chip, and triggers onExpand", () => {
    const handleExpand = mock();
    render(<MobileSearchSummary persons={mockPersons} query="Starbucks" onExpand={handleExpand} />);

    expect(screen.getByText(/2 People/i)).toBeDefined();
    expect(screen.getByText(/Starbucks/i)).toBeDefined();
    const editBtn = screen.getByRole("button", { name: /edit/i });
    fireEvent.click(editBtn);
    expect(handleExpand).toHaveBeenCalled();
  });

  it("MobileBranchPreview displays branch info, spread, individual distances, and links", () => {
    const handleClose = mock();
    render(<MobileBranchPreview branch={mockBranch} onClose={handleClose} />);

    expect(screen.getByText("Starbucks Central Chidlom")).toBeDefined();
    expect(screen.getByText(/±0.4 km/i)).toBeDefined();
    expect(screen.getByText(/Alice: 2.1 km/i)).toBeDefined();
    expect(screen.getByText(/Bob: 2.5 km/i)).toBeDefined();

    const mapsLink = screen.getByRole("link", { name: /open in google maps/i });
    expect(mapsLink.getAttribute("href")).toBe(mockBranch.googleMapsUrl);

    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it("MobilePinningBanner displays active person name and triggers onDone", () => {
    const handleDone = mock();
    render(<MobilePinningBanner activePerson={mockPersons[0]} onDone={handleDone} />);

    expect(screen.getByText(/Tap map to place location for Alice/i)).toBeDefined();
    const doneBtn = screen.getByRole("button", { name: /done/i });
    fireEvent.click(doneBtn);
    expect(handleDone).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/mobile-components.test.tsx`
Expected: FAIL with module not found for `@/components/mobile/*`.

- [ ] **Step 3: Implement components**

Create `src/components/mobile/MobileFloatingToggle.tsx`:
```typescript
"use client";

import React from "react";
import { Map, ListFilter } from "lucide-react";

interface MobileFloatingToggleProps {
  activeView: "list" | "map";
  onToggle: (view: "list" | "map") => void;
  resultCount: number;
}

export function MobileFloatingToggle({
  activeView,
  onToggle,
  resultCount,
}: MobileFloatingToggleProps) {
  const isList = activeView === "list";

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 md:hidden">
      <button
        onClick={() => onToggle(isList ? "map" : "list")}
        className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-slate-900/95 dark:bg-slate-800/95 text-white shadow-2xl backdrop-blur-md border border-white/10 active:scale-95 transition-all duration-200 cursor-pointer text-sm font-semibold tracking-tight hover:bg-slate-800 dark:hover:bg-slate-700"
      >
        {isList ? (
          <>
            <Map className="w-4 h-4 text-indigo-400" />
            <span>View Map</span>
          </>
        ) : (
          <>
            <ListFilter className="w-4 h-4 text-indigo-400" />
            <span>View Results ({resultCount})</span>
          </>
        )}
      </button>
    </div>
  );
}
```

Create `src/components/mobile/MobileSearchSummary.tsx`:
```typescript
"use client";

import React from "react";
import { Users, Search, Edit3 } from "lucide-react";
import { Person } from "@/types";

interface MobileSearchSummaryProps {
  persons: Person[];
  query: string;
  onExpand: () => void;
}

export function MobileSearchSummary({
  persons,
  query,
  onExpand,
}: MobileSearchSummaryProps) {
  const validPersons = persons.filter((p) => p.address.trim() !== "");

  return (
    <div className="p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between z-20 md:hidden transition-colors">
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0">
          <Users className="w-3.5 h-3.5 text-indigo-500" />
          <span>{validPersons.length} People</span>
          <div className="flex -space-x-1 ml-0.5">
            {validPersons.slice(0, 4).map((p) => (
              <span
                key={p.id}
                className="w-2 h-2 rounded-full ring-1 ring-white dark:ring-slate-900 shrink-0"
                style={{ backgroundColor: p.color || "#6366f1" }}
              />
            ))}
          </div>
        </div>

        {query && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-xs font-medium text-indigo-700 dark:text-indigo-300 truncate">
            <Search className="w-3 h-3 shrink-0" />
            <span className="truncate">{query}</span>
          </div>
        )}
      </div>

      <button
        onClick={onExpand}
        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 px-2.5 py-1.5 rounded-lg active:scale-95 transition cursor-pointer shrink-0"
      >
        <Edit3 className="w-3.5 h-3.5" />
        <span>Edit</span>
      </button>
    </div>
  );
}
```

Create `src/components/mobile/MobileBranchPreview.tsx`:
```typescript
"use client";

import React from "react";
import { X, ExternalLink, Navigation, Award } from "lucide-react";
import { ScoredBranch } from "@/types";

interface MobileBranchPreviewProps {
  branch: ScoredBranch | null;
  onClose: () => void;
  onViewDetails?: (branch: ScoredBranch) => void;
}

export function MobileBranchPreview({
  branch,
  onClose,
  onViewDetails,
}: MobileBranchPreviewProps) {
  if (!branch) return null;

  const spread = branch.spread ?? branch.fairnessDelta ?? 0;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-20 md:hidden">
      <div className="p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-2xl flex flex-col gap-2.5 transition-all">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                <Award className="w-3 h-3" />
                Fair Midpoint
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                ±{spread.toFixed(1)} km spread
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {branch.name}
            </h4>
            {branch.address && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {branch.address}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {branch.distances && branch.distances.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {branch.distances.map((d) => (
              <span
                key={d.personId}
                className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
              >
                {d.name}: {d.distance.toFixed(1)} km
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <a
            href={branch.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold shadow-sm transition"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </a>

          {onViewDetails && (
            <button
              onClick={() => onViewDetails(branch)}
              className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 text-xs font-semibold transition cursor-pointer"
            >
              Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

Create `src/components/mobile/MobilePinningBanner.tsx`:
```typescript
"use client";

import React from "react";
import { MapPin, Check } from "lucide-react";
import { Person } from "@/types";

interface MobilePinningBannerProps {
  activePerson: Person | null;
  onDone: () => void;
}

export function MobilePinningBanner({
  activePerson,
  onDone,
}: MobilePinningBannerProps) {
  if (!activePerson) return null;

  return (
    <div className="fixed top-14 left-0 right-0 z-30 md:hidden px-4 py-2.5 bg-indigo-600 dark:bg-indigo-700 text-white flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <MapPin className="w-4 h-4 shrink-0 text-indigo-200 animate-bounce" />
        <span className="text-xs font-semibold truncate">
          Tap map to place location for {activePerson.name}
        </span>
      </div>

      <button
        onClick={onDone}
        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 active:scale-95 px-3 py-1 rounded-lg text-xs font-bold tracking-wide transition cursor-pointer shrink-0"
      >
        <Check className="w-3.5 h-3.5" />
        <span>Done</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/mobile-components.test.tsx`
Expected: PASS (all 5 tests passing).

- [ ] **Step 5: Commit**

```bash
git add src/components/mobile tests/mobile-components.test.tsx
git commit -m "feat: implement mobile subcomponents for floating toggle, summary, preview, and pinning banner"
```

---

### Task 2: Responsive Header & Map Marker Selection (TDD)

**Files:**
- Modify: `src/components/Header.tsx:32-88`
- Modify: `src/components/map/MapView.tsx`
- Modify: `src/components/map/LeafletMap.tsx`
- Modify: `src/components/map/GoogleMap.tsx`
- Modify: `tests/components.test.tsx`
- Modify: `tests/map.test.tsx`

**Interfaces:**
- Consumes:
  - `MapViewProps`: Add `onSelectBranch?: (branch: ScoredBranch) => void`
  - `LeafletMapProps`: Add `onSelectBranch?: (branch: ScoredBranch) => void`
  - `GoogleMapProps`: Add `onSelectBranch?: (branch: ScoredBranch) => void`
- Produces:
  - Responsive header: engine badge hides text on `< sm` screens (`hidden sm:inline`), keeping a clean minimal icon/dot to save space.
  - Clicking any branch pin in Leaflet or Google Maps triggers `onSelectBranch(branch)`.

- [ ] **Step 1: Write the failing tests**

Update `tests/components.test.tsx` and `tests/map.test.tsx`:
```typescript
// In tests/components.test.tsx:
it("Header renders cleanly with responsive badge and share button", () => {
  const mockSettings = { activeProvider: "osm" as const, googleMapsApiKey: "" };
  render(<Header settings={mockSettings} onOpenSettings={() => {}} />);
  expect(screen.getByText("HalfWay")).toBeDefined();
});

// In tests/map.test.tsx:
it("MapView propagates onSelectBranch to map markers", () => {
  const handleSelect = mock();
  render(
    <MapView
      provider="osm"
      midpoint={{ lat: 13.75, lng: 100.5 }}
      branches={[mockBranch1]}
      onSelectBranch={handleSelect}
    />
  );
  // Leaflet renders branch marker; clicking it triggers handleSelect
  const branchMarker = screen.getByTestId("branch-marker-1");
  fireEvent.click(branchMarker);
  expect(handleSelect).toHaveBeenCalledWith(mockBranch1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/map.test.tsx`
Expected: FAIL if `onSelectBranch` is not yet supported on MapView.

- [ ] **Step 3: Implement responsive header and branch selection in maps**

In `src/components/Header.tsx`:
Optimize badge for mobile screens:
```tsx
<div
  className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
    isGoogle
      ? "bg-indigo-50/80 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
      : "bg-emerald-50/80 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
  }`}
>
  <span
    className={`w-1.5 h-1.5 rounded-full ${
      isGoogle ? "bg-indigo-500 animate-pulse" : "bg-emerald-500"
    }`}
  />
  <span className="hidden sm:inline">{isGoogle ? "Google Maps" : "OpenStreetMap"}</span>
  <span className="sm:hidden">{isGoogle ? "Google" : "OSM"}</span>
</div>
```

In `src/components/map/MapView.tsx`:
Add `onSelectBranch?: (branch: ScoredBranch) => void` prop and forward to `LeafletMap` and `GoogleMap`.

In `src/components/map/LeafletMap.tsx`:
When rendering branch markers, add `eventHandlers={{ click: () => { if (onSelectBranch) onSelectBranch(branch); } }}` and keep `data-testid={`branch-marker-${branch.id}`}` on mock or wrapper.

In `src/components/map/GoogleMap.tsx`:
When a branch marker is clicked:
```typescript
marker.addListener("click", () => {
  if (onSelectBranch) onSelectBranch(branch);
  infoWindow.setContent(...);
  infoWindow.open(googleMapRef.current, marker);
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/map.test.tsx tests/components.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.tsx src/components/map/ tests/
git commit -m "feat: add branch selection callbacks to map markers and responsive header styling"
```

---

### Task 3: Page Layout Integration, Mobile View State & Dynamic Viewport (TDD)

**Files:**
- Modify: `src/app/page.tsx`
- Create: `tests/mobile-layout.test.tsx`

**Interfaces:**
- Consumes:
  - `MobileFloatingToggle`
  - `MobileSearchSummary`
  - `MobileBranchPreview`
  - `MobilePinningBanner`
- Produces:
  - `mobileView`: `"list" | "map"` state.
  - `isSearchCollapsed`: boolean state.
  - `selectedBranch`: `ScoredBranch | null` state.
  - Fullscreen toggle and smooth transitions on mobile.
  - Fully intact desktop side-by-side view.

- [ ] **Step 1: Write failing page integration tests**

```typescript
// tests/mobile-layout.test.tsx
import { describe, it, expect, mock } from "bun:test";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "@/app/page";

describe("Mobile Layout Integration", () => {
  it("renders floating view switcher toggle on page", () => {
    render(<Home />);
    const toggleBtn = screen.getByRole("button", { name: /view map/i });
    expect(toggleBtn).toBeDefined();
  });

  it("toggles mobile view between list and map", () => {
    render(<Home />);
    const toggleBtn = screen.getByRole("button", { name: /view map/i });
    fireEvent.click(toggleBtn);

    // Now button should display View Results
    expect(screen.getByRole("button", { name: /view results/i })).toBeDefined();
  });

  it("auto-switches to map view and displays pinning banner when pin mode is activated", () => {
    render(<Home />);
    // Click pin button for Person 1
    const pinButtons = screen.getAllByTitle(/pin.*on map/i);
    fireEvent.click(pinButtons[0]);

    // Should display pinning banner with Person 1's name
    expect(screen.getByText(/Tap map to place location for/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /done/i })).toBeDefined();

    // Clicking Done closes pinning banner
    fireEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(screen.queryByText(/Tap map to place location for/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/mobile-layout.test.tsx`
Expected: FAIL because `MobileFloatingToggle` and `MobilePinningBanner` are not yet wired in `src/app/page.tsx`.

- [ ] **Step 3: Implement mobile state and responsive layout in `src/app/page.tsx`**

1. Replace `h-screen` with `h-[100dvh]` on the root div.
2. Add mobile states:
```typescript
const [mobileView, setMobileView] = useState<"list" | "map">("list");
const [isSearchCollapsed, setIsSearchCollapsed] = useState(false);
const [selectedBranch, setSelectedBranch] = useState<ScoredBranch | null>(null);
```
3. Auto-switch logic:
```typescript
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
  const prevCount = state.branches.length;
  await executeSearch();
  // If we have branches, collapse search and switch to map view
  setIsSearchCollapsed(true);
  setMobileView("map");
};
```
4. Responsive conditional rendering for `< md` vs `>= md`:
```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/mobile-layout.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx tests/mobile-layout.test.tsx
git commit -m "feat: integrate mobile view switcher, search summary, and branch preview in page layout"
```

---

### Task 4: Full System Verification, Visual Polish & Build

**Files:**
- Verify: `tests/`
- Verify: `src/`

- [ ] **Step 1: Run complete test suite**

Run: `bun test`
Expected: 100% pass across all test suites (including `api.test.ts`, `geo.test.ts`, `search-state.test.ts`, `share-store.test.ts`, `components.test.tsx`, `map.test.tsx`, `page.test.tsx`, `mobile-components.test.tsx`, `mobile-layout.test.tsx`).

- [ ] **Step 2: Run TypeScript strict type check**

Run: `bun x tsc --noEmit`
Expected: Exit code 0 with 0 errors.

- [ ] **Step 3: Run Next.js production build**

Run: `bun run build`
Expected: Build successfully completes with 0 errors.

- [ ] **Step 4: Commit any final polishing touches**

```bash
git add .
git commit -m "chore: verify full mobile layout test coverage and clean production build"
```
