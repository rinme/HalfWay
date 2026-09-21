import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { app } from "../src/server/app";
import { GET, POST, PUT, DELETE, PATCH } from "../src/app/api/[[...slugs]]/route";

describe("Elysia API Route Handlers", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Default fetch mock returning empty elements for Overpass / Nominatim
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("responds to GET /api/health", async () => {
    const res = await app.handle(new Request("http://localhost/api/health"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.time).toBeDefined();
  });

  it("handles GET /api/geocode with missing query", async () => {
    const res = await app.handle(new Request("http://localhost/api/geocode?q="));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toEqual([]);
  });

  it("handles GET /api/geocode with query and returns results", async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify([
          {
            display_name: "Central World, Bangkok",
            lat: "13.7466",
            lon: "100.5392",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const res = await app.handle(new Request("http://localhost/api/geocode?q=Central%20World"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBe(1);
    expect(data.results[0].label).toBe("Central World, Bangkok");
  });

  it("handles GET /api/reverse-geocode with lat and lng", async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ display_name: "Pathum Wan, Bangkok" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const res = await app.handle(new Request("http://localhost/api/reverse-geocode?lat=13.7466&lng=100.5392"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.address).toBe("Pathum Wan, Bangkok");
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
    expect(data.midpoint.lat).toBeCloseTo(13.735, 2);
    expect(data.midpoint.lng).toBeCloseTo(100.51, 2);
    expect(data.totalDistanceAB).toBeGreaterThan(0);
    expect(Array.isArray(data.branches)).toBe(true);
  });

  it("rejects POST /api/search-midpoint with invalid payload", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/search-midpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointA: { lat: "not-a-number" },
          // missing pointB and query
        }),
      })
    );
    expect(res.status).not.toBe(200);
  });

  describe("Next.js Route Handlers delegation", () => {
    it("delegates GET requests through Next.js route handler", async () => {
      const res = await GET(new Request("http://localhost/api/health"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
    });

    it("delegates POST requests through Next.js route handler", async () => {
      const res = await POST(
        new Request("http://localhost/api/search-midpoint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pointA: { lat: 13.75, lng: 100.5 },
            pointB: { lat: 13.72, lng: 100.52 },
            query: "Cafe",
          }),
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("exports PUT, DELETE, and PATCH route handlers", () => {
      expect(typeof PUT).toBe("function");
      expect(typeof DELETE).toBe("function");
      expect(typeof PATCH).toBe("function");
    });
  });
});
