# Design Spec: HalfWay Mobile Layout Redesign (Taste-Driven Mobile UX)

## 1. Problem Statement & Motivation
Currently, HalfWay on mobile devices (`< md` breakpoint) uses a basic vertical split layout:
- Top 50vh: Search Form + Results List
- Bottom 50vh: Leaflet / Google Map View

On standard smartphones (360px - 430px wide, 660px - 850px high), this results in severe ergonomic flaws:
1. **Cramped Viewport**: `50vh` is only ~330px–420px. Entering 3 to 8 participants or opening the mobile virtual keyboard consumes the entire top half, completely hiding results.
2. **Squished Map**: A ~350px tall map square makes navigation, zooming, and inspecting hub-and-spoke lines nearly impossible.
3. **Viewport Instability**: Using `h-screen` instead of dynamic viewport height (`100dvh`) causes unsightly jumps when the browser URL bar collapses or expands on iOS Safari / Chrome Android.
4. **Lack of Map Context**: Clicking markers on mobile either shows cramped popups or gets lost behind screen elements.

## 2. Core Decisions & User Alignment (from /grill-me)
1. **Primary Mobile Architecture**: Floating View Switcher (Airbnb / Yelp style).
   - Fullscreen Form / Results List OR Fullscreen Map.
   - Controlled by a floating frosted-glass bottom toggle pill: `[ 🗺️ View Map ]` / `[ 📋 View Results (N) ]`.
   - Auto-switches to Map when search results are loaded or when a pin is being set.
2. **Search & Results Presentation**: Collapsible Summary Bar.
   - When search results are returned, the multi-person form collapses into an elegant top summary chip (e.g., `👥 3 People · ☕ Starbucks · [Edit]`).
   - Tapping it expands the inputs; when collapsed, the entire vertical screen is dedicated to smooth result card browsing and fairness analysis.
3. **Map View Branch Preview**: Floating Branch Preview Card (Google Maps / Apple Maps style).
   - When a branch marker is tapped on the map, a floating preview card slides up above the toggle pill showing branch rank, name, address, individual travel distances, fairness spread (`±0.4 km`), and a direct "Navigate in Google Maps" button.
4. **Pinning Interaction**: Auto-Switch to Map with Sticky Action Bar.
   - Tapping "Pin on Map" for any participant auto-switches to the fullscreen map with a sticky top banner: `📍 Tap anywhere to place [Alice]'s pin · [Done]`.
   - Dropping a pin reverse-geocodes the location, updates the participant, and allows advancing to the next participant or returning to the form.
5. **Aesthetics & Motion**:
   - `100dvh` viewport container to eliminate iOS Safari toolbar jump.
   - Glassmorphic surfaces with `backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-2xl`.
   - Tactile button feedback (`active:scale-95`).
   - Desktop view (`md:flex-row`, `md:w-[440px]`, `md:h-full`) remains 100% untouched and fully functional.

---

## 3. Component Architecture & UI Hierarchy

```
Desktop (>= md):
┌────────────────────────────────────────────────────────┐
│ Header (Logo, Mode Badge, Share, Settings)             │
├──────────────────────────┬─────────────────────────────┤
│ Sidebar (440px):         │ MapView (flex-1):           │
│ - SearchForm (Inputs)    │ - Fullscreen Leaflet/Google │
│ - ResultsList (Scroll)   │ - Hub-and-spoke lines       │
│                          │ - Centroid & branch pins    │
└──────────────────────────┴─────────────────────────────┘

Mobile (< md):
┌────────────────────────────────────────────────────────┐
│ Header (Compact on mobile, 100% width)                 │
├────────────────────────────────────────────────────────┤
│ [If Map Pinning Active: Sticky Pinning Banner]         │
│                                                        │
│ [State: mobileView === "list"]                         │
│ ┌────────────────────────────────────────────────────┐ │
│ │ If results loaded & collapsed:                     │ │
│ │   MobileSearchSummary ("👥 3 People · ☕ Starbucks")│ │
│ │ If not collapsed or no results:                    │ │
│ │   Full SearchForm (Inputs + Brand Chips)           │ │
│ ├────────────────────────────────────────────────────┤ │
│ │ ResultsList (Full screen scrollable feed)          │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ [State: mobileView === "map"]                          │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Fullscreen MapView (100% of viewport)              │ │
│ │ - Selected Branch Preview Card (Floating above pill)│ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ Floating Bottom Toggle Pill (Centered, z-20)           │
│ [ 🗺️ View Map ]  <--->  [ 📋 View Results (5) ]       │
└────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Component Specifications

### 4.1. `MobileFloatingToggle.tsx`
- **Location**: `src/components/mobile/MobileFloatingToggle.tsx`
- **Props**:
  - `activeView: "list" | "map"`
  - `onToggle: (view: "list" | "map") => void`
  - `resultCount: number`
- **Design Details**:
  - Centered horizontally at bottom: `fixed bottom-6 left-1/2 -translate-x-1/2 z-30 md:hidden`.
  - Pill styling: `flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900/95 dark:bg-slate-800/95 text-white shadow-2xl backdrop-blur-md border border-white/10 active:scale-95 transition-all duration-200 cursor-pointer`.
  - Content:
    - If `activeView === "list"`: `<Map className="w-4 h-4 text-indigo-400" /> <span>View Map</span>`
    - If `activeView === "map"`: `<ListFilter className="w-4 h-4 text-indigo-400" /> <span>View Results (${resultCount})</span>`

### 4.2. `MobileSearchSummary.tsx`
- **Location**: `src/components/mobile/MobileSearchSummary.tsx`
- **Props**:
  - `persons: Person[]`
  - `query: string`
  - `onExpand: () => void`
- **Design Details**:
  - Sticky at top of the results feed: `p-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between z-20 md:hidden`.
  - Left info: Participant count badge with color dots (first 3 colors) + query chip (e.g. `☕ Starbucks`).
  - Right button: `[ ✏️ Edit ]` button with `text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1.5 rounded-lg active:scale-95`.

### 4.3. `MobileBranchPreview.tsx`
- **Location**: `src/components/mobile/MobileBranchPreview.tsx`
- **Props**:
  - `branch: ScoredBranch | null`
  - `onClose: () => void`
  - `onViewDetails: (branch: ScoredBranch) => void`
- **Design Details**:
  - Floating above the bottom pill: `fixed bottom-20 left-4 right-4 z-20 md:hidden`.
  - Card style: `p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xl flex flex-col gap-2.5 animate-in slide-in-from-bottom duration-200`.
  - Content:
    - Top row: Rank badge (`#1 Fair Midpoint`), Branch Name, Close (`X`) button.
    - Middle row: Travel spread (`±0.4 km`), participant distance pills (`Alice: 2.1 km`, `Bob: 2.5 km`).
    - Bottom row: `[ 🧭 Open in Google Maps ]` external link + `[ View in List ]` button.

