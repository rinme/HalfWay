# HalfWay v2 - Multi-Person, Server-Sided Google Key & Temporary Share Codes Design Specification

- **Date:** 2026-09-21
- **Status:** Approved
- **Topic:** Multi-participant ($N$ people), server-side default Google Maps API key, Vercel deployment, and expiring short share codes (24h to 7d).

---

## 1. Executive Summary

This specification expands **HalfWay** to support:
1. **Zero-Config Google Maps via Environment Variables**: Reads `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` from `.env` / Vercel configuration, making Google Maps the default provider for all users without requiring client-side API key inputs, while retaining graceful OpenStreetMap / Leaflet fallback if no key is defined.
2. **Vercel Serverless Production Readiness**: Self-contained Next.js 16 App Router route handlers with zero hardcoded ports or local origins, clean environment variable configuration, and `.env.example`.
3. **Multi-Participant Support ($N$ People)**: Expanding from 2 fixed points to 2–8 participants. Users can add participants, remove participants (minimum 2), rename participants in-place (e.g. "Alice", "Bob", "Charlie"), and customize/drag their individual pins on the map.
4. **Generalized Midpoint & Travel Fairness Scoring**:
   - Geodesic centroid midpoint calculation:
     $$\text{lat}_{mid} = \frac{1}{N} \sum_{i=1}^N \text{lat}_i, \quad \text{lng}_{mid} = \frac{1}{N} \sum_{i=1}^N \text{lng}_i$$
   - Generalized fairness score:
     $$\text{Fairness Score} = \sum_{i=1}^N d_i + 2 \times (\max(d_i) - \min(d_i))$$
     Identically simplifies to $(d_1 + d_2) + 2|d_1 - d_2|$ for $N = 2$, and scales cleanly for larger groups.
5. **Temporary Short Share Codes (24h–7d)**:
   - Dedicated sharing API (`POST /api/share`, `GET /api/share?code={code}`) generating 6-character short codes (e.g., `https://halfway.app/?s=x7K9pQ`).
   - Stores the complete search snapshot (participants, coordinates, custom names, target query) with configurable expiration (24h default, 3d, 7d max).
   - Hybrid persistence: In-memory TTL cache with support for Upstash Redis / Vercel KV environment variables when running serverless on Vercel.
   - Backward compatibility for direct coordinate URLs (`?a_lat=...&b_lat=...` and `?persons=...`).

---

## 2. Architecture & Data Models

### 2.1 Participant Data Model
```typescript
export interface Person {
  id: string;
  name: string;      // e.g. "Alice", "Bob", "Charlie"
  address: string;
  lat: number;
  lng: number;
  color: string;     // Color theme: Emerald, Violet, Sky, Amber, Rose, Indigo, Teal, Orange
}
```

Standard color palette for up to 8 participants:
- 1: `#10b981` (Emerald)
- 2: `#8b5cf6` (Violet)
- 3: `#0284c7` (Sky Blue)
- 4: `#f59e0b` (Amber)
- 5: `#f43f5e` (Rose)
- 6: `#6366f1` (Indigo)
- 7: `#0d9488` (Teal)
- 8: `#ea580c` (Orange)

### 2.2 Scored Branch Model for $N$ People
```typescript
export interface PersonDistance {
  personId: string;
  name: string;
  distance: number;
}

export interface ScoredBranch {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distances: PersonDistance[]; // Distance from each person to this branch
  distMid: number;             // Distance from centroid midpoint
  fairnessScore: number;       // Sum(d_i) + 2 * (max - min)
  spread: number;              // max(d_i) - min(d_i)
  tier: "primary" | "extended";
  googleMapsUrl: string;
}
```

### 2.3 Temporary Share Code Model
```typescript
export interface SharedSearchPayload {
  code: string;
  createdAt: number;
  expiresAt: number;
  query: string;
  persons: Person[];
}
```

---

## 3. Backend API Specifications (Elysia.js)

### 3.1 `POST /api/search-midpoint`
- **Request Body:**
  ```json
  {
    "persons": [
      { "id": "p1", "name": "Alice", "address": "Siam, Bangkok", "lat": 13.7469, "lng": 100.5393 },
      { "id": "p2", "name": "Bob", "address": "Silom, Bangkok", "lat": 13.7223, "lng": 100.5284 },
      { "id": "p3", "name": "Charlie", "address": "Sukhumvit, Bangkok", "lat": 13.7383, "lng": 100.5604 }
    ],
    "query": "Starbucks",
    "apiKey": "optional-override-key",
    "preferredProvider": "google" // or "osm"
  }
  ```
- **API Key Resolution:**
  1. If `apiKey` provided in body, use it.
  2. Else if `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` or `process.env.GOOGLE_MAPS_API_KEY` is present, use it.
  3. Else fall back to OpenStreetMap Overpass API.
