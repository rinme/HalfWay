import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { SimpleLRUCache } from "../src/lib/cache";
import {
  geocodeAddress,
  reverseGeocode,
  geocodeCache,
  reverseCache,
  type GeocodeResult,
} from "../src/lib/geocoding";

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

  it("refreshes access order on get so recently accessed key is not evicted", () => {
    const cache = new SimpleLRUCache<string>(2, 1000);
    cache.set("a", "1");
    cache.set("b", "2");
    // Access 'a' to make 'b' the oldest
    expect(cache.get("a")).toBe("1");
    // Add 'c' which should evict 'b', keeping 'a' and 'c'
    cache.set("c", "3");
    expect(cache.get("a")).toBe("1");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe("3");
  });

  it("expires entries after TTL elapsed", async () => {
    const cache = new SimpleLRUCache<string>(2, 30); // 30ms TTL
    cache.set("a", "1");
    expect(cache.get("a")).toBe("1");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(cache.get("a")).toBeUndefined();
  });

  it("clears all entries when clear is called", () => {
    const cache = new SimpleLRUCache<string>(2, 1000);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
  });
});

describe("Geocoding Service", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    geocodeCache.clear();
    reverseCache.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns empty array for empty query", async () => {
    const results = await geocodeAddress("");
    expect(results).toEqual([]);
  });

  it("returns empty array for whitespace query", async () => {
    const results = await geocodeAddress("   ");
    expect(results).toEqual([]);
  });

  it("handles valid response parsing gracefully", async () => {
    const mockOsmResults = [
      {
        display_name: "Siam Paragon, Bangkok",
        lat: "13.7462",
        lon: "100.5347",
      },
    ];

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify(mockOsmResults), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const results = await geocodeAddress("Siam Paragon, Bangkok", "osm");
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);
    expect(results[0].label).toBe("Siam Paragon, Bangkok");
  });

  it("parses Nominatim geocoding results correctly", async () => {
    const mockOsmResults = [
      {
        display_name: "Siam Paragon, Rama I Road, Pathum Wan, Bangkok, Thailand",
        lat: "13.7462",
        lon: "100.5347",
      },
    ];

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      expect(url.toString()).toContain("nominatim.openstreetmap.org/search");
      expect(init?.headers).toBeDefined();
      return new Response(JSON.stringify(mockOsmResults), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const results = await geocodeAddress("Siam Paragon", "osm");
    expect(results.length).toBe(1);
    expect(results[0].label).toBe("Siam Paragon, Rama I Road, Pathum Wan, Bangkok, Thailand");
    expect(results[0].lat).toBeCloseTo(13.7462);
    expect(results[0].lng).toBeCloseTo(100.5347);
  });

  it("parses Google geocoding results when apiKey is provided", async () => {
    const mockGoogleResults = {
      status: "OK",
      results: [
        {
          formatted_address: "CentralWorld, 999/9 Rama I Rd, Bangkok",
          geometry: {
            location: {
              lat: 13.7469,
              lng: 100.5393,
            },
          },
        },
      ],
    };

    globalThis.fetch = (async (url: string | URL | Request) => {
      expect(url.toString()).toContain("maps.googleapis.com");
      return new Response(JSON.stringify(mockGoogleResults), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const results = await geocodeAddress("CentralWorld", "google", "FAKE_KEY");
    expect(results.length).toBe(1);
    expect(results[0].label).toBe("CentralWorld, 999/9 Rama I Rd, Bangkok");
    expect(results[0].lat).toBeCloseTo(13.7469);
    expect(results[0].lng).toBeCloseTo(100.5393);
  });

  it("falls back to OSM when Google geocoding fails", async () => {
    let callCount = 0;
    const mockOsmResults = [
      {
        display_name: "Fallback Location, Bangkok",
        lat: "13.7500",
        lon: "100.5000",
      },
    ];

    globalThis.fetch = (async (url: string | URL | Request) => {
      callCount++;
      if (url.toString().includes("googleapis.com")) {
        throw new Error("Network error contacting Google");
      }
      return new Response(JSON.stringify(mockOsmResults), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const results = await geocodeAddress("Fallback Test", "google", "FAKE_KEY");
    expect(callCount).toBe(2);
    expect(results.length).toBe(1);
    expect(results[0].label).toBe("Fallback Location, Bangkok");
  });

  it("serves repeated queries from cache", async () => {
    let networkCalls = 0;
    const mockOsmResults = [
      {
        display_name: "Cached Location",
        lat: "13.7000",
        lon: "100.5000",
      },
    ];

    globalThis.fetch = (async () => {
      networkCalls++;
      return new Response(JSON.stringify(mockOsmResults), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const res1 = await geocodeAddress("Cached Query", "osm");
    const res2 = await geocodeAddress("Cached Query", "osm");

    expect(networkCalls).toBe(1);
    expect(res1).toEqual(res2);
  });

  it("reverseGeocode returns formatted address from Nominatim", async () => {
    const mockReverseResult = {
      display_name: "Lumphini Park, Pathum Wan, Bangkok 10330, Thailand",
    };

    globalThis.fetch = (async (url: string | URL | Request) => {
      expect(url.toString()).toContain("nominatim.openstreetmap.org/reverse");
      return new Response(JSON.stringify(mockReverseResult), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const address = await reverseGeocode(13.7314, 100.5413, "osm");
    expect(address).toBe("Lumphini Park, Pathum Wan, Bangkok 10330, Thailand");
  });

  it("reverseGeocode returns formatted address from Google when apiKey is provided", async () => {
    const mockGoogleReverse = {
      status: "OK",
      results: [
        {
          formatted_address: "Silom Complex, Bangkok, Thailand",
        },
      ],
    };

    globalThis.fetch = (async (url: string | URL | Request) => {
      expect(url.toString()).toContain("maps.googleapis.com");
      return new Response(JSON.stringify(mockGoogleReverse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const address = await reverseGeocode(13.7278, 100.5353, "google", "FAKE_KEY");
    expect(address).toBe("Silom Complex, Bangkok, Thailand");
  });

  it("reverseGeocode falls back to lat, lng string when requests fail", async () => {
    globalThis.fetch = (async () => {
      return new Response("Not found", { status: 404 });
    }) as unknown as typeof fetch;

    const address = await reverseGeocode(13.7278, 100.5353, "osm");
    expect(address).toBe("13.7278, 100.5353");
  });

  it("reverseGeocode caches results", async () => {
    let networkCalls = 0;
    globalThis.fetch = (async () => {
      networkCalls++;
      return new Response(JSON.stringify({ display_name: "Cached Address" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const addr1 = await reverseGeocode(13.1234, 100.5678, "osm");
    const addr2 = await reverseGeocode(13.1234, 100.5678, "osm");

    expect(networkCalls).toBe(1);
    expect(addr1).toBe("Cached Address");
    expect(addr2).toBe("Cached Address");
  });

  it("reverseGeocode isolates cache entries between apiKey and nokey", async () => {
    let networkCalls = 0;
    globalThis.fetch = (async (url: string | URL | Request) => {
      networkCalls++;
      if (url.toString().includes("maps.googleapis.com")) {
        return new Response(
          JSON.stringify({
            status: "OK",
            results: [{ formatted_address: "Google Address" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ display_name: "OSM Address" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const resNoKey = await reverseGeocode(13.5555, 100.5555, "google");
    const resWithKey = await reverseGeocode(13.5555, 100.5555, "google", "MY_KEY");

    expect(networkCalls).toBe(2);
    expect(resNoKey).toBe("OSM Address");
    expect(resWithKey).toBe("Google Address");
  });
});
