interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 250,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.entries.has(key)) this.entries.delete(key);
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (!oldest) break;
      this.entries.delete(oldest);
    }
    this.entries.set(key, { expiresAt: Date.now() + this.ttlMs, value });
  }
}

export class RequestRateLimiter {
  private timestamps: number[] = [];

  constructor(private readonly requestsPerMinute: number) {}

  take(): void {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((timestamp) => timestamp > now - 60_000);
    if (this.timestamps.length >= this.requestsPerMinute) {
      throw new Error(
        `Local Transitous safety limit reached (${this.requestsPerMinute} uncached requests/minute). Try again shortly.`,
      );
    }
    this.timestamps.push(now);
  }
}