- **Midpoint:** Centroid coordinate $(\frac{1}{N}\sum \text{lat}_i, \frac{1}{N}\sum \text{lng}_i)$.
- **Candidate Retrieval:** 10 km bounding search around centroid via Google Places API or Overpass multi-mirror.
- **Scoring & Sorting:** Evaluates each candidate's distance to every person, computes $\text{Fairness Score} = \sum d_i + 2 \times (\max(d_i) - \min(d_i))$, and sorts ascending.

### 3.2 `POST /api/share`
- **Request Body:**
  ```json
  {
    "persons": [...],
    "query": "Starbucks",
    "expiresInHours": 24 // 24 (default), 72 (3 days), 168 (7 days)
  }
  ```
- **Logic:**
  - Validates `expiresInHours` (between 1 and 168 hours; default 24).
  - Generates a cryptographically secure 6-character alphanumeric code (e.g. `x7K9pQ`).
  - Stores the payload with `expiresAt = Date.now() + expiresInHours * 3600 * 1000`.
  - Storage adapter:
    - If `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` are set: saves via Redis `SETEX`.
    - Else: saves in server in-memory TTL store.
- **Response Format:**
  ```json
  {
    "success": true,
    "code": "x7K9pQ",
    "expiresAt": 1790000000000,
    "shareUrl": "https://halfway.app/?s=x7K9pQ"
  }
  ```

### 3.3 `GET /api/share?code={code}`
- **Logic:**
  - Retrieves shared search data by code.
  - Verifies `Date.now() <= expiresAt`. If expired, removes entry and returns 404 with `{ success: false, error: "Share link has expired" }`.
- **Response Format:**
  ```json
  {
    "success": true,
    "data": {
      "query": "Starbucks",
      "persons": [...]
    }
  }
  ```

---

## 4. Frontend UI & UX Enhancements

### 4.1 Search Form & Participant List
- **Participant Cards:**
  - Color badge with number/initial and person's name.
  - Inline editable name: Click the pencil icon or name text to rename (e.g. "Alice").
  - Address autocomplete input with 350ms debounce and GPS button.
  - "Pin on Map" targeting toggle per participant.
  - Trash icon to remove participant (active when participants $> 2$).
- **Action Buttons:**
  - "+ Add Person" button (disabled when at max 8 participants).
  - Quick brand chips (Starbucks, Suki Tee Noi, Cafe Amazon, etc.).
  - "Find Halfway Branches" submit button.

### 4.2 Interactive Map (Leaflet & Google Maps)
- **$N$ Person Pins:** Color-coded circular markers with person's initial or number. Draggable to update coordinates in real time.
- **Hub-and-Spoke Lines:** Semi-transparent dashed lines connecting each person's marker directly to the calculated centroid midpoint.
- **Midpoint Pin:** Distinct target badge with 3 km primary radius circle and 10 km outer circle.
- **Branch Pins:** Ranked numbered pins (`#1`, `#2`, ...). Clicking opens popup showing distances to all participants.
- **Single-click pin mode:** Clicking the map when a person's "Pin on Map" mode is active places their pin, reverse-geocodes their address, and turns off targeting mode.

### 4.3 Result Cards
- **Rank Badge & Name**: `#1 Most Balanced`, venue name, address.
- **Fairness Metrics**:
  - `Fairness Score: X.X km` badge.
  - `Travel Disparity: ±Y.Y km` (difference between furthest and nearest traveler).
- **Responsive Participant Grid**:
  - Displays each participant's name, their assigned color dot, and their individual travel distance (e.g. `Alice: 2.3 km`, `Bob: 2.1 km`, `Charlie: 2.8 km`).
- **Google Maps Navigation**: External link for turn-by-turn directions.

### 4.4 Share Modal & Link Expiration
- Clicking "Share" in the header opens a Share Modal:
  - Expiration selector:
    - `24 Hours (Default)`
    - `3 Days`
    - `7 Days (1 Week)`
  - "Generate Link" button that creates the short link (e.g. `https://halfway.app/?s=x7K9pQ`).
  - Copy to clipboard button with live feedback ("Copied!").

---

## 5. Vercel Deployment & Environment Configuration

- **Environment File (`.env.example`)**:
  ```env
  # Google Maps API Key (Used by both client-side map script and server-side geocoding/places)
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...

  # (Optional) Upstash Redis for persistent serverless share codes across Vercel regions
  UPSTASH_REDIS_REST_URL=https://...upstash.io
  UPSTASH_REDIS_REST_TOKEN=...
  ```
- **Settings Modal Update**:
  - If `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is present, the modal displays: "Server Default Key Active (Google Maps)".
  - Users can still manually toggle to OpenStreetMap or supply a custom API key override.
  - If no environment key is supplied, defaults cleanly to OpenStreetMap.
