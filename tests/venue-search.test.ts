import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { fetchOverpassVenues, OVERPASS_MIRRORS } from "../src/lib/overpass";
import { fetchGooglePlaces, searchMidpointVenues } from "../src/lib/venue-search";
import type { LatLng } from "../src/lib/geo";

describe("Venue Search Service", () => {
  const pointA: LatLng = { lat: 13.7563, lng: 100.5018 };
  const pointB: LatLng = { lat: 13.7223, lng: 100.5284 };
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("searchMidpointVenues", () => {
    it("handles empty venue results without crashing", async () => {
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ elements: [] }), { status: 200 });
      }) as any;

      const result = await searchMidpointVenues({
        pointA,
        pointB,
        query: "nonexistent_super_rare_store_12345",
      });

      expect(result.midpoint).toBeDefined();
      expect(result.totalDistanceAB).toBeGreaterThan(0);
      expect(Array.isArray(result.branches)).toBe(true);
      expect(result.branches.length).toBe(0);
      expect(result.radiusUsedKm).toBe(10);
    });

    it("computes accurate midpoint and total distance", async () => {
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ elements: [] }), { status: 200 });
      }) as any;

      const result = await searchMidpointVenues({
        pointA,
        pointB,
        query: "cafe",
      });

      expect(result.midpoint.lat).toBeCloseTo(13.7393, 3);
      expect(result.midpoint.lng).toBeCloseTo(100.5151, 3);
      expect(result.totalDistanceAB).toBeCloseTo(4.76, 1);
    });

    it("scores and ranks returned branches ascending by fairness score", async () => {
      const mockOverpassData = {
        elements: [
          {
            type: "node",
            id: 101,
            lat: 13.755,
            lon: 100.502, // Near Point A (unfair to B)
            tags: { name: "Branch Near A" },
          },
          {
            type: "node",
            id: 102,
            lat: 13.7393,
            lon: 100.5151, // Exactly at Midpoint (fairest)
            tags: { name: "Branch Midpoint" },
          },
        ],
      };

      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(mockOverpassData), { status: 200 });
      }) as any;

      const result = await searchMidpointVenues({
        pointA,
        pointB,
        query: "Starbucks",
      });

      expect(result.branches.length).toBe(2);
      expect(result.branches[0].name).toBe("Branch Midpoint");
      expect(result.branches[0].tier).toBe("primary");
      expect(result.branches[0].fairnessScore).toBeLessThan(result.branches[1].fairnessScore);
      expect(result.branches[0].googleMapsUrl).toContain("https://www.google.com/maps/dir/");
    });

    it("uses Google Places when preferredProvider is google and apiKey is provided", async () => {
      const mockGooglePlaces = {
        status: "OK",
        results: [
          {
            place_id: "google-place-123",
            name: "Starbucks Reserve Bangkok",
            vicinity: "Siam Paragon, Rama I Rd",
            geometry: {
              location: {
                lat: 13.7462,
                lng: 100.5347,
              },
            },
          },
        ],
      };

      let fetchedUrl = "";
      globalThis.fetch = (async (url: string | URL | Request) => {
        fetchedUrl = url.toString();
        return new Response(JSON.stringify(mockGooglePlaces), { status: 200 });
      }) as any;

      const result = await searchMidpointVenues({
        pointA,
        pointB,
        query: "Starbucks",
        apiKey: "test-google-key-xyz",
        preferredProvider: "google",
      });

      expect(fetchedUrl).toContain("maps.googleapis.com/maps/api/place/nearbysearch/json");
      expect(fetchedUrl).toContain("key=test-google-key-xyz");
      expect(fetchedUrl).toContain("keyword=Starbucks");
      expect(result.branches.length).toBe(1);
      expect(result.branches[0].id).toBe("google-google-place-123");
      expect(result.branches[0].name).toBe("Starbucks Reserve Bangkok");
      expect(result.branches[0].address).toBe("Siam Paragon, Rama I Rd");
    });

    it("falls back to Overpass when Google Places returns empty results", async () => {
      let callCount = 0;
      globalThis.fetch = (async (url: string | URL | Request) => {
        callCount++;
        const urlStr = url.toString();
        if (urlStr.includes("maps.googleapis.com")) {
          return new Response(JSON.stringify({ status: "ZERO_RESULTS", results: [] }), {
            status: 200,
          });
        }
        // Overpass fallback response
        return new Response(
          JSON.stringify({
            elements: [
              {
                type: "node",
                id: 999,
                lat: 13.7393,
                lon: 100.5151,
                tags: { name: "OSM Midpoint Cafe" },
              },
            ],
          }),
          { status: 200 }
        );
      }) as any;

      const result = await searchMidpointVenues({
        pointA,
        pointB,
        query: "Cafe",
        apiKey: "test-key",
        preferredProvider: "google",
      });

      expect(callCount).toBe(2);
      expect(result.branches.length).toBe(1);
      expect(result.branches[0].id).toBe("osm-node-999");
      expect(result.branches[0].name).toBe("OSM Midpoint Cafe");
    });

    it("falls back to Overpass when Google Places network request throws", async () => {
      globalThis.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("maps.googleapis.com")) {
          throw new Error("Network error contacting Google Places");
        }
        return new Response(
          JSON.stringify({
            elements: [
              {
                type: "node",
                id: 888,
                lat: 13.7393,
                lon: 100.5151,
                tags: { name: "OSM Backup Cafe" },
              },
            ],
          }),
          { status: 200 }
        );
      }) as any;

      const result = await searchMidpointVenues({
        pointA,
        pointB,
        query: "Cafe",
        apiKey: "test-key",
        preferredProvider: "google",
      });

      expect(result.branches.length).toBe(1);
      expect(result.branches[0].id).toBe("osm-node-888");
      expect(result.branches[0].name).toBe("OSM Backup Cafe");
    });
  });

  describe("fetchOverpassVenues", () => {
    const midpoint: LatLng = { lat: 13.7393, lng: 100.5151 };

    it("returns empty array for empty or whitespace query without network call", async () => {
      let called = false;
      globalThis.fetch = (async () => {
        called = true;
        return new Response("{}", { status: 200 });
      }) as any;

      const resEmpty = await fetchOverpassVenues(midpoint, "");
      const resWhitespace = await fetchOverpassVenues(midpoint, "   ");

      expect(resEmpty).toEqual([]);
      expect(resWhitespace).toEqual([]);
      expect(called).toBe(false);
    });

    it("parses node and way elements with center coordinates and tags", async () => {
      const mockElements = {
        elements: [
          {
            type: "node",
            id: 111,
            lat: 13.74,
            lon: 100.51,
            tags: {
              name: "Cafe Amazon Central",
              "addr:street": "Silom Road",
              "addr:city": "Bangkok",
            },
          },
          {
            type: "way",
            id: 222,
            center: {
              lat: 13.75,
              lon: 100.52,
            },
            tags: {
              brand: "Cafe Amazon",
              "addr:street": "Rama IV",
            },
          },
          {
            type: "node",
            id: 333,
            lat: 13.76,
            lon: 100.53,
            // tags without street/city and without name/brand
            tags: {
              operator: "Amazon PTT",
            },
          },
          {
            type: "node",
            id: 444,
            // missing lat and lon
            tags: { name: "Broken Node" },
          },
        ],
      };

      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(mockElements), { status: 200 });
      }) as any;

      const candidates = await fetchOverpassVenues(midpoint, "Amazon");

      expect(candidates.length).toBe(3); // 444 ignored due to missing coordinates

      // First candidate (node with name, street, city)
      expect(candidates[0]).toEqual({
        id: "osm-node-111",
        name: "Cafe Amazon Central",
        address: "Silom Road, Bangkok",
        lat: 13.74,
        lng: 100.51,
      });

      // Second candidate (way with center, brand)
      expect(candidates[1]).toEqual({
        id: "osm-way-222",
        name: "Cafe Amazon",
        address: "Rama IV",
        lat: 13.75,
        lng: 100.52,
      });

      // Third candidate (falls back to query name and coordinate address)
      expect(candidates[2]).toEqual({
        id: "osm-node-333",
        name: "Amazon",
        address: "13.7600, 100.5300",
        lat: 13.76,
        lng: 100.53,
      });
    });

    it("escapes special regex characters in query", async () => {
      let capturedBody = "";
      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = init?.body?.toString() || "";
        return new Response(JSON.stringify({ elements: [] }), { status: 200 });
      }) as any;

      await fetchOverpassVenues(midpoint, 'Starbucks "Special" (Central) [World] + Cafe?');

      const decodedBody = decodeURIComponent(capturedBody);
      expect(decodedBody).toContain('\\"Special\\"');
      expect(decodedBody).toContain("\\[World\\]");
      expect(decodedBody).toContain("\\(Central\\)");
      expect(decodedBody).toContain("\\+");
      expect(decodedBody).toContain("\\?");
    });

    it("fails over across Overpass mirrors when primary mirror fails or times out", async () => {
      const attempts: string[] = [];
      globalThis.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        attempts.push(urlStr);

        if (urlStr.includes("overpass-api.de/api/interpreter") && !urlStr.includes("lz4")) {
          // Primary mirror 504 Gateway Timeout
          return new Response("Gateway Timeout", { status: 504 });
        }

        if (urlStr.includes("lz4.overpass-api.de")) {
          // Secondary mirror succeeds
          return new Response(
            JSON.stringify({
              elements: [
                {
                  type: "node",
                  id: 555,
                  lat: 13.739,
                  lon: 100.515,
                  tags: { name: "LZ4 Mirror Venue" },
                },
              ],
            }),
            { status: 200 }
          );
        }

        return new Response("{}", { status: 500 });
      }) as any;

      const candidates = await fetchOverpassVenues(midpoint, "Venue");

      expect(attempts.length).toBe(2);
      expect(attempts[0]).toBe(OVERPASS_MIRRORS[0]);
      expect(attempts[1]).toBe(OVERPASS_MIRRORS[1]);
      expect(candidates.length).toBe(1);
      expect(candidates[0].name).toBe("LZ4 Mirror Venue");
    });

    it("returns empty array if all Overpass mirrors fail", async () => {
      let callCount = 0;
      globalThis.fetch = (async () => {
        callCount++;
        throw new Error("Network unreachable");
      }) as any;

      const candidates = await fetchOverpassVenues(midpoint, "Failover Test");

      expect(callCount).toBe(OVERPASS_MIRRORS.length);
      expect(candidates).toEqual([]);
    });
  });

  describe("fetchGooglePlaces", () => {
    const midpoint: LatLng = { lat: 13.7393, lng: 100.5151 };

    it("returns mapped candidates on OK response", async () => {
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            status: "OK",
            results: [
              {
                place_id: "gp-1",
                name: "Test Place",
                vicinity: "123 Sukhumvit",
                geometry: {
                  location: {
                    lat: 13.73,
                    lng: 100.56,
                  },
                },
              },
            ],
          }),
          { status: 200 }
        );
      }) as any;

      const candidates = await fetchGooglePlaces(midpoint, "Test", "valid-key", 5000);
      expect(candidates.length).toBe(1);
      expect(candidates[0]).toEqual({
        id: "google-gp-1",
        name: "Test Place",
        address: "123 Sukhumvit",
        lat: 13.73,
        lng: 100.56,
      });
    });

    it("returns empty array on non-OK status or network error", async () => {
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            status: "REQUEST_DENIED",
            error_message: "The provided API key is invalid.",
          }),
          { status: 200 }
        );
      }) as any;

      const candidates = await fetchGooglePlaces(midpoint, "Test", "invalid-key");
      expect(candidates).toEqual([]);
    });

    it("falls back to empty array when fetch throws", async () => {
      globalThis.fetch = (async () => {
        throw new Error("DNS resolution failed");
      }) as any;

      const candidates = await fetchGooglePlaces(midpoint, "Test", "key");
      expect(candidates).toEqual([]);
    });
  });
});
