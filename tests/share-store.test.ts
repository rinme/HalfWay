import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  generateShortCode,
  createShareRecord,
  getShareRecord,
  clearShareStore,
  type SharedSearchData,
} from "../src/lib/share-store";

describe("Temporary Share Store", () => {
  beforeEach(() => {
    clearShareStore();
  });

  it("generates 6-character alphanumeric code", () => {
    const code = generateShortCode();
    expect(code.length).toBe(6);
    expect(/^[A-Za-z0-9]+$/.test(code)).toBe(true);
  });

  it("supports custom code length", () => {
    const code8 = generateShortCode(8);
    expect(code8.length).toBe(8);
    expect(/^[A-Za-z0-9]+$/.test(code8)).toBe(true);

    const code10 = generateShortCode(10);
    expect(code10.length).toBe(10);
  });

  it("creates and retrieves a valid share record", async () => {
    const sample: SharedSearchData = {
      query: "Starbucks",
      persons: [
        { id: "1", name: "Alice", address: "Siam", lat: 13.75, lng: 100.5 },
        { id: "2", name: "Bob", address: "Silom", lat: 13.72, lng: 100.52 },
      ],
    };
    const record = await createShareRecord(sample, 24);
    expect(record.code).toBeDefined();
    expect(record.expiresAt).toBeGreaterThan(Date.now());

    const retrieved = await getShareRecord(record.code);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.query).toBe("Starbucks");
    expect(retrieved?.persons.length).toBe(2);
    expect(retrieved?.persons[0].name).toBe("Alice");
  });

  it("defaults to 24 hours expiration", async () => {
    const record = await createShareRecord({ query: "Test", persons: [] });
    const now = Date.now();
    const expectedExpiry = now + 24 * 3600 * 1000;
    // Allow slight tolerance in ms
    expect(Math.abs(record.expiresAt - expectedExpiry)).toBeLessThan(2000);
  });

  it("returns null for non-existent code", async () => {
    const result = await getShareRecord("nonexistent");
    expect(result).toBeNull();
  });

  it("clamps expiration to max 168 hours (7 days)", async () => {
    const record = await createShareRecord({ query: "Test", persons: [] }, 9999);
    const maxExpiry = Date.now() + 168 * 3600 * 1000 + 1000;
    expect(record.expiresAt).toBeLessThanOrEqual(maxExpiry);
  });

  it("clamps expiration to min 1 hour", async () => {
    const record = await createShareRecord({ query: "Test", persons: [] }, -5);
    const minExpiry = Date.now() + 1 * 3600 * 1000 - 1000;
    expect(record.expiresAt).toBeGreaterThanOrEqual(minExpiry);
  });

  it("evicts and returns null for expired records", async () => {
    // Create record with mock expired timestamp by manipulating time or store
    const sample: SharedSearchData = { query: "Expired", persons: [] };
    const record = await createShareRecord(sample, 1);

    // Artificially expire the record by modifying expiresAt
    record.expiresAt = Date.now() - 1000;

    const retrieved = await getShareRecord(record.code);
    expect(retrieved).toBeNull();
  });

  it("clears all stored share records", async () => {
    const sample: SharedSearchData = { query: "ClearMe", persons: [] };
    const record = await createShareRecord(sample);
    expect(await getShareRecord(record.code)).not.toBeNull();

    clearShareStore();
    expect(await getShareRecord(record.code)).toBeNull();
  });

  it("returns null when code is empty string", async () => {
    expect(await getShareRecord("")).toBeNull();
  });

  describe("Upstash Redis Integration", () => {
    const originalEnvUrl = process.env.UPSTASH_REDIS_REST_URL;
    const originalEnvToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = "https://mock-redis.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token-123";
    });

    afterEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = originalEnvUrl;
      process.env.UPSTASH_REDIS_REST_TOKEN = originalEnvToken;
      globalThis.fetch = originalFetch;
    });

    it("persists to Upstash Redis when env vars are present", async () => {
      let fetchCalled = false;
      let sentBody = "";

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        fetchCalled = true;
        sentBody = init?.body as string;
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      }) as unknown as typeof fetch;

      const sample: SharedSearchData = { query: "RedisQuery", persons: [] };
      const record = await createShareRecord(sample, 24);

      expect(fetchCalled).toBe(true);
      expect(sentBody).toContain("SET");
      expect(sentBody).toContain(record.code);
    });

    it("retrieves from Upstash Redis if missing from local memory", async () => {
      const sample: SharedSearchData = { query: "FromRedis", persons: [] };
      const mockRecord = {
        code: "REDIS1",
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600 * 1000,
        data: sample,
      };

      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ result: JSON.stringify(mockRecord) }), { status: 200 });
      }) as unknown as typeof fetch;

      // Clear memory so it has to fall back to Redis
      clearShareStore();

      const result = await getShareRecord("REDIS1");
      expect(result).not.toBeNull();
      expect(result?.query).toBe("FromRedis");
    });

    it("handles Redis fetch failures gracefully without throwing", async () => {
      const originalConsoleError = console.error;
      console.error = () => {};
      try {
        globalThis.fetch = (async () => {
          throw new Error("Network failure");
        }) as unknown as typeof fetch;

        // Shouldn't throw error
        const record = await createShareRecord({ query: "FailSafe", persons: [] });
        expect(record.code).toBeDefined();

        clearShareStore();
        const result = await getShareRecord("FailSafeCode");
        expect(result).toBeNull();
      } finally {
        console.error = originalConsoleError;
      }
    });
  });
});

