# Halfway Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Halfway Finder", a full-stack Next.js + Bun web app with an integrated Elysia.js API and a dynamic dual-provider map (Leaflet/OSM free fallback + Google Maps) that helps two users locate venue branches midway between their locations ranked by travel fairness.

**Architecture:** Next.js 15 (App Router) on Bun hosting Elysia.js directly via route handler (`src/app/api/[[...slugs]]/route.ts`). Client renders a split layout with interactive search controls, URL state synchronization, and an SSR-disabled map component that renders Leaflet by default or Google Maps if a user stores an API key in `localStorage`.

**Tech Stack:** Bun, Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons, Elysia.js, Leaflet.js, OpenStreetMap / Nominatim / Overpass API, Google Maps JavaScript & Places API.

**Spec:** [docs/superpowers/specs/2026-09-21-halfway-finder-design.md](file:///home/rinme/project/halfway/docs/superpowers/specs/2026-09-21-halfway-finder-design.md)

## Global Constraints

- Runtime: Bun (`bun >= 1.3.0`).
- All dev commands must run under Bun (`bun run dev`, `bun test`, `bun run build`).
- Single-port architecture: Elysia.js mounted in Next.js App Router route handler (`/api/[[...slugs]]`).
- Distance & Fairness formula: Haversine distance; $\text{Fairness Score} = (d_A + d_B) + 2 \times |d_A - d_B|$ (lower is better).
- Zero external API key requirement for default operation (Leaflet + Nominatim + Overpass API).
- Optional Google Maps API key loaded dynamically on the client from `localStorage`.

---

### Task 1: Project Scaffolding & Dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Produces: Working Next.js 15 + Bun + Tailwind CSS + Elysia setup capable of running `bun test` and `bun run build`.

- [ ] **Step 1: Initialize Next.js app with Tailwind CSS and install dependencies**

Run in terminal:
```bash
bun create next-app . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-bun
bun add elysia lucide-react leaflet
bun add -d @types/leaflet
```

- [ ] **Step 2: Verify package.json scripts and test setup**

Verify that `package.json` contains:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "bun test"
}
```

- [ ] **Step 3: Create a smoke test to verify `bun test` works**

Create `tests/smoke.test.ts`:
```typescript
import { describe, expect, it } from "bun:test";

