import { useEffect, useState } from "react";
import { getCached, setCached } from "./cache";

/**
 * Stale-while-revalidate data hook.
 * - Returns cached data instantly (no skeleton on revisit).
 * - Revalidates in the background and updates when fresh data lands.
 * `loading` is only true the very first time (nothing cached yet).
 */
export function useCached(key, fetcher, enabled = true) {
  const [data, setData] = useState(() => getCached(key));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !key) return;
    let alive = true;
    setData(getCached(key));   // instant from cache (or undefined → skeleton)
    setError(null);
    fetcher()
      .then((res) => { if (alive) { setCached(key, res); setData(res); } })
      .catch((e) => { if (alive) setError(e); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { data, error, loading: data === undefined && !error };
}
