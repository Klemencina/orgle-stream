const FRESH_MS = 30_000;
const MAX_AGE_MS = 15 * 60_000;
export type CacheStorage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createBrowserCache<T>({
  storage, loadData, parseData, prefix, now = Date.now,
}: { storage: () => CacheStorage | null; loadData: (key: string) => Promise<unknown>; parseData: (value: unknown) => T; prefix: string; now?: () => number }) {
  const memory = new Map<string, { savedAt: number; data: T }>();
  const pending = new Map<string, Promise<T>>();

  function readEntry(key: string): { savedAt: number; data: T } | null {
    let entry = memory.get(key);
    try {
      if (!entry) {
        const raw = storage()?.getItem(prefix + key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        entry = { savedAt: parsed.savedAt, data: parseData(parsed.data) };
      }
      if (!Number.isFinite(entry.savedAt) || now() < entry.savedAt || now() - entry.savedAt >= MAX_AGE_MS) {
        memory.delete(key);
        storage()?.removeItem(prefix + key);
        return null;
      }
      memory.set(key, entry);
      return entry;
    } catch {
      return null;
    }
  }

  function load(key: string, force = false): Promise<T> {
    const entry = readEntry(key);
    if (!force && entry && now() - entry.savedAt < FRESH_MS) return Promise.resolve(entry.data);
    const existing = pending.get(key);
    if (existing) return existing;
    const request = (async () => {
      const data = parseData(await loadData(key));
      const fresh = { savedAt: now(), data };
      memory.set(key, fresh);
      try { storage()?.setItem(prefix + key, JSON.stringify(fresh)); } catch { /* Memory caching still works when storage is unavailable. */ }
      return data;
    })();
    pending.set(key, request);
    void request.finally(() => pending.delete(key)).catch(() => {});
    return request;
  }

  return { read: (key: string) => readEntry(key)?.data ?? null, load };
}

