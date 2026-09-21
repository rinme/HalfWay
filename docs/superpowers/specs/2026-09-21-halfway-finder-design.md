# Halfway Finder - Technical Design Specification

- **Date:** 2026-09-21
- **Status:** Approved
- **Topic:** Halfway Finder - Full-stack branch & venue midpoint finder

---

## 1. Executive Summary

"Halfway Finder" is a full-stack web application designed to help two people find optimal venue or brand branches (e.g., "Starbucks", "Suki Tee Noi", "Cafe Amazon") located fairly midway between their two respective starting locations.

The system uses a single-port Next.js App Router setup running on the Bun runtime, hosting an integrated Elysia.js API route handler. It features a dynamic dual-provider map architecture that operates completely free with Leaflet.js + OpenStreetMap (OSM) / Nominatim / Overpass API by default, while supporting seamless client-side switching to the Google Maps JavaScript API, Google Geocoding, and Google Places when a user provides an optional Google Maps API Key.

---

## 2. System Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │           Next.js App (Bun Runtime)          │
                               │                                              │
                               │  ┌────────────────────┐ ┌──────────────────┐ │
                               │  │ React Frontend     │ │ Elysia.js Engine │ │
                               │  │ - Split Layout     │ │ (Route Handler)  │ │
                               │  │ - Address Auto-    │ │ app/api/         │ │
                               │  │   complete         │ │ [[...slugs]]/    │ │
                               │  │ - Map Controller   │ │ route.ts         │ │
                               │  │ - Results & Cards  │ │                  │ │
                               │  └─────────┬──────────┘ └────────┬─────────┘ │
                               └────────────┼─────────────────────┼───────────┘
                                            │                     │
                     ┌──────────────────────┴──────┐      ┌───────┴───────────────┐
                     │ Client Map Layer (SSR: false)│      │ External Services     │
                     │ - Default: Leaflet + OSM    │      │ - Nominatim Geocoding │
                     │ - Enhanced: Google Maps JS  │      │ - Overpass POI API    │
                     │   (via localStorage key)    │      │ - Google Geocoding    │
                     │                             │      │ - Google Places API   │
                     └─────────────────────────────┘      └───────────────────────┘
