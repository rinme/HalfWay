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

export type App = typeof app;
