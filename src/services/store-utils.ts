export type Candle = { time: string; value: number }

// Merge two history arrays (by `time`) keeping unique timestamps.
// Incoming entries overwrite existing entries for the same timestamp.
export const mergeHistories = (existing?: Candle[], incoming?: Candle[]): Candle[] => {
  const map = new Map<string, Candle>();
  if (existing && Array.isArray(existing)) {
    for (const c of existing) map.set(c.time, c);
  }
  if (incoming && Array.isArray(incoming)) {
    for (const c of incoming) map.set(c.time, c);
  }
  return Array.from(map.values()).sort((a, b) => a.time.localeCompare(b.time));
};

export const isAbort = (x: unknown) => {
  if (!x) return false;
  if (x instanceof Error) return x.name === 'AbortError' || x.message === 'AbortError';
  if (typeof x === 'object' && x !== null) {
    const o = x as Record<string, unknown>;
    return o.name === 'AbortError' || o.message === 'AbortError';
  }
  return false;
};