### 4.4. `MobilePinningBanner.tsx`
- **Location**: `src/components/mobile/MobilePinningBanner.tsx`
- **Props**:
  - `activePerson: Person | null`
  - `onDone: () => void`
- **Design Details**:
  - Sticky banner below header on mobile: `fixed top-14 left-0 right-0 z-30 md:hidden px-4 py-2.5 bg-indigo-600 text-white flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-200`.
  - Content: `📍 Tap map to place location for ${activePerson.name}` + `[ Done ]` button (`bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-xs font-semibold`).

### 4.5. `src/app/page.tsx` Integration
- State additions:
  - `mobileView`: `"list" | "map"`, default `"list"`. Automatically switches to `"map"` when:
    1. Search completes with results (`branches.length > 0`).
    2. `activePinPersonId` is set to drop a pin.
  - `isSearchCollapsed`: boolean, default `false`. Automatically set to `true` when search succeeds with results.
  - `selectedBranch`: `ScoredBranch | null`. Set when a branch marker is tapped on the map or hovered.
- Responsive container:
  - Outer div: `h-[100dvh] w-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950`.
  - Main container: `flex-1 flex flex-col md:flex-row overflow-hidden relative`.
  - On mobile (`< md`):
    - When `mobileView === "list"`, Sidebar has `w-full h-full flex flex-col` and MapView is hidden via `hidden md:block`.
    - When `mobileView === "map"`, MapView has `w-full h-full` and Sidebar is hidden via `hidden md:flex`.
  - On desktop (`>= md`):
    - Both Sidebar (`w-[440px] h-full flex flex-col`) and MapView (`flex-1 h-full`) are displayed side-by-side as before.

---

## 5. Backward Compatibility & Non-Breaking Invariants
1. **Desktop Layout**: 100% identical side-by-side split screen with no functional changes.
2. **API Routes**: Zero backend or API changes needed.
3. **Multi-Person Support ($2 \le N \le 8$)**: Fully functional in both mobile list and map views.
4. **Share URLs & Expiring Links**: Share button and modals operate smoothly across all screen sizes.

---

## 6. Testing Strategy
1. **Component Unit Tests** (`tests/mobile-layout.test.tsx`):
   - `MobileFloatingToggle` renders correct label (`View Map` vs `View Results (N)`) and fires `onToggle`.
   - `MobileSearchSummary` displays participant count, brand chip, and triggers `onExpand`.
   - `MobileBranchPreview` displays rank, branch name, fairness spread, participant distance pills, and navigation link.
   - `MobilePinningBanner` renders active participant name and triggers `onDone`.
2. **Page Integration Tests** (`tests/page.test.tsx`):
   - Switching mobile views between `"list"` and `"map"`.
   - Auto-switching to map view when search results arrive.
   - Auto-switching to map view and displaying pinning banner when clicking pin button for a participant.
3. **TypeScript & Production Build Verification**:
   - `bun x tsc --noEmit` exits with 0 errors.
   - `bun run build` (Next.js 16 + Turbopack) succeeds with 0 errors.
