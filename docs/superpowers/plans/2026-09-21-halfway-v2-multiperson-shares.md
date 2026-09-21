# HalfWay v2: Multi-Person, Server-Sided Google Key & Expiring Share Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade HalfWay to support 2–8 participants with inline renaming, centroid midpoint & generalized travel fairness math, server-side default Google Maps API key via environment variables for zero-config Vercel deployments, and temporary 24h–7d short share codes (`?s=X7k9Pq`).

**Architecture:** Next.js 16 App Router on Bun. Generalized geo math in `src/lib/geo.ts`. Temporary short share codes managed via `src/lib/share-store.ts` (in-memory TTL store with Upstash Redis support). Elysia.js route handlers updated to support multi-person venue searches and share endpoints. Frontend dynamic participant management (min 2, max 8) with hub-and-spoke map lines and multi-person distance breakdowns in result cards.

**Tech Stack:** Bun, Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Elysia.js, Leaflet.js, Google Maps JavaScript API.

**Spec:** [docs/superpowers/specs/2026-09-21-halfway-v2-multiperson-shares-design.md](file:///home/rinme/project/halfway/docs/superpowers/specs/2026-09-21-halfway-v2-multiperson-shares-design.md)

## Global Constraints

- Runtime: Bun (`bun >= 1.3.0`).
- All dev commands must run under Bun (`bun run dev`, `bun test`, `bun run build`).
- Single-port architecture: Elysia.js route handlers in `src/app/api/[[...slugs]]/route.ts`.
- Multi-person capacity: Min 2, max 8 participants.
- Midpoint formula: Centroid of all participant coordinates $(\frac{1}{N}\sum \text{lat}_i, \frac{1}{N}\sum \text{lng}_i)$.
- Fairness formula: $\sum_{i=1}^N d_i + 2 \times (\max(d_i) - \min(d_i))$ (lower is better; exactly matches 2-person formula for $N=2$).
- Zero-config Google Maps: If `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is present in env, defaults to Google Maps without user input; falls back to OpenStreetMap / Leaflet if absent.
- Temporary share code format: 6-character alphanumeric string (`?s=X7k9Pq`), expiring in 24h (default) up to 168h (7 days).

---

### Task 1: Math & Geo Algorithm Expansion for $N$ People (TDD)

**Files:**
- Modify: `src/lib/geo.ts`
- Test: `tests/geo.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface PersonCoord {
    id: string;
    name: string;
    lat: number;
    lng: number;
  }

  export interface PersonDistance {
    personId: string;
    name: string;
    distance: number;
  }

  export interface ScoredBranch extends BranchCandidate {
    distances: PersonDistance[];
    distA?: number; // Backward compatibility
    distB?: number; // Backward compatibility
    distMid: number;
    fairnessScore: number;
    spread: number;
    tier: "primary" | "extended";
    googleMapsUrl: string;
  }

  export function computeCentroid(coords: LatLng[]): LatLng;
  export function computeMultiPersonFairness(distances: number[]): { fairnessScore: number; spread: number };
  export function scoreAndRankBranchesMulti(
    persons: PersonCoord[],
    branches: BranchCandidate[],
    primaryRadiusKm?: number
  ): ScoredBranch[];
  ```

- [ ] **Step 1: Write failing tests for multi-person math**

Add to `tests/geo.test.ts`:
```typescript
describe("Multi-Person Geographic Math & Scoring", () => {
  const p1 = { id: "1", name: "Alice", lat: 13.7563, lng: 100.5018 };
  const p2 = { id: "2", name: "Bob", lat: 13.7223, lng: 100.5284 };
  const p3 = { id: "3", name: "Charlie", lat: 13.7383, lng: 100.5604 };

  it("computes centroid midpoint accurately for 3+ people", () => {
    const centroid = computeCentroid([p1, p2, p3]);
    expect(centroid.lat).toBeCloseTo((p1.lat + p2.lat + p3.lat) / 3, 4);
    expect(centroid.lng).toBeCloseTo((p1.lng + p2.lng + p3.lng) / 3, 4);
  });

  it("computes multi-person fairness score matching 2-person formula for N=2", () => {
    // 2 people: dist1 = 2, dist2 = 4 -> sum = 6, spread = 2 -> score = 6 + 2*(2) = 10
    const result2 = computeMultiPersonFairness([2, 4]);
    expect(result2.fairnessScore).toBe(10);
    expect(result2.spread).toBe(2);

    // 3 people: dist1 = 2, dist2 = 3, dist3 = 5 -> sum = 10, spread = 5 - 2 = 3 -> score = 10 + 2*(3) = 16
    const result3 = computeMultiPersonFairness([2, 3, 5]);
    expect(result3.fairnessScore).toBe(16);
    expect(result3.spread).toBe(3);
  });

  it("scores and ranks branches for multi-person groups", () => {
    const candidates = [
      { id: "c1", name: "Branch Centered", address: "Center", lat: 13.739, lng: 100.53 },
      { id: "c2", name: "Branch Outlier", address: "Far", lat: 13.9, lng: 100.7 },
    ];
    const scored = scoreAndRankBranchesMulti([p1, p2, p3], candidates, 5.0);
    expect(scored.length).toBe(2);
    expect(scored[0].id).toBe("c1");
    expect(scored[0].distances.length).toBe(3);
    expect(scored[0].fairnessScore).toBeLessThan(scored[1].fairnessScore);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/geo.test.ts`
Expected: FAIL ("computeCentroid is not a function")

- [ ] **Step 3: Implement multi-person math in `src/lib/geo.ts`**

Update `src/lib/geo.ts`:
- Add `computeCentroid(coords: LatLng[]): LatLng`.
- Add `computeMultiPersonFairness(distances: number[]): { fairnessScore: number; spread: number }`.
- Add `scoreAndRankBranchesMulti(persons: PersonCoord[], branches: BranchCandidate[], primaryRadiusKm?: number): ScoredBranch[]`.
- Keep existing functions (`computeMidpoint`, `computeFairnessScore`, `scoreAndRankBranches`) aliasing to the generalized versions for backwards compatibility.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/geo.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo.ts tests/geo.test.ts
git commit -m "feat: implement centroid calculation and generalized fairness scoring for N people"
```

---

### Task 2: Temporary Short Share Storage & Service (TDD)

**Files:**
- Create: `src/lib/share-store.ts`
- Test: `tests/share-store.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface SharedSearchData {
    query: string;
    persons: {
      id: string;
      name: string;
      address: string;
      lat: number;
      lng: number;
      color?: string;
    }[];
  }

  export interface ShareRecord {
    code: string;
    createdAt: number;
    expiresAt: number;
    data: SharedSearchData;
  }

  export function generateShortCode(length?: number): string;
  export async function createShareRecord(data: SharedSearchData, expiresInHours?: number): Promise<ShareRecord>;
  export async function getShareRecord(code: string): Promise<SharedSearchData | null>;
  export function clearShareStore(): void;
  ```

- [ ] **Step 1: Write failing tests for share store in `tests/share-store.test.ts`**

Create `tests/share-store.test.ts`:
```typescript
import { describe, expect, it, beforeEach } from "bun:test";
import {
  generateShortCode,
  createShareRecord,
  getShareRecord,
  clearShareStore,
} from "../src/lib/share-store";

describe("Temporary Share Store", () => {
  beforeEach(() => {
    clearShareStore();
  });

  it("generates 6-character alphanumeric code", () => {
    const code = generateShortCode();
    expect(code.length).toBe(6);
    expect(/^[A-Za-z0-9]+$/.test(code)).toBe(true);
  });

  it("creates and retrieves a valid share record", async () => {
    const sample = {
      query: "Starbucks",
      persons: [
        { id: "1", name: "Alice", address: "Siam", lat: 13.75, lng: 100.5 },
        { id: "2", name: "Bob", address: "Silom", lat: 13.72, lng: 100.52 },
      ],
    };
    const record = await createShareRecord(sample, 24);
    expect(record.code).toBeDefined();
    expect(record.expiresAt).toBeGreaterThan(Date.now());

    const retrieved = await getShareRecord(record.code);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.query).toBe("Starbucks");
    expect(retrieved?.persons.length).toBe(2);
    expect(retrieved?.persons[0].name).toBe("Alice");
  });

  it("returns null for non-existent code", async () => {
    const result = await getShareRecord("nonexistent");
    expect(result).toBeNull();
  });

  it("clamps expiration to max 168 hours (7 days)", async () => {
    const record = await createShareRecord({ query: "Test", persons: [] }, 9999);
    const maxExpiry = Date.now() + 168 * 3600 * 1000 + 1000;
    expect(record.expiresAt).toBeLessThanOrEqual(maxExpiry);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/share-store.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/share-store.ts`**

Implement in-memory TTL store with Upstash Redis fallback support if environment variables `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/share-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/share-store.ts tests/share-store.test.ts
git commit -m "feat: implement temporary share code generator and TTL store"
```

---

### Task 3: Elysia.js Route Handler Updates for Multi-Person & Sharing (TDD)

**Files:**
- Modify: `src/server/app.ts`, `src/lib/venue-search.ts`
- Test: `tests/api.test.ts`

**Interfaces:**
- Updates:
  - `POST /api/search-midpoint`: accepts `{ persons: [...], query, apiKey?, preferredProvider? }` (or `{ pointA, pointB, query }`).
  - `POST /api/share`: accepts `{ persons, query, expiresInHours? }`, returns `{ success: true, code, expiresAt, shareUrl }`.
  - `GET /api/share`: query `{ code }`, returns `{ success: true, data: { query, persons } }` or 404.

- [ ] **Step 1: Write failing tests in `tests/api.test.ts`**

Add tests for:
- `POST /api/share` returns short code and shareUrl.
- `GET /api/share?code=...` returns stored persons and query.
- `GET /api/share?code=invalid` returns 404.
- `POST /api/search-midpoint` with 3 persons returns centroid midpoint and distances for each person.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/api.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement route updates in `src/server/app.ts` and `src/lib/venue-search.ts`**

Update `src/lib/venue-search.ts` and `src/server/app.ts` to support both multi-person array and 2-point fallback.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/app.ts src/lib/venue-search.ts tests/api.test.ts
git commit -m "feat: update Elysia API routes for multi-person search and temporary share codes"
```

---

### Task 4: Types, State Management & Share Modal (TDD)

**Files:**
- Modify: `src/types/index.ts`, `src/hooks/useSearchState.ts`, `src/components/SettingsModal.tsx`
- Create: `src/components/ShareModal.tsx`
- Test: `tests/search-state.test.ts`

**Interfaces:**
- Produces:
  - Dynamic `persons: Person[]` state in `useSearchState` (min 2, max 8).
  - Inline rename helper `renamePerson(id, newName)`.
  - Add / remove person helpers.
  - Active pin mode targeting any person ID (`activePinPersonId: string | null`).
  - Auto-detection of `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
  - Share modal generating expiring link (`?s=X7k9Pq`).

- [ ] **Step 1: Write failing tests in `tests/search-state.test.ts`**

Test:
- Adding a person up to 8.
- Preventing removal when 2 persons remain.
- Renaming a person.
- Hydrating state from `?s=...` share code.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/search-state.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement updates in `src/types/index.ts`, `src/hooks/useSearchState.ts`, `src/components/ShareModal.tsx`, `src/components/SettingsModal.tsx`**

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/search-state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/hooks/useSearchState.ts src/components/SettingsModal.tsx src/components/ShareModal.tsx tests/search-state.test.ts
git commit -m "feat: add multi-person state management, share modal, and env Google key default"
```

---

### Task 5: Search Form & Multi-Person Location Inputs (TDD)

**Files:**
- Modify: `src/components/LocationInput.tsx`, `src/components/SearchForm.tsx`, `src/components/Header.tsx`
- Test: `tests/components.test.tsx`

**Interfaces:**
- Produces:
  - `LocationInput.tsx`: supports custom name, inline editing (click to rename), color badge, GPS button, pin targeting button, and trash button.
  - `SearchForm.tsx`: renders list of participants, "+ Add Person" button, brand chips, submit button.
  - `Header.tsx`: wired to open `ShareModal`.

- [ ] **Step 1: Write failing tests in `tests/components.test.tsx`**

Test adding person, renaming person, deleting person, and share button trigger.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/components.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement component updates in `LocationInput.tsx`, `SearchForm.tsx`, `Header.tsx`**

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/components.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/LocationInput.tsx src/components/SearchForm.tsx src/components/Header.tsx tests/components.test.tsx
git commit -m "feat: implement multi-person search form with inline renaming and share modal trigger"
```

---

### Task 6: Result Cards & Results List for $N$ People (TDD)

**Files:**
- Modify: `src/components/ResultCard.tsx`, `src/components/ResultsList.tsx`
- Test: `tests/components.test.tsx`

**Interfaces:**
- Produces:
  - `ResultCard.tsx`: displays Fairness Score, Disparity Spread, and responsive grid of all named participants with their color dots and distances.
  - `ResultsList.tsx`: displays multi-person summary (centroid coords, branch count).

- [ ] **Step 1: Write failing tests in `tests/components.test.tsx`**

Test that ResultCard displays names and distances for 3+ people.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/components.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement updates in `ResultCard.tsx` and `ResultsList.tsx`**

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/components.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ResultCard.tsx src/components/ResultsList.tsx tests/components.test.tsx
git commit -m "feat: render multi-person distance breakdown and spread in result cards"
```

---

### Task 7: Map Visualization for $N$ People (Leaflet & Google Maps) (TDD)

**Files:**
- Modify: `src/components/map/LeafletMap.tsx`, `src/components/map/GoogleMap.tsx`, `src/components/map/MapView.tsx`
- Test: `tests/map.test.tsx`

**Interfaces:**
- Produces:
  - Render color-coded pins for each of the $N$ people with their initial/number.
  - Render draggable pins for each person.
  - Hub-and-spoke dashed lines from each person to centroid midpoint.
  - Branch popups showing distances to all participants.
  - Works identically on both Leaflet and Google Maps.

- [ ] **Step 1: Write failing tests in `tests/map.test.tsx`**

Test that 3+ participant markers and hub lines are rendered.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/map.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement multi-person map rendering in `LeafletMap.tsx`, `GoogleMap.tsx`, and `MapView.tsx`**

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/map.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/map/LeafletMap.tsx src/components/map/GoogleMap.tsx src/components/map/MapView.tsx tests/map.test.tsx
git commit -m "feat: implement multi-person markers and hub-and-spoke lines on Leaflet and Google Maps"
```

---

### Task 8: Page Integration, Vercel Config & Full Verification

**Files:**
- Modify: `src/app/page.tsx`
- Create: `.env.example`
- Test: `tests/page.test.tsx`

**Interfaces:**
- Produces: Complete working application with multi-person halfway finding, share code creation/resolution, and production-ready Vercel build.

- [ ] **Step 1: Update `src/app/page.tsx` and create `.env.example`**

- [ ] **Step 2: Run full test suite**

Run: `bun test`
Expected: All tests PASS.

- [ ] **Step 3: Run production build check**

Run: `bun run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx .env.example tests/page.test.tsx
git commit -m "feat: integrate multi-person page layout and configure Vercel environment example"
```
