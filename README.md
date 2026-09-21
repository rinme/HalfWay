# HalfWay 📍

> **A smart, full-stack web application designed to help two people find optimal venue or brand branches (e.g. Starbucks, Suki Tee Noi, Cafe Amazon) located fairly midway between their two locations.**

---

## ✨ Features

- 🎯 **Fairness-Weighted Branch Ranking**: Evaluates candidate venue branches using travel fairness math:
  $$\text{Fairness Score} = (d_A + d_B) + 2 \times |d_A - d_B|$$
  Penalizes total travel distance while heavily penalizing travel disparity, prioritizing the most equitable meeting spot.
- 🗺️ **Dynamic Dual-Provider Map (SSR-Disabled)**:
  - **Free Tier (Default, No Key Needed)**: Leaflet.js with OpenStreetMap (OSM) standard tiles, Nominatim geocoding, and Overpass API POI search.
  - **Google Maps Tier**: Seamlessly switchable dynamically in-browser when providing an optional Google Maps API Key (`localStorage` stored).
- 📍 **Interactive Location Controls**:
  - Point A and Point B address search with 350ms debounced suggestions.
  - "Use My Current Location" browser GPS button.
  - "Pin on Map" cursor drop mode and draggable pins with real-time reverse geocoding.
  - One-click "Swap Point A & B" toggle.
- 🏬 **Adaptive Search Radius (3–10 km)**:
  - Single-query 10 km bounding search with automatic tiering (primary $\le 3\text{ km}$, extended $3-10\text{ km}$).
  - Quick-select chips for popular brands (Starbucks, Suki Tee Noi, Cafe Amazon, McDonald's, Barbeque Plaza).
- 🔗 **Shareable URL Synchronization**:
  - Live synchronization of coordinates and query in URL search parameters (`?a_lat=...&b_lat=...&q=...`).
  - One-click "Share Search" button to copy the link for friends.
- 🚗 **Direct Navigation Links**:
  - Instant "Open in Google Maps" turn-by-turn directions links on every result card.
- 🛡️ **Multi-Mirror Overpass Failover & LRU Caching**:
  - In-memory backend LRU caching with TTL for Nominatim queries.
  - 3-tier mirror failover (`overpass-api.de` $\rightarrow$ `lz4` $\rightarrow$ `kumi.systems`) with 8s abort timeouts.

---

## 🛠️ Architecture & Tech Stack

```
                     ┌─────────────────────────────────────────────────────┐
                     │            Next.js App Router (Bun Runtime)          │
                     │                                                     │
                     │  ┌───────────────────────┐  ┌────────────────────┐  │
                     │  │   Frontend UI (React) │  │ Elysia.js Backend  │  │
                     │  │  - Collapsible Panel  │  │  Route Handler     │  │
                     │  │  - Search & Inputs    │  │  app/api/[[...]]/  │  │
                     │  │  - Results & Fairness │  │  route.ts          │  │
                     │  │  - Dual-Provider Map  │  │                    │  │
                     │  └───────────┬───────────┘  └─────────┬──────────┘  │
                     └──────────────┼────────────────────────┼─────────────┘
                                    │                        │
               ┌────────────────────┴──────────┐   ┌─────────┴──────────────┐
               │ Client Map Layer (SSR: false) │   │ External Services      │
               │ - Leaflet.js + OSM (Default)  │   │ - Nominatim (Geocoding)│
               │ - Google Maps JS (If Key set) │   │ - Overpass API POIs    │
               │                               │   │ - Google Geocoding     │
               │                               │   │ - Google Places API    │
               └───────────────────────────────┘   └────────────────────────┘
```

- **Runtime & Package Manager**: [Bun](https://bun.sh/)
- **Frontend Framework**: [Next.js 16](https://nextjs.org/) (App Router, React 19, TypeScript)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **Backend API**: [Elysia.js](https://elysiajs.com/) mounted directly in Next.js App Router (`src/app/api/[[...slugs]]/route.ts`)
- **Mapping**: [Leaflet.js](https://leafletjs.com/) / OpenStreetMap + Google Maps JavaScript API

---

## 🚀 Getting Started

### Prerequisites

Ensure you have **Bun** installed (`>= 1.3.0`):
```bash
curl -fsSL https://bun.sh/install | bash
```

### Installation

Clone the repository and install dependencies:
```bash
git clone https://github.com/rinme/HalfWay.git
cd HalfWay
bun install
```

### Running Locally

Start the development server:
```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

Run the comprehensive unit and integration test suite:
```bash
bun test
```

Typecheck and build for production:
```bash
bun x tsc --noEmit
bun run build
```

---

## 📡 API Reference (Elysia.js)

### 1. `GET /api/health`
Health check endpoint returning server status and timestamp.

### 2. `GET /api/geocode?q={query}&provider={osm|google}&key={key?}`
Forward geocodes an address query using OpenStreetMap Nominatim or Google Geocoding.

### 3. `GET /api/reverse-geocode?lat={lat}&lng={lng}&provider={osm|google}&key={key?}`
Reverse geocodes coordinate pairs to human-readable address labels.

### 4. `POST /api/search-midpoint`
Searches for candidate branches around the geographic midpoint and ranks them by travel fairness.

**Payload:**
```json
{
  "pointA": { "lat": 13.7563, "lng": 100.5018 },
  "pointB": { "lat": 13.7223, "lng": 100.5284 },
  "query": "Starbucks",
  "apiKey": "optional-google-key",
  "preferredProvider": "osm"
}
```

---

## 📄 License

MIT