describe("Environment Smoke Test", () => {
  it("runs bun test successfully", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 4: Run test to verify**

Run: `bun test tests/smoke.test.ts`
Expected: PASS (1 test passed)

- [ ] **Step 5: Commit scaffolding**

```bash
git add .
git commit -m "chore: scaffold Next.js project with Bun, Tailwind, Elysia, and Leaflet"
```

---

### Task 2: Core Math & Fairness Scoring Engine (TDD)

**Files:**
- Create: `src/lib/geo.ts`
- Test: `tests/geo.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface LatLng {
    lat: number;
    lng: number;
  }

  export interface BranchCandidate {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
  }

  export interface ScoredBranch extends BranchCandidate {
    distA: number;
    distB: number;
    distMid: number;
    fairnessScore: number;
    fairnessDelta: number;
    tier: "primary" | "extended";
    googleMapsUrl: string;
  }

  export function computeMidpoint(a: LatLng, b: LatLng): LatLng;
  export function haversineDistance(a: LatLng, b: LatLng): number;
  export function computeFairnessScore(distA: number, distB: number): number;
  export function scoreAndRankBranches(
    pointA: LatLng,
    pointB: LatLng,
    branches: BranchCandidate[],
    primaryRadiusKm?: number
  ): ScoredBranch[];
  ```

- [ ] **Step 1: Write failing tests for geo math and fairness scoring**

Create `tests/geo.test.ts`:
```typescript
import { describe, expect, it } from "bun:test";
import {
  computeMidpoint,
  haversineDistance,
  computeFairnessScore,
  scoreAndRankBranches,
} from "../src/lib/geo";

describe("Geographic Math & Scoring", () => {
  const pointA = { lat: 13.7563, lng: 100.5018 }; // Bangkok Old City
  const pointB = { lat: 13.7223, lng: 100.5284 }; // Silom

  it("calculates correct midpoint between two coordinates", () => {
    const mid = computeMidpoint(pointA, pointB);
    expect(mid.lat).toBeCloseTo(13.7393, 3);
    expect(mid.lng).toBeCloseTo(100.5151, 3);
  });

  it("calculates haversine distance accurately in kilometers", () => {
    // Bangkok Old City to Silom is approx 4.7 - 4.9 km
    const dist = haversineDistance(pointA, pointB);
    expect(dist).toBeGreaterThan(4.5);
    expect(dist).toBeLessThan(5.1);
  });

  it("returns 0 distance for identical coordinates", () => {
    const dist = haversineDistance(pointA, pointA);
    expect(dist).toBe(0);
  });

  it("computes fairness score with double penalty on difference", () => {
    // Score = (distA + distB) + 2 * |distA - distB|
    // Case 1: distA = 2, distB = 2 -> (2+2) + 2*(0) = 4
    expect(computeFairnessScore(2, 2)).toBe(4);
    // Case 2: distA = 1, distB = 3 -> (1+3) + 2*(2) = 8
    expect(computeFairnessScore(1, 3)).toBe(8);
  });

  it("scores, tags tiers, and ranks branches by fairness score ascending", () => {
    const mid = computeMidpoint(pointA, pointB);
    const candidates = [
      {
        id: "unfair",
        name: "Branch Unfair",
        address: "Near A",
        lat: pointA.lat,
        lng: pointA.lng, // distA ≈ 0, distB ≈ 4.8, fairness = 4.8 + 2*(4.8) = 14.4
      },
      {
        id: "fair",
        name: "Branch Fair",
        address: "At Midpoint",
        lat: mid.lat,
        lng: mid.lng, // distA ≈ 2.4, distB ≈ 2.4, fairness ≈ 4.8
      },
    ];

    const ranked = scoreAndRankBranches(pointA, pointB, candidates, 3.0);
    expect(ranked.length).toBe(2);
    expect(ranked[0].id).toBe("fair");
    expect(ranked[1].id).toBe("unfair");
    expect(ranked[0].fairnessScore).toBeLessThan(ranked[1].fairnessScore);
    expect(ranked[0].tier).toBe("primary");
    expect(ranked[0].googleMapsUrl).toContain("maps/dir");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/geo.test.ts`
Expected: FAIL ("Cannot find module '../src/lib/geo'")

- [ ] **Step 3: Implement `src/lib/geo.ts`**

Create `src/lib/geo.ts`:
```typescript
export interface LatLng {
  lat: number;
  lng: number;
}

export interface BranchCandidate {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface ScoredBranch extends BranchCandidate {
  distA: number;
  distB: number;
  distMid: number;
  fairnessScore: number;
  fairnessDelta: number;
  tier: "primary" | "extended";
  googleMapsUrl: string;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function computeMidpoint(a: LatLng, b: LatLng): LatLng {
  return {
    lat: Number(((a.lat + b.lat) / 2).toFixed(6)),
    lng: Number(((a.lng + b.lng) / 2).toFixed(6)),
  };
}

export function haversineDistance(a: LatLng, b: LatLng): number {
  if (a.lat === b.lat && a.lng === b.lng) {
    return 0;
  }
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Number((EARTH_RADIUS_KM * c).toFixed(2));
}

export function computeFairnessScore(distA: number, distB: number): number {
  const sum = distA + distB;
  const delta = Math.abs(distA - distB);
  return Number((sum + 2 * delta).toFixed(2));
}

export function scoreAndRankBranches(
  pointA: LatLng,
  pointB: LatLng,
  branches: BranchCandidate[],
  primaryRadiusKm: number = 3.0
): ScoredBranch[] {
  const midpoint = computeMidpoint(pointA, pointB);

  const scored: ScoredBranch[] = branches.map((branch) => {
    const branchCoord = { lat: branch.lat, lng: branch.lng };
    const distA = haversineDistance(pointA, branchCoord);
    const distB = haversineDistance(pointB, branchCoord);
    const distMid = haversineDistance(midpoint, branchCoord);
    const fairnessScore = computeFairnessScore(distA, distB);
    const fairnessDelta = Number(Math.abs(distA - distB).toFixed(2));
    const tier = distMid <= primaryRadiusKm ? "primary" : "extended";

    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${pointA.lat},${pointA.lng}&destination=${branch.lat},${branch.lng}`;

    return {
      ...branch,
      distA,
      distB,
      distMid,
      fairnessScore,
      fairnessDelta,
      tier,
      googleMapsUrl,
    };
  });

  return scored.sort((a, b) => a.fairnessScore - b.fairnessScore);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/geo.test.ts`
Expected: PASS (5 tests passed)

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo.ts tests/geo.test.ts
git commit -m "feat: implement midpoint calculation, Haversine distance, and fairness scoring"
```

---

### Task 3: In-Memory LRU Cache & Geocoding Service (TDD)

**Files:**
- Create: `src/lib/cache.ts`, `src/lib/geocoding.ts`
- Test: `tests/geocoding.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface GeocodeResult {
    label: string;
    lat: number;
    lng: number;
  }

  export class SimpleLRUCache<T> {
    constructor(maxEntries?: number, ttlMs?: number);
    get(key: string): T | undefined;
    set(key: string, value: T): void;
  }

  export async function geocodeAddress(
    query: string,
    provider?: "osm" | "google",
    apiKey?: string
  ): Promise<GeocodeResult[]>;

  export async function reverseGeocode(
    lat: number,
    lng: number,
    provider?: "osm" | "google",
    apiKey?: string
  ): Promise<string>;
  ```

- [ ] **Step 1: Write failing tests for cache and geocoding**

Create `tests/geocoding.test.ts`:
```typescript
import { describe, expect, it } from "bun:test";
import { SimpleLRUCache } from "../src/lib/cache";
import { geocodeAddress } from "../src/lib/geocoding";

describe("LRU Cache", () => {
  it("stores and retrieves cached items", () => {
    const cache = new SimpleLRUCache<string>(2, 1000);
    cache.set("a", "1");
    cache.set("b", "2");
    expect(cache.get("a")).toBe("1");
    expect(cache.get("b")).toBe("2");
  });

  it("evicts oldest entry when maxEntries is exceeded", () => {
    const cache = new SimpleLRUCache<string>(2, 1000);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
    expect(cache.get("c")).toBe("3");
  });
});

describe("Geocoding Service", () => {
  it("returns empty array for empty query", async () => {
    const results = await geocodeAddress("");
    expect(results).toEqual([]);
  });

  it("handles valid response parsing gracefully", async () => {
    // Call with query that triggers mock or valid format
    const results = await geocodeAddress("Siam Paragon, Bangkok", "osm");
    expect(Array.isArray(results)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/geocoding.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/cache.ts` and `src/lib/geocoding.ts`**

Create `src/lib/cache.ts`:
```typescript
interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class SimpleLRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries: number = 200, ttlMs: number = 30 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { value, expiry: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}
```

Create `src/lib/geocoding.ts`:
```typescript
import { SimpleLRUCache } from "./cache";

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

const geocodeCache = new SimpleLRUCache<GeocodeResult[]>(200, 30 * 60 * 1000);
const reverseCache = new SimpleLRUCache<string>(200, 30 * 60 * 1000);

export async function geocodeAddress(
  query: string,
  provider: "osm" | "google" = "osm",
  apiKey?: string
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `${provider}:${apiKey ? "key:" : "nokey:"}${trimmed.toLowerCase()}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  if (provider === "google" && apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        trimmed
      )}&key=${apiKey}`;
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (data.status === "OK" && Array.isArray(data.results)) {
        const parsed: GeocodeResult[] = data.results.slice(0, 5).map((item: any) => ({
          label: item.formatted_address,
          lat: item.geometry.location.lat,
          lng: item.geometry.location.lng,
        }));
        geocodeCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch {
      // Fallback to OSM
    }
  }

  // Fallback to OpenStreetMap / Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      trimmed
    )}&limit=5&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "HalfwayFinder/1.0 (https://github.com/halfway-finder)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any[];
    const parsed: GeocodeResult[] = data.map((item) => ({
      label: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
    geocodeCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    return [];
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  provider: "osm" | "google" = "osm",
  apiKey?: string
): Promise<string> {
  const cacheKey = `${provider}:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = reverseCache.get(cacheKey);
  if (cached) return cached;

  if (provider === "google" && apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (data.status === "OK" && data.results?.[0]) {
        const addr = data.results[0].formatted_address;
        reverseCache.set(cacheKey, addr);
        return addr;
      }
    } catch {
      // Fallback to OSM
    }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "HalfwayFinder/1.0 (https://github.com/halfway-finder)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = (await res.json()) as any;
    const addr = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    reverseCache.set(cacheKey, addr);
    return addr;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/geocoding.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/cache.ts src/lib/geocoding.ts tests/geocoding.test.ts
