import { useState, useEffect, useRef } from "react";

const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30000;

export function useFetch<T>(key: string, fetcher: () => Promise<T>, options?: { ttl?: number; enabled?: boolean }) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const ttl = options?.ttl ?? CACHE_TTL;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    mounted.current = true;
    if (!enabled) { setLoading(false); return; }

    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      setData(cached.data as T);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetcher()
      .then((res) => {
        if (mounted.current) {
          cache.set(key, { data: res, timestamp: Date.now() });
          setData(res);
          setError(null);
        }
      })
      .catch((err) => { if (mounted.current) setError(err?.message || "Error"); })
      .finally(() => { if (mounted.current) setLoading(false); });

    return () => { mounted.current = false; };
  }, [key, ttl, enabled]);

  const invalidate = () => cache.delete(key);

  return { data, loading, error, invalidate };
}
