import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { app } from "../src/server/app";
import { GET, POST, PUT, DELETE, PATCH } from "../src/app/api/[[...slugs]]/route";
import { clearShareStore } from "../src/lib/share-store";

describe("Elysia API Route Handlers", () => {
  const originalFetch = globalThis.fetch;
  const originalGoogleKey = process.env.GOOGLE_MAPS_API_KEY;
  const originalNextPublicKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    clearShareStore();
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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
    if (originalGoogleKey !== undefined) {
      process.env.GOOGLE_MAPS_API_KEY = originalGoogleKey;
    } else {
      delete process.env.GOOGLE_MAPS_API_KEY;
    }
    if (originalNextPublicKey !== undefined) {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = originalNextPublicKey;
    } else {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    }
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

  it("returns 400 when GET /api/reverse-geocode receives NaN coordinates", async () => {
    const resLatNaN = await app.handle(new Request("http://localhost/api/reverse-geocode?lat=invalid&lng=100.5392"));
    expect(resLatNaN.status).toBe(400);
    const dataLatNaN = await resLatNaN.json();
    expect(dataLatNaN.success).toBe(false);
    expect(dataLatNaN.error).toBe("Invalid coordinates");

    const resLngNaN = await app.handle(new Request("http://localhost/api/reverse-geocode?lat=13.7466&lng=invalid"));
    expect(resLngNaN.status).toBe(400);
    const dataLngNaN = await resLngNaN.json();
    expect(dataLngNaN.success).toBe(false);
    expect(dataLngNaN.error).toBe("Invalid coordinates");
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

  it("creates share record with short code and URL via POST /api/share", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persons: [
            { id: "p1", name: "Alice", address: "Siam, Bangkok", lat: 13.7469, lng: 100.5393 },
            { id: "p2", name: "Bob", address: "Silom, Bangkok", lat: 13.7223, lng: 100.5284 },
          ],
          query: "Starbucks",
          expiresInHours: 48,
        }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(typeof data.code).toBe("string");
    expect(data.code.length).toBe(6);
    expect(data.shareUrl).toBe(`/?s=${data.code}`);
    expect(data.expiresAt).toBeGreaterThan(Date.now());
  });

  it("retrieves stored share data via GET /api/share?code=...", async () => {
    const createRes = await app.handle(
      new Request("http://localhost/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persons: [
            { id: "p1", name: "Alice", address: "Siam, Bangkok", lat: 13.7469, lng: 100.5393 },
            { id: "p2", name: "Bob", address: "Silom, Bangkok", lat: 13.7223, lng: 100.5284 },
          ],
          query: "Starbucks",
        }),
      })
    );
    const createData = await createRes.json();
    expect(createData.success).toBe(true);

    const getRes = await app.handle(
      new Request(`http://localhost/api/share?code=${createData.code}`)
    );
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.data.query).toBe("Starbucks");
    expect(getData.data.persons.length).toBe(2);
    expect(getData.data.persons[0].name).toBe("Alice");
    expect(getData.data.persons[1].name).toBe("Bob");
  });

  it("returns 404 for GET /api/share with nonexistent or expired code", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/share?code=nonexistent")
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Share link not found or expired");
  });

  it("handles POST /api/search-midpoint with 3 persons returning centroid midpoint and per-person distances", async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          elements: [
            {
              type: "node",
              id: 1001,
              lat: 13.73,
              lon: 100.51,
              tags: { name: "Central Cafe", "addr:street": "Rama I Rd" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const res = await app.handle(
      new Request("http://localhost/api/search-midpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persons: [
            { id: "p1", name: "Alice", lat: 13.75, lng: 100.5 },
            { id: "p2", name: "Bob", lat: 13.72, lng: 100.52 },
            { id: "p3", name: "Charlie", lat: 13.7, lng: 100.51 },
          ],
          query: "Cafe",
        }),
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.midpoint).toBeDefined();
    expect(data.midpoint.lat).toBeCloseTo(13.7233, 3);
    expect(data.midpoint.lng).toBeCloseTo(100.51, 3);
    expect(data.branches.length).toBe(1);

    const branch = data.branches[0];
    expect(branch.name).toBe("Central Cafe");
    expect(Array.isArray(branch.distances)).toBe(true);
    expect(branch.distances.length).toBe(3);
    expect(branch.distances[0].personId).toBe("p1");
    expect(branch.distances[0].name).toBe("Alice");
    expect(branch.distances[0].distance).toBeGreaterThan(0);
    expect(branch.distances[1].personId).toBe("p2");
    expect(branch.distances[1].name).toBe("Bob");
    expect(branch.distances[1].distance).toBeGreaterThan(0);
    expect(branch.distances[2].personId).toBe("p3");
    expect(branch.distances[2].name).toBe("Charlie");
    expect(branch.distances[2].distance).toBeGreaterThan(0);
    expect(branch.fairnessScore).toBeGreaterThan(0);
  });

  it("falls back to server environment key for geocode and reverse-geocode when key query is omitted", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "server-secret-key-123";

    let capturedUrl = "";
    globalThis.fetch = (async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "Mock Google Address",
              geometry: { location: { lat: 13.75, lng: 100.5 } },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const resGeocode = await app.handle(
      new Request("http://localhost/api/geocode?q=Siam&provider=google")
    );
    expect(resGeocode.status).toBe(200);
    expect(capturedUrl).toContain("key=server-secret-key-123");

    const resReverse = await app.handle(
      new Request("http://localhost/api/reverse-geocode?lat=13.75&lng=100.5&provider=google")
    );
    expect(resReverse.status).toBe(200);
    expect(capturedUrl).toContain("key=server-secret-key-123");
  });

  it("falls back to server environment key for search-midpoint when apiKey is omitted and provider is google", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "server-next-public-key";

    let capturedUrl = "";
    globalThis.fetch = (async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              place_id: "g1",
              name: "Google Coffee",
              vicinity: "Siam Square",
              geometry: { location: { lat: 13.74, lng: 100.53 } },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const res = await app.handle(
      new Request("http://localhost/api/search-midpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persons: [
            { id: "p1", name: "Alice", lat: 13.75, lng: 100.5 },
            { id: "p2", name: "Bob", lat: 13.72, lng: 100.52 },
          ],
          query: "Coffee",
          preferredProvider: "google",
        }),
      })
    );
    expect(res.status).toBe(200);
    expect(capturedUrl).toContain("key=server-next-public-key");
    const data = await res.json();
    expect(data.branches[0].name).toBe("Google Coffee");
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

    it("delegates POST /api/share and GET /api/share through Next.js route handlers", async () => {
      const shareRes = await POST(
        new Request("http://localhost/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            persons: [
              { id: "p1", name: "Alice", address: "Siam", lat: 13.75, lng: 100.5 },
              { id: "p2", name: "Bob", address: "Silom", lat: 13.72, lng: 100.52 },
            ],
            query: "Matcha",
          }),
        })
      );
      expect(shareRes.status).toBe(200);
      const shareData = await shareRes.json();
      expect(shareData.success).toBe(true);

      const getRes = await GET(
        new Request(`http://localhost/api/share?code=${shareData.code}`)
      );
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.data.query).toBe("Matcha");
    });

    it("exports PUT, DELETE, and PATCH route handlers", () => {
      expect(typeof PUT).toBe("function");
      expect(typeof DELETE).toBe("function");
      expect(typeof PATCH).toBe("function");
    });
  });
});
