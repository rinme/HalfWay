interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class SimpleLRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries: number = 200, ttlMs: number = 30 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { value, expiry: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}