```

### 2.1 Technology Stack
- **Runtime:** Bun (`>= 1.3.0`)
- **Web Framework:** Next.js 15 (App Router, React 19, TypeScript)
- **Styling:** Tailwind CSS + Lucide Icons
- **Backend Framework:** Elysia.js (`elysia`) mounted directly into `src/app/api/[[...slugs]]/route.ts` via `app.handle`
- **Mapping & GIS:**
  - `leaflet` + `@types/leaflet` (dynamically loaded on client)
  - Google Maps JavaScript API (dynamically loaded via script tag on client when API key is present)
- **Math / Geography:** Great-circle Haversine formula implemented in TypeScript for zero external dependency runtime calculation.

---

## 3. Core Algorithms & Logic

### 3.1 Midpoint Computation
Given Point A $(\text{lat}_A, \text{lng}_A)$ and Point B $(\text{lat}_B, \text{lng}_B)$:
$$\text{lat}_{mid} = \frac{\text{lat}_A + \text{lat}_B}{2}, \quad \text{lng}_{mid} = \frac{\text{lng}_A + \text{lng}_B}{2}$$

### 3.2 Haversine Distance Formula
For any two coordinates $(\phi_1, \lambda_1)$ and $(\phi_2, \lambda_2)$ in radians:
$$\Delta\phi = \phi_2 - \phi_1, \quad \Delta\lambda = \lambda_2 - \lambda_1$$
$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)$$
$$d = R \cdot c \quad (\text{where } R = 6371\text{ km})$$

### 3.3 Travel Fairness Scoring
For any candidate branch $V$, the distance to Point A is $d_A = \text{haversine}(A, V)$ and the distance to Point B is $d_B = \text{haversine}(B, V)$:
$$\text{Fairness Score} = (d_A + d_B) + 2 \times |d_A - d_B|$$
- **Lower score is strictly better.**
- The score penalizes the total sum of travel distance while placing a double-weight penalty on any disparity between the two participants, prioritizing venues that are truly equitable.

### 3.4 Adaptive Search Radius (3–10 km)
- The backend queries candidate branches within a 10 km bounding circle around the midpoint in a single API call.
- Results are partitioned into two distance tiers relative to the midpoint:
  - **Tier 1 (Primary):** $d_{mid} \le 3.0\text{ km}$
  - **Tier 2 (Extended):** $3.0\text{ km} < d_{mid} \le 10.0\text{ km}$
- If Tier 1 contains at least 3 branches, the app highlights Tier 1 results. If fewer than 3 branches are in Tier 1, the app automatically incorporates Tier 2 branches to ensure the users always have viable options.

---

## 4. Backend API Endpoints (Elysia.js)

Mounted under `/api/*` inside Next.js.

### 4.1 `GET /api/geocode`
- **Query Parameters:**
  - `q` (string, required): Search query or address string.
  - `provider` (string, optional: `'osm' | 'google'`, default `'osm'`).
  - `key` (string, optional): Google Maps API key if `provider === 'google'`.
- **Logic:**
  - If `provider === 'osm'`: Calls Nominatim API (`https://nominatim.openstreetmap.org/search?format=json&q={query}&limit=5`). Uses a dedicated `User-Agent: HalfwayFinder/1.0` and caches results in an in-memory 200-entry LRU cache with a 30-minute TTL.
  - If `provider === 'google'`: Calls Google Geocoding API (`https://maps.googleapis.com/maps/api/geocode/json?address={query}&key={key}`).
- **Response Format:**
  ```json
  {
    "success": true,
    "results": [
      {
        "label": "CentralWorld, Rama I Rd, Pathum Wan, Bangkok 10330",
        "lat": 13.7469,
        "lng": 100.5393
      }
    ]
  }
  ```

### 4.2 `GET /api/reverse-geocode`
- **Query Parameters:**
  - `lat` (number, required)
  - `lng` (number, required)
  - `provider` (string, optional: `'osm' | 'google'`, default `'osm'`)
  - `key` (string, optional)
- **Logic:**
  - Reverse geocodes coordinates to human-readable address string when clicking on the map or dragging pins.

### 4.3 `POST /api/search-midpoint`
- **Request Body:**
  ```json
  {
    "pointA": { "lat": 13.7563, "lng": 100.5018 },
    "pointB": { "lat": 13.7223, "lng": 100.5284 },
    "query": "Starbucks",
    "apiKey": "optional-key",
    "preferredProvider": "osm"
  }
  ```
- **Venue Retrieval (OSM / Overpass):**
  - Query targets nodes, ways, and relations within 10,000m radius of midpoint matching:
    ```overpass
    [out:json][timeout:15];
    (
      node(around:10000,lat_mid,lng_mid)[~"^(name|brand|operator)$"~"Starbucks",i];
      way(around:10000,lat_mid,lng_mid)[~"^(name|brand|operator)$"~"Starbucks",i];
    );
    out center tags;
    ```
  - **Multi-mirror Failover:** Attempts primary mirror `https://overpass-api.de/api/interpreter`. If timeout (8s) or HTTP 429/504 occurs, automatically retries against `https://lz4.overpass-api.de/api/interpreter` then `https://overpass.kumi.systems/api/interpreter`.
- **Venue Retrieval (Google Places):**
  - If `preferredProvider === 'google'` and `apiKey` is provided: Calls Google Places API Nearby Search / Text Search centered at midpoint with `radius=10000` and keyword `{query}`.
- **Post-Processing:**
  - Computes $d_A$, $d_B$, $d_{mid}$, and $\text{Fairness Score}$ for each candidate.
  - Sorts ascending by Fairness Score.
  - Attaches navigation URL: `https://www.google.com/maps/dir/?api=1&origin={latA},{lngA}&destination={latBranch},{lngBranch}`.
- **Response Format:**
  ```json
  {
    "success": true,
    "midpoint": { "lat": 13.7393, "lng": 100.5151 },
    "totalDistanceAB": 5.42,
    "radiusUsedKm": 10,
    "branches": [
      {
        "id": "osm-node-123456",
        "name": "Starbucks Siam Paragon",
        "address": "Rama I Rd, Bangkok",
        "lat": 13.7462,
        "lng": 100.5348,
        "distA": 2.85,
        "distB": 2.71,
        "distMid": 1.05,
        "fairnessScore": 5.84,
        "fairnessDelta": 0.14,
        "tier": "primary",
        "googleMapsUrl": "https://www.google.com/maps/dir/?api=1..."
      }
    ]
  }
  ```

---

## 5. Frontend UI & Component Specifications

### 5.1 Layout & Structure
- **Responsive Split View:**
  - **Desktop:** 420px fixed/resizable sidebar on the left, full-screen map taking up remaining viewport on the right.
  - **Mobile:** Collapsible bottom drawer / tab view switching between search/results and full map.
- **Header:**
  - Title: "Halfway Finder" with subtle midpoint icon.
  - Provider Status Pill: "OpenStreetMap (Free)" or "Google Maps Active".
  - Settings Modal Trigger button (Gear icon).
  - Share Link button (copies active search URL with params).

### 5.2 Search Panel Components
1. **Location Inputs (Point A & Point B):**
   - Text input with 350ms debounced address suggestions dropdown.
   - GPS icon button: Triggers `navigator.geolocation.getCurrentPosition` to set coordinates instantly.
   - Crosshair / Map Pin icon button: Activates "Set on Map" cursor mode.
   - Swap button: Interchanges Point A and Point B with an animated swap icon.
2. **Target Brand Input:**
   - Text input (e.g., "Suki Tee Noi", "Starbucks", "Barbeque Plaza").
   - Quick Brand Pills: Pre-populated tags for one-click popular venue selection.
3. **Submit Button:**
   - "Find Halfway Venues" with loading spinner and disabled state when inputs are incomplete.

### 5.3 Results List Components
- **Summary Banner:**
  - Displays total distance between Point A and Point B and midpoint coordinates.
  - Count of branches found (e.g. "Found 8 branches within 10 km").
- **Ranked Result Cards:**
  - Rank Badge (e.g., `#1 Most Balanced`).
  - Branch Name & Address.
  - Distance metrics: `To A: 2.8 km` | `To B: 2.7 km` | `Diff: 0.14 km`.
  - Fairness score indicator pill with color coding (Green for highly balanced, Amber for moderate difference).
  - "Open in Google Maps" direct link button (opens navigation in a new tab).
  - Hover / Click on card: Centers map on branch marker and opens its popup.

### 5.4 Map Component (Dual Provider)
- Dynamically imported with `ssr: false`.
- **Leaflet Provider:**
  - Uses `L.map`, `L.tileLayer` (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`).
  - Custom SVG markers:
    - Point A: Emerald marker with label "A" (Draggable).
    - Point B: Violet marker with label "B" (Draggable).
    - Midpoint: Red crosshair icon with dashed circular overlays (3 km primary, 10 km outer).
    - Branches: Numbered location pins (`#1`, `#2`, ...).
  - Polylines: Dashed geodesic line connecting Point A, Midpoint, and Point B.
- **Google Maps Provider:**
  - Mounted when Google Maps API script is loaded.
  - Equivalent pins, polyline, and circle overlays using Google Maps JS API primitives.
- **Auto-fit bounds:** Map automatically pans and zooms to frame Point A, Point B, and all discovered branch pins.

### 5.5 Settings Modal
- Stored in `localStorage` under keys:
  - `halfway_google_maps_key`
  - `halfway_active_provider` (`'osm' | 'google'`)
- Allows user to test the key with a sample geocode query.
- Instant fallback switch to OpenStreetMap without losing current search state.

---

## 6. URL Query State Sync
The following URL query parameters synchronize search state to enable one-click sharing:
- `a_lat`: Latitude for Point A
- `a_lng`: Longitude for Point A
- `a_name`: Display address for Point A
- `b_lat`: Latitude for Point B
- `b_lng`: Longitude for Point B
- `b_name`: Display address for Point B
- `q`: Target brand/store query

On initial page load, if query parameters are present, the app automatically pre-fills the inputs and executes the search.

---

## 7. Error Handling & Resilience

1. **Overpass Timeouts / Rate Limits:**
   - 3-tier mirror failover (`overpass-api.de` $\rightarrow$ `lz4` $\rightarrow$ `kumi.systems`).
   - If all external mirrors fail or return 0 results, the user receives an informative message with suggestions (e.g., trying a broader keyword or adjusting locations).
2. **Nominatim 1-req/sec Policy:**
   - 350ms input debouncing on client.
   - In-memory backend LRU cache preventing duplicate upstream calls.
   - Required standard `User-Agent` header set on all outgoing requests.
3. **Invalid Google Maps Key:**
   - Catches `gm_authFailure` or API error responses.
   - Displays a non-blocking toast warning: "Invalid Google Maps API Key. Falling back to OpenStreetMap."
   - Automatically switches map view back to Leaflet.
4. **Geolocation Denial:**
   - Catches browser location permission denial and prompts user to type an address or drop a pin directly on the map.

---

## 8. Verification & Testing Strategy

1. **Unit Tests (Bun Test):**
   - `haversine`: Accuracy of distance calculation between known landmarks (e.g., Suvarnabhumi Airport to Don Mueang Airport).
   - `midpoint`: Correct coordinate calculation for various coordinate quadrants.
   - `fairnessScore`: Correct formula implementation $(d_A + d_B) + 2|d_A - d_B|$ and ordering logic.
2. **Integration Tests:**
   - `GET /api/geocode`: Returns valid JSON coordinates for standard addresses.
   - `POST /api/search-midpoint`: Returns sorted branches with required attributes and fairness scores.
3. **E2E & UI Verification:**
   - Single-command startup (`bun run dev`).
   - Verification of Leaflet map rendering, pin placement, draggable update, and card hover interactions.
