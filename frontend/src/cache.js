// Tiny stale-while-revalidate cache for gate data.
// Memory-first (instant within the SPA) + sessionStorage (survives reloads).
const mem = new Map();
const NS = "gp_cache:";

export function getCached(key) {
  if (!key) return undefined;
  if (mem.has(key)) return mem.get(key);
  try {
    const raw = sessionStorage.getItem(NS + key);
    if (raw != null) {
      const v = JSON.parse(raw);
      mem.set(key, v);
      return v;
    }
  } catch { /* ignore */ }
  return undefined;
}

export function setCached(key, val) {
  if (!key) return;
  mem.set(key, val);
  try { sessionStorage.setItem(NS + key, JSON.stringify(val)); } catch { /* ignore */ }
}