git commit -m "feat: implement LRU caching, Nominatim geocoding, and Google geocoding fallback"
```

---

### Task 4: Overpass API Multi-Mirror POI Search & Fallback (TDD)

**Files:**
- Create: `src/lib/overpass.ts`, `src/lib/venue-search.ts`
- Test: `tests/venue-search.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export async function fetchOverpassVenues(
    midpoint: LatLng,
    query: string,
    radiusMeters?: number
  ): Promise<BranchCandidate[]>;

  export async function searchMidpointVenues(params: {
    pointA: LatLng;
    pointB: LatLng;
    query: string;
    apiKey?: string;
    preferredProvider?: "osm" | "google";
  }): Promise<{
    midpoint: LatLng;
    totalDistanceAB: number;
    radiusUsedKm: number;
    branches: ScoredBranch[];
  }>;
  ```

- [ ] **Step 1: Write failing tests for venue search**

Create `tests/venue-search.test.ts`:
```typescript
import { describe, expect, it } from "bun:test";
import { searchMidpointVenues } from "../src/lib/venue-search";

describe("Venue Search Service", () => {
  const pointA = { lat: 13.7563, lng: 100.5018 };
  const pointB = { lat: 13.7223, lng: 100.5284 };

  it("handles empty venue results without crashing", async () => {
    const result = await searchMidpointVenues({
      pointA,
      pointB,
      query: "nonexistent_super_rare_store_12345",
    });

    expect(result.midpoint).toBeDefined();
    expect(result.totalDistanceAB).toBeGreaterThan(0);
    expect(Array.isArray(result.branches)).toBe(true);
    expect(result.branches.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/venue-search.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/overpass.ts` and `src/lib/venue-search.ts`**

Create `src/lib/overpass.ts`:
```typescript
import { BranchCandidate, LatLng } from "./geo";

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export async function fetchOverpassVenues(
  midpoint: LatLng,
  query: string,
  radiusMeters: number = 10000
): Promise<BranchCandidate[]> {
  const sanitized = escapeRegex(query.trim());
  if (!sanitized) return [];

  const overpassQuery = `[out:json][timeout:15];
(
  node(around:${radiusMeters},${midpoint.lat},${midpoint.lng})[~"^(name|brand|operator)$"~"${sanitized}",i];
  way(around:${radiusMeters},${midpoint.lat},${midpoint.lng})[~"^(name|brand|operator)$"~"${sanitized}",i];
);
out center tags 30;`;

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(mirror, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "HalfwayFinder/1.0",
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data = (await response.json()) as any;
      if (!data?.elements || !Array.isArray(data.elements)) continue;

      const results: BranchCandidate[] = [];
      for (const el of data.elements) {
        const lat = el.lat || el.center?.lat;
        const lng = el.lon || el.center?.lon;
        if (!lat || !lng) continue;

        const name = el.tags?.name || el.tags?.brand || query;
        const street = el.tags?.["addr:street"] || "";
        const city = el.tags?.["addr:city"] || "";
        const address = [street, city].filter(Boolean).join(", ") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        results.push({
          id: `osm-${el.type}-${el.id}`,
          name,
          address,
          lat,
          lng,
        });
      }

      return results;
    } catch {
      // Mirror failed or timed out, loop to next mirror
      continue;
    }
  }

  return [];
}
```

Create `src/lib/venue-search.ts`:
```typescript
import {
  BranchCandidate,
  LatLng,
  ScoredBranch,
  computeMidpoint,
  haversineDistance,
  scoreAndRankBranches,
} from "./geo";
import { fetchOverpassVenues } from "./overpass";

export async function fetchGooglePlaces(
  midpoint: LatLng,
  query: string,
  apiKey: string,
  radiusMeters: number = 10000
): Promise<BranchCandidate[]> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${midpoint.lat},${midpoint.lng}&radius=${radiusMeters}&keyword=${encodeURIComponent(
      query
    )}&key=${apiKey}`;
    const res = await fetch(url);
    const data = (await res.json()) as any;
    if (data.status === "OK" && Array.isArray(data.results)) {
      return data.results.slice(0, 30).map((place: any) => ({
        id: `google-${place.place_id}`,
        name: place.name,
        address: place.vicinity || place.name,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function searchMidpointVenues(params: {
  pointA: LatLng;
  pointB: LatLng;
  query: string;
  apiKey?: string;
  preferredProvider?: "osm" | "google";
}): Promise<{
  midpoint: LatLng;
  totalDistanceAB: number;
  radiusUsedKm: number;
  branches: ScoredBranch[];
}> {
  const { pointA, pointB, query, apiKey, preferredProvider = "osm" } = params;
  const midpoint = computeMidpoint(pointA, pointB);
  const totalDistanceAB = haversineDistance(pointA, pointB);

  let candidates: BranchCandidate[] = [];

  if (preferredProvider === "google" && apiKey) {
    candidates = await fetchGooglePlaces(midpoint, query, apiKey, 10000);
  }

  if (candidates.length === 0) {
    candidates = await fetchOverpassVenues(midpoint, query, 10000);
  }

  const scored = scoreAndRankBranches(pointA, pointB, candidates, 3.0);

  return {
    midpoint,
    totalDistanceAB,
    radiusUsedKm: 10,
    branches: scored,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/venue-search.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/overpass.ts src/lib/venue-search.ts tests/venue-search.test.ts
git commit -m "feat: implement Overpass multi-mirror venue query and midpoint search orchestrator"
```

---

### Task 5: Elysia.js Next.js Route Handler Integration (TDD)

**Files:**
- Create: `src/server/app.ts`, `src/app/api/[[...slugs]]/route.ts`
- Test: `tests/api.test.ts`

**Interfaces:**
- Produces: Complete Next.js App Router route handler serving `GET /api/geocode`, `GET /api/reverse-geocode`, and `POST /api/search-midpoint`.

- [ ] **Step 1: Write failing tests for Elysia HTTP routes**

Create `tests/api.test.ts`:
```typescript
import { describe, expect, it } from "bun:test";
import { app } from "../src/server/app";

describe("Elysia API Route Handlers", () => {
  it("responds to GET /api/health", async () => {
    const res = await app.handle(new Request("http://localhost/api/health"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
  });

  it("handles GET /api/geocode with missing query", async () => {
    const res = await app.handle(new Request("http://localhost/api/geocode?q="));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toEqual([]);
  });

  it("validates POST /api/search-midpoint payload", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/search-midpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointA: { lat: 13.75, lng: 100.5 },
          pointB: { lat: 13.72, lng: 100.52 },
          query: "Starbucks",
        }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.midpoint).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/api.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/server/app.ts` and route handler**

Create `src/server/app.ts`:
```typescript
import { Elysia, t } from "elysia";
import { geocodeAddress, reverseGeocode } from "../lib/geocoding";
import { searchMidpointVenues } from "../lib/venue-search";

export const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok", time: new Date().toISOString() }))
  .get(
    "/geocode",
    async ({ query }) => {
      const q = query.q || "";
      const provider = query.provider === "google" ? "google" : "osm";
      const key = query.key;
      const results = await geocodeAddress(q, provider, key);
      return { success: true, results };
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
        provider: t.Optional(t.String()),
        key: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/reverse-geocode",
    async ({ query }) => {
      const lat = parseFloat(query.lat || "0");
      const lng = parseFloat(query.lng || "0");
      const provider = query.provider === "google" ? "google" : "osm";
      const key = query.key;
      const address = await reverseGeocode(lat, lng, provider, key);
      return { success: true, address };
    },
    {
      query: t.Object({
        lat: t.String(),
        lng: t.String(),
        provider: t.Optional(t.String()),
        key: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/search-midpoint",
    async ({ body }) => {
      const { pointA, pointB, query, apiKey, preferredProvider } = body;
      const result = await searchMidpointVenues({
        pointA,
        pointB,
        query,
        apiKey,
        preferredProvider: preferredProvider === "google" ? "google" : "osm",
      });
      return { success: true, ...result };
    },
    {
      body: t.Object({
        pointA: t.Object({
          lat: t.Number(),
          lng: t.Number(),
        }),
        pointB: t.Object({
          lat: t.Number(),
          lng: t.Number(),
        }),
        query: t.String(),
        apiKey: t.Optional(t.String()),
        preferredProvider: t.Optional(t.String()),
      }),
    }
  );
```

Create `src/app/api/[[...slugs]]/route.ts`:
```typescript
import { app } from "@/server/app";

export const dynamic = "force-dynamic";

const handle = ({ request }: { request: Request }) => app.handle(request);

export const GET = (req: Request) => app.handle(req);
export const POST = (req: Request) => app.handle(req);
export const PUT = (req: Request) => app.handle(req);
export const DELETE = (req: Request) => app.handle(req);
export const PATCH = (req: Request) => app.handle(req);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/app.ts src/app/api/[[...slugs]]/route.ts tests/api.test.ts
git commit -m "feat: mount Elysia.js route handler in Next.js App Router"
```

---

### Task 6: Shared Types, Settings Modal & State Management Hook

**Files:**
- Create: `src/types/index.ts`, `src/hooks/useSearchState.ts`, `src/components/SettingsModal.tsx`
- Test: `tests/search-state.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface LocationPoint {
    address: string;
    lat: number;
    lng: number;
  }

  export interface SearchState {
    pointA: LocationPoint | null;
    pointB: LocationPoint | null;
    query: string;
    activePinMode: "A" | "B" | null;
    branches: ScoredBranch[];
    midpoint: LatLng | null;
    totalDistanceAB: number | null;
    isLoading: boolean;
    error: string | null;
    highlightedBranchId: string | null;
  }
  ```

- [ ] **Step 1: Write types in `src/types/index.ts`**

Create `src/types/index.ts`:
```typescript
import { LatLng, ScoredBranch } from "@/lib/geo";

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
}

export type MapProvider = "osm" | "google";

export interface AppSettings {
  googleMapsApiKey: string;
  activeProvider: MapProvider;
}

export interface SearchState {
  pointA: LocationPoint | null;
  pointB: LocationPoint | null;
  query: string;
  activePinMode: "A" | "B" | null;
  branches: ScoredBranch[];
  midpoint: LatLng | null;
  totalDistanceAB: number | null;
  isLoading: boolean;
  error: string | null;
  highlightedBranchId: string | null;
}
```

- [ ] **Step 2: Implement Settings Modal in `src/components/SettingsModal.tsx`**

Create `src/components/SettingsModal.tsx`:
```tsx
"use client";

import React, { useState, useEffect } from "react";
import { X, Key, CheckCircle2, AlertCircle, Layers } from "lucide-react";
import { AppSettings, MapProvider } from "@/types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}: SettingsModalProps) {
  const [key, setKey] = useState(settings.googleMapsApiKey);
  const [provider, setProvider] = useState<MapProvider>(settings.activeProvider);
  const [status, setStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    setKey(settings.googleMapsApiKey);
    setProvider(settings.activeProvider);
  }, [settings]);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!key.trim()) {
      setStatus("invalid");
      setStatusMessage("Please enter an API key first.");
      return;
    }
    setStatus("testing");
    try {
      const res = await fetch(`/api/geocode?q=Bangkok&provider=google&key=${encodeURIComponent(key.trim())}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setStatus("valid");
        setStatusMessage("Google Maps API Key is verified!");
      } else {
        setStatus("invalid");
        setStatusMessage("Key returned no geocoding results or lacks Places API access.");
      }
    } catch {
      setStatus("invalid");
      setStatusMessage("Error connecting to verification service.");
    }
  };

  const handleSave = () => {
    onSaveSettings({
      googleMapsApiKey: key.trim(),
      activeProvider: provider,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Map & API Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Active Map Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProvider("osm")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition ${
                  provider === "osm"
                    ? "border-emerald-500 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <Layers className="w-4 h-4" />
                OpenStreetMap (Free)
              </button>
              <button
                type="button"
                onClick={() => setProvider("google")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition ${
                  provider === "google"
                    ? "border-indigo-500 bg-indigo-50/50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <Layers className="w-4 h-4" />
                Google Maps
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Google Maps API Key (Optional)
            </label>
            <p className="text-xs text-zinc-500 mb-2">
              Stored securely in your local browser storage. Used for Google Maps JS, Geocoding & Places.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setStatus("idle");
                }}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleTestKey}
                disabled={status === "testing" || !key.trim()}
                className="px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition disabled:opacity-50"
              >
                {status === "testing" ? "Testing..." : "Test Key"}
              </button>
            </div>

            {status === "valid" && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>{statusMessage}</span>
              </div>
            )}
            {status === "invalid" && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-4 h-4" />
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement `src/hooks/useSearchState.ts`**

Create `src/hooks/useSearchState.ts`:
```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { AppSettings, LocationPoint, SearchState } from "@/types";
import { ScoredBranch, LatLng } from "@/lib/geo";

export function useSearchState() {
  const [settings, setSettings] = useState<AppSettings>({
    googleMapsApiKey: "",
    activeProvider: "osm",
  });

  const [state, setState] = useState<SearchState>({
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
      const savedProvider = (localStorage.getItem("halfway_active_provider") as any) || "osm";
      setSettings({
        googleMapsApiKey: savedKey,
        activeProvider: savedKey && savedProvider === "google" ? "google" : "osm",
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

  const setPointA = useCallback((point: LocationPoint | null) => {
    setState((prev) => ({ ...prev, pointA: point }));
  }, []);

  const setPointB = useCallback((point: LocationPoint | null) => {
    setState((prev) => ({ ...prev, pointB: point }));
  }, []);

  const setQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, query }));
  }, []);

  const setActivePinMode = useCallback((mode: "A" | "B" | null) => {
    setState((prev) => ({ ...prev, activePinMode: mode }));
  }, []);

  const setHighlightedBranchId = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, highlightedBranchId: id }));
  }, []);

  const swapPoints = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pointA: prev.pointB,
      pointB: prev.pointA,
    }));
  }, []);

  const executeSearch = useCallback(async () => {
    if (!state.pointA || !state.pointB || !state.query.trim()) {
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
          pointA: { lat: state.pointA.lat, lng: state.pointA.lng },
          pointB: { lat: state.pointB.lat, lng: state.pointB.lng },
          query: state.query.trim(),
          apiKey: settings.googleMapsApiKey || undefined,
          preferredProvider: settings.activeProvider,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to search for midpoint branches");
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        branches: data.branches || [],
        midpoint: data.midpoint,
        totalDistanceAB: data.totalDistanceAB,
        activePinMode: null,
      }));

      // Update URL query params
      const params = new URLSearchParams(window.location.search);
      params.set("a_lat", state.pointA.lat.toString());
      params.set("a_lng", state.pointA.lng.toString());
      params.set("a_name", state.pointA.address);
      params.set("b_lat", state.pointB.lat.toString());
      params.set("b_lng", state.pointB.lng.toString());
      params.set("b_name", state.pointB.address);
      params.set("q", state.query.trim());
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || "An error occurred while finding branches.",
      }));
    }
  }, [state.pointA, state.pointB, state.query, settings]);

  // Read URL query params on initial mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const aLat = params.get("a_lat");
    const aLng = params.get("a_lng");
    const aName = params.get("a_name");
    const bLat = params.get("b_lat");
    const bLng = params.get("b_lng");
    const bName = params.get("b_name");
    const q = params.get("q");

    if (aLat && aLng) {
      setPointA({
        lat: parseFloat(aLat),
        lng: parseFloat(aLng),
        address: aName || `${aLat}, ${aLng}`,
      });
    }
    if (bLat && bLng) {
      setPointB({
        lat: parseFloat(bLat),
        lng: parseFloat(bLng),
        address: bName || `${bLat}, ${bLng}`,
      });
    }
    if (q) {
      setQuery(q);
    }
  }, [setPointA, setPointB, setQuery]);

  return {
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
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/hooks/useSearchState.ts src/components/SettingsModal.tsx
git commit -m "feat: add application types, settings modal, and useSearchState hook"
```

---

### Task 7: Split Layout & Search / Results UI Components

**Files:**
- Create:
  - `src/components/Header.tsx`
  - `src/components/LocationInput.tsx`
  - `src/components/SearchForm.tsx`
  - `src/components/ResultCard.tsx`
  - `src/components/ResultsList.tsx`

**Interfaces:**
- Produces: Polished, responsive search form, debounced autocomplete, GPS locator, brand chip selectors, and ranked result cards displaying distance to A, distance to B, and fairness badges.

- [ ] **Step 1: Implement `src/components/Header.tsx`**

Create `src/components/Header.tsx`:
```tsx
"use client";

import React, { useState } from "react";
import { Compass, Settings, Share2, Check } from "lucide-react";
import { AppSettings } from "@/types";

interface HeaderProps {
  settings: AppSettings;
  onOpenSettings: () => void;
}

export function Header({ settings, onOpenSettings }: HeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
          <Compass className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">
            Halfway Finder
          </h1>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Fair venue midpoint matching
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
            settings.activeProvider === "google"
              ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
              : "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
          }`}
        >
          {settings.activeProvider === "google" ? "Google Maps" : "OpenStreetMap"}
        </span>

        <button
          onClick={handleShare}
          title="Copy shareable link"
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenSettings}
          title="Settings & API Key"
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Implement `src/components/LocationInput.tsx`**

Create `src/components/LocationInput.tsx`:
```tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { MapPin, Navigation, Crosshair, Loader2 } from "lucide-react";
import { LocationPoint } from "@/types";
import { GeocodeResult } from "@/lib/geocoding";

interface LocationInputProps {
  label: string;
  point: LocationPoint | null;
  onChange: (point: LocationPoint | null) => void;
  colorClass: string;
  badgeLabel: "A" | "B";
  isActivePinMode: boolean;
  onTogglePinMode: () => void;
}

export function LocationInput({
  label,
  point,
  onChange,
  colorClass,
  badgeLabel,
  isActivePinMode,
  onTogglePinMode,
}: LocationInputProps) {
  const [query, setQuery] = useState(point?.address || "");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (point?.address) {
      setQuery(point.address);
    }
  }, [point]);

  // Debounced autocomplete
  useEffect(() => {
    if (!query.trim() || query === point?.address) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.results || []);
        setIsOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, point?.address]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          const address = data.address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          onChange({ lat: latitude, lng: longitude, address });
          setQuery(address);
        } catch {
          onChange({
            lat: latitude,
            lng: longitude,
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          });
        } finally {
          setIsLoading(false);
        }
      },
      () => {
        setIsLoading(false);
        alert("Location permission denied. Please search or pick on map.");
      }
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${colorClass}`}>
            {badgeLabel}
          </span>
          {label}
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            title="Use current GPS location"
            className="p-1 rounded-md text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <Navigation className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onTogglePinMode}
            title={isActivePinMode ? "Cancel pin drop" : "Drop pin on map"}
            className={`px-1.5 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition ${
              isActivePinMode
                ? "bg-amber-500 text-white animate-pulse"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            {isActivePinMode ? "Click Map..." : "Pin"}
          </button>
        </div>
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={`Enter address or landmark for Point ${badgeLabel}...`}
          className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
        />
        <MapPin className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
        {isLoading && (
          <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin absolute right-3 top-3.5" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 max-h-56 overflow-y-auto py-1">
          {suggestions.map((item, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => {
                  onChange({ lat: item.lat, lng: item.lng, address: item.label });
                  setQuery(item.label);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition flex items-start gap-2"
              >
                <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Implement `src/components/SearchForm.tsx`**

Create `src/components/SearchForm.tsx`:
```tsx
"use client";

import React from "react";
import { ArrowUpDown, Search, Store, Sparkles } from "lucide-react";
import { LocationInput } from "./LocationInput";
import { LocationPoint } from "@/types";

const POPULAR_BRANDS = [
  "Starbucks",
  "Suki Tee Noi",
  "Cafe Amazon",
  "McDonald's",
  "Barbeque Plaza",
  "KFC",
  "MK Restaurants",
];

interface SearchFormProps {
  pointA: LocationPoint | null;
  pointB: LocationPoint | null;
  query: string;
  activePinMode: "A" | "B" | null;
  isLoading: boolean;
  onPointAChange: (point: LocationPoint | null) => void;
  onPointBChange: (point: LocationPoint | null) => void;
  onQueryChange: (query: string) => void;
  onTogglePinMode: (mode: "A" | "B") => void;
  onSwapPoints: () => void;
  onSubmit: () => void;
}

export function SearchForm({
  pointA,
  pointB,
  query,
  activePinMode,
  isLoading,
  onPointAChange,
  onPointBChange,
  onQueryChange,
  onTogglePinMode,
  onSwapPoints,
  onSubmit,
}: SearchFormProps) {
  return (
    <div className="p-5 space-y-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
      <div className="space-y-3 relative">
        <LocationInput
          label="Person A's Location"
          badgeLabel="A"
          point={pointA}
          onChange={onPointAChange}
          colorClass="bg-emerald-500"
          isActivePinMode={activePinMode === "A"}
          onTogglePinMode={() => onTogglePinMode("A")}
        />

        <div className="flex justify-center -my-1 relative z-10">
          <button
            type="button"
            onClick={onSwapPoints}
            title="Swap Point A and Point B"
            className="p-1.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm text-zinc-400 hover:text-indigo-600 hover:rotate-180 transition-all duration-300"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <LocationInput
          label="Person B's Location"
          badgeLabel="B"
          point={pointB}
          onChange={onPointBChange}
          colorClass="bg-violet-500"
          isActivePinMode={activePinMode === "B"}
          onTogglePinMode={() => onTogglePinMode("B")}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 mb-1.5">
          <Store className="w-3.5 h-3.5 text-zinc-400" />
          Target Store or Brand
        </label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="e.g. Starbucks, Suki Tee Noi, Coffee..."
            className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
        </div>

        <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[10px] text-zinc-400 shrink-0 flex items-center gap-0.5">
            <Sparkles className="w-3 h-3" /> Quick:
          </span>
          {POPULAR_BRANDS.map((brand) => (
            <button
              key={brand}
              type="button"
              onClick={() => onQueryChange(brand)}
              className={`text-[11px] px-2.5 py-0.5 rounded-full border shrink-0 transition ${
                query.toLowerCase() === brand.toLowerCase()
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-700 dark:text-indigo-300 font-medium"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {brand}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading || !pointA || !pointB || !query.trim()}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Searching Midpoint Branches...
          </>
        ) : (
          <>
            <Search className="w-4 h-4" />
            Find Halfway Branches
          </>
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Implement `src/components/ResultCard.tsx` and `src/components/ResultsList.tsx`**

Create `src/components/ResultCard.tsx`:
```tsx
"use client";

import React from "react";
import { ExternalLink, Navigation, Award, CheckCircle2 } from "lucide-react";
import { ScoredBranch } from "@/lib/geo";

interface ResultCardProps {
  branch: ScoredBranch;
  rank: number;
  isHighlighted: boolean;
  onHover: (id: string | null) => void;
}

export function ResultCard({ branch, rank, isHighlighted, onHover }: ResultCardProps) {
  const isTopMatch = rank === 1;

  return (
    <div
      onMouseEnter={() => onHover(branch.id)}
      onMouseLeave={() => onHover(null)}
      className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
        isHighlighted
          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-md"
          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
              isTopMatch
                ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {rank}
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
              {branch.name}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
              {branch.address}
            </p>
          </div>
        </div>

        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
            branch.fairnessDelta <= 0.5
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
          }`}
        >
          {isTopMatch ? <Award className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
          Fairness: {branch.fairnessScore} km
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-center">
        <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-1.5">
          <div className="text-[10px] text-zinc-400 font-medium">To Person A</div>
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {branch.distA} km
          </div>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-1.5">
          <div className="text-[10px] text-zinc-400 font-medium">To Person B</div>
          <div className="text-xs font-bold text-violet-600 dark:text-violet-400">
            {branch.distB} km
          </div>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-1.5">
          <div className="text-[10px] text-zinc-400 font-medium">Difference</div>
          <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            ±{branch.fairnessDelta} km
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-zinc-400">
          {branch.distMid} km from exact midpoint
        </span>
        <a
          href={branch.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Navigate
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
```

Create `src/components/ResultsList.tsx`:
```tsx
"use client";

import React from "react";
import { ScoredBranch, LatLng } from "@/lib/geo";
import { ResultCard } from "./ResultCard";
import { MapPinOff, Info } from "lucide-react";

interface ResultsListProps {
  branches: ScoredBranch[];
  midpoint: LatLng | null;
  totalDistanceAB: number | null;
  highlightedBranchId: string | null;
  error: string | null;
  onHoverBranch: (id: string | null) => void;
}

export function ResultsList({
  branches,
  midpoint,
  totalDistanceAB,
  highlightedBranchId,
  error,
  onHoverBranch,
}: ResultsListProps) {
  if (error) {
    return (
      <div className="p-5">
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
          {error}
        </div>
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-400 dark:text-zinc-500">
        <MapPinOff className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          No branches displayed yet
        </p>
        <p className="text-[11px] mt-1 text-zinc-400">
          Enter Point A, Point B, and click "Find Halfway Branches".
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      {totalDistanceAB !== null && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px]">
          <div className="flex items-center gap-1.5 font-medium">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>Distance A to B: <strong>{totalDistanceAB} km</strong></span>
          </div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {branches.length} branches found
          </span>
        </div>
      )}

      <div className="space-y-2.5">
        {branches.map((branch, idx) => (
          <ResultCard
            key={branch.id}
            branch={branch}
            rank={idx + 1}
            isHighlighted={highlightedBranchId === branch.id}
            onHover={onHoverBranch}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.tsx src/components/LocationInput.tsx src/components/SearchForm.tsx src/components/ResultCard.tsx src/components/ResultsList.tsx
git commit -m "feat: implement header, location input, search form, and ranked results list"
```

---

### Task 8: Dynamic Dual-Provider Map Component (Leaflet + Google Maps)

**Files:**
- Create:
  - `src/components/map/LeafletMap.tsx`
  - `src/components/map/GoogleMap.tsx`
  - `src/components/map/MapView.tsx`
- Modify: `src/app/globals.css` (include Leaflet CSS CDN / styles)

**Interfaces:**
- Produces: Client-only SSR-disabled interactive map component that seamlessly toggles between Leaflet.js (OSM) and Google Maps JS API with Point A, Point B draggable pins, connecting polyline, midpoint crosshairs, and numbered branch pins.

- [ ] **Step 1: Add Leaflet stylesheet in `src/app/globals.css`**

Ensure `src/app/globals.css` imports or links Leaflet CSS:
```css
@import "tailwindcss";
@import "leaflet/dist/leaflet.css";

/* Marker styling helpers */
.custom-pin {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
}
```

- [ ] **Step 2: Implement `src/components/map/LeafletMap.tsx`**

Create `src/components/map/LeafletMap.tsx`:
```tsx
"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { LocationPoint } from "@/types";
import { ScoredBranch, LatLng } from "@/lib/geo";

interface LeafletMapProps {
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

  // Initialize map instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = pointA?.lat || 13.7563;
    const initialLng = pointA?.lng || 100.5018;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 12,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    map.on("click", (e: L.LeafletMouseEvent) => {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update layers and markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    // Helper to create SVG div icon
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
        onMarkerDrag("A", { lat: pos.lat, lng: pos.lng });
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
        onMarkerDrag("B", { lat: pos.lat, lng: pos.lng });
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
          `<a href="${b.googleMapsUrl}" target="_blank" style="color: #4f46e5; text-decoration: underline;">Open Directions</a>`
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
      className={`w-full h-full relative z-0 ${activePinMode ? "cursor-crosshair" : ""}`}
    />
  );
}
```

- [ ] **Step 3: Implement `src/components/map/GoogleMap.tsx`**

Create `src/components/map/GoogleMap.tsx`:
```tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { LocationPoint } from "@/types";
import { ScoredBranch, LatLng } from "@/lib/geo";

interface GoogleMapProps {
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
  onMapClick,
  onMarkerDrag,
  onFallbackToOsm,
}: GoogleMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!apiKey) {
      onFallbackToOsm();
      return;
    }

    const scriptId = "google-maps-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.onload = () => setIsLoaded(true);
      script.onerror = () => {
        alert("Failed to load Google Maps script. Switching back to OpenStreetMap.");
        onFallbackToOsm();
      };
      document.head.appendChild(script);
    } else {
      setIsLoaded(true);
    }
  }, [apiKey]);

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
      onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    });

    mapInstanceRef.current = map;
  }, [isLoaded]);

  return (
    <div
      ref={mapContainerRef}
      className={`w-full h-full relative z-0 ${activePinMode ? "cursor-crosshair" : ""}`}
    />
  );
}
```

- [ ] **Step 4: Implement `src/components/map/MapView.tsx` (Dynamic SSR: false wrapper)**

Create `src/components/map/MapView.tsx`:
```tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";
import { LocationPoint, MapProvider } from "@/types";
import { ScoredBranch, LatLng } from "@/lib/geo";

const LeafletMap = dynamic(
  () => import("./LeafletMap").then((mod) => mod.LeafletMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 animate-pulse flex items-center justify-center text-xs text-zinc-400">Loading Map...</div> }
);

const GoogleMap = dynamic(
  () => import("./GoogleMap").then((mod) => mod.GoogleMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 animate-pulse flex items-center justify-center text-xs text-zinc-400">Loading Google Maps...</div> }
);

interface MapViewProps {
  provider: MapProvider;
  googleMapsApiKey: string;
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

export function MapView(props: MapViewProps) {
  if (props.provider === "google" && props.googleMapsApiKey) {
    return (
      <GoogleMap
        apiKey={props.googleMapsApiKey}
        pointA={props.pointA}
        pointB={props.pointB}
        midpoint={props.midpoint}
        branches={props.branches}
        activePinMode={props.activePinMode}
        highlightedBranchId={props.highlightedBranchId}
        onMapClick={props.onMapClick}
        onMarkerDrag={props.onMarkerDrag}
        onFallbackToOsm={props.onFallbackToOsm}
      />
    );
  }

  return (
    <LeafletMap
      pointA={props.pointA}
      pointB={props.pointB}
      midpoint={props.midpoint}
      branches={props.branches}
      activePinMode={props.activePinMode}
      highlightedBranchId={props.highlightedBranchId}
      onMapClick={props.onMapClick}
      onMarkerDrag={props.onMarkerDrag}
    />
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/map/ src/app/globals.css
git commit -m "feat: implement dual-provider MapView with Leaflet and Google Maps"
```

---

### Task 9: Main Page Assembly & Verification

**Files:**
- Modify: `src/app/page.tsx`
- Test: All tests passing with `bun test`, clean build with `bun run build`.

**Interfaces:**
- Produces: Complete working Halfway Finder application accessible on `localhost:3000`.

- [ ] **Step 1: Implement `src/app/page.tsx`**

Replace `src/app/page.tsx`:
```tsx
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <Header
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Search / Results Sidebar */}
        <div className="w-full md:w-[420px] md:min-w-[380px] h-[50vh] md:h-full flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 overflow-hidden shadow-lg md:shadow-none">
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
```

- [ ] **Step 2: Run all unit and integration tests**

Run: `bun test`
Expected: PASS (All test suites pass)

- [ ] **Step 3: Run production build check**

Run: `bun run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: assemble split-layout Halfway Finder page with responsive UI"
```
