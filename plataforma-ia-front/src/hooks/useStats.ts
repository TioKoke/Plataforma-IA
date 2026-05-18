import { useState, useEffect, useRef } from 'react';
import { fetchStats } from '../services/statsApi';
import type { StatsResponse } from '../services/statsApi';
import { useAuth } from '../context/AuthContext';

interface UseStatsResult {
  stats: StatsResponse | null;
  loading: boolean;
  error: string | null;
}

const CACHE_KEY_PREFIX = 'plataforma-ia_stats_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

interface CachedStats {
  data: StatsResponse;
  timestamp: number;
}

function getCache(days: number): CachedStats | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${days}`);
    if (!raw) return null;
    return JSON.parse(raw) as CachedStats;
  } catch {
    return null;
  }
}

function setCache(days: number, data: StatsResponse): void {
  try {
    const payload: CachedStats = { data, timestamp: Date.now() };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${days}`, JSON.stringify(payload));
  } catch {
    // ignorar errores de cuota
  }
}

export function useStats(days = 30): UseStatsResult {
  const { getIdToken } = useAuth();
  const initialCache = getCache(days);
  const [stats, setStats] = useState<StatsResponse | null>(initialCache?.data ?? null);
  const [loading, setLoading] = useState(initialCache === null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const cached = getCache(days);
    // Caché fresco (< 5 min) → no re-fetch
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return;
    }

    // Sin caché o expirado → fetch (background si había caché)
    getIdToken()
      .then((token) => fetchStats(days, token))
      .then((data) => {
        if (!cancelledRef.current) {
          setStats(data);
          setLoading(false);
          setCache(days, data);
        }
      })
      .catch((err: Error) => {
        if (!cancelledRef.current) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [days, getIdToken]);

  return { stats, loading, error };
}
