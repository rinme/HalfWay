import { Elysia, t } from "elysia";
import { geocodeAddress, reverseGeocode } from "../lib/geocoding";
import { searchMidpointVenues } from "../lib/venue-search";
import { createShareRecord, getShareRecord } from "../lib/share-store";

export const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok", time: new Date().toISOString() }))
  .get(
    "/geocode",
    async ({ query }) => {
      const q = query.q || "";
      const provider = query.provider === "google" ? "google" : "osm";
      const key =
        query.key ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY;
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
    async ({ query, set }) => {
      const lat = parseFloat(query.lat || "0");
      const lng = parseFloat(query.lng || "0");
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        set.status = 400;
        return { success: false, error: "Invalid coordinates" };
      }
      const provider = query.provider === "google" ? "google" : "osm";
      const key =
        query.key ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY;
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
    "/share",
    async ({ body }) => {
      const { persons, query, expiresInHours } = body;
      const record = await createShareRecord(
        {
          query,
          persons: persons.map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address || "",
            lat: p.lat,
            lng: p.lng,
            color: p.color,
          })),
        },
        expiresInHours
      );
      return {
        success: true,
        code: record.code,
        expiresAt: record.expiresAt,
        shareUrl: `/?s=${record.code}`,
      };
    },
    {
      body: t.Object({
        persons: t.Array(
          t.Object({
            id: t.String(),
            name: t.String(),
            lat: t.Number(),
            lng: t.Number(),
            address: t.Optional(t.String()),
            color: t.Optional(t.String()),
          }),
          { minItems: 2, maxItems: 8 }
        ),
        query: t.String(),
        expiresInHours: t.Optional(t.Number()),
      }),
    }
  )
  .get(
    "/share",
    async ({ query, set }) => {
      const code = query.code;
      if (!code) {
        set.status = 404;
        return { success: false, error: "Share link not found or expired" };
      }
      const data = await getShareRecord(code);
      if (!data) {
        set.status = 404;
        return { success: false, error: "Share link not found or expired" };
      }
      return { success: true, data };
    },
    {
      query: t.Object({
        code: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/search-midpoint",
    async ({ body }) => {
      if ("persons" in body) {
        const result = await searchMidpointVenues({
          persons: body.persons,
          query: body.query,
          apiKey: body.apiKey,
          preferredProvider: body.preferredProvider === "google" ? "google" : "osm",
        });
        return { success: true, ...result };
      }
      const result = await searchMidpointVenues({
        pointA: body.pointA,
        pointB: body.pointB,
        query: body.query,
        apiKey: body.apiKey,
        preferredProvider: body.preferredProvider === "google" ? "google" : "osm",
      });
      return { success: true, ...result };
    },
    {
      body: t.Union([
        t.Object({
          persons: t.Array(
            t.Object({
              id: t.String(),
              name: t.String(),
              lat: t.Number(),
              lng: t.Number(),
              address: t.Optional(t.String()),
              color: t.Optional(t.String()),
            }),
            { minItems: 2, maxItems: 8 }
          ),
          query: t.String(),
          apiKey: t.Optional(t.String()),
          preferredProvider: t.Optional(t.String()),
        }),
        t.Object({
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
      ]),
    }
  );

export type App = typeof app;

