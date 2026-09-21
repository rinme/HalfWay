export interface SharedSearchData {
  query: string;
  persons: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    color?: string;
  }[];
}

export interface ShareRecord {
  code: string;
  createdAt: number;
  expiresAt: number;
  data: SharedSearchData;
}

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generates a random alphanumeric short code.
 */
export function generateShortCode(length: number = 6): string {
  let code = "";
  // 62 * 4 = 248; bytes >= 248 are rejected to avoid modulo bias
  while (code.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length && code.length < length; i++) {
      if (bytes[i] < 248) {
        code += CHARSET[bytes[i] % 62];
      }
    }
  }
  return code;
}

// In-memory TTL Map
const inMemoryStore = new Map<string, ShareRecord>();

/**
 * Creates and stores a temporary share record.
 * Clamps expiration between 1 and 168 hours (default: 24 hours).
 */
export async function createShareRecord(
  data: SharedSearchData,
  expiresInHours: number = 24
): Promise<ShareRecord> {
  const clampedHours = Math.min(168, Math.max(1, expiresInHours ?? 24));
  const createdAt = Date.now();
  const expiresAt = createdAt + clampedHours * 60 * 60 * 1000;

  let code = generateShortCode(6);
  let attempts = 0;
  while (inMemoryStore.has(code) && attempts < 10) {
    code = generateShortCode(6);
    attempts++;
  }

  const record: ShareRecord = {
    code,
    createdAt,
    expiresAt,
    data,
  };

  inMemoryStore.set(code, record);

  // Optional Upstash Redis fallback for serverless persistence
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const ttlSeconds = Math.max(1, Math.floor((expiresAt - createdAt) / 1000));
      await fetch(redisUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["SET", `share:${code}`, JSON.stringify(record), "EX", ttlSeconds]),
      });
    } catch (err) {
      console.error("Failed to persist share record to Upstash Redis:", err);
    }
  }

  return record;
}

/**
 * Retrieves a share record by code.
 * Returns the search data if valid and not expired, or null otherwise.
 */
export async function getShareRecord(code: string): Promise<SharedSearchData | null> {
  if (!code) return null;

  // 1. Check local in-memory store
  const localRecord = inMemoryStore.get(code);
  if (localRecord) {
    if (Date.now() > localRecord.expiresAt) {
      inMemoryStore.delete(code);
      return null;
    }
    return localRecord.data;
  }

  // 2. Check Upstash Redis if configured
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const res = await fetch(redisUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["GET", `share:${code}`]),
      });

      if (res.ok) {
        const payload = (await res.json()) as { result?: string | null };
        if (payload?.result) {
          const record = (
            typeof payload.result === "string" ? JSON.parse(payload.result) : payload.result
          ) as ShareRecord;

          if (Date.now() > record.expiresAt) {
            return null;
          }

          // Cache in memory
          inMemoryStore.set(code, record);
          return record.data;
        }
      }
    } catch (err) {
      console.error("Failed to retrieve share record from Upstash Redis:", err);
    }
  }

  return null;
}

/**
 * Clears the in-memory share store.
 */
export function clearShareStore(): void {
  inMemoryStore.clear();
}
