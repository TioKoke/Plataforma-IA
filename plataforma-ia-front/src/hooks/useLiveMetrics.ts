import { useState, useEffect, useRef } from 'react';
import { fetchLiveMetrics, postPresence } from '../services/statsApi';
import type { LiveMetrics } from '../services/statsApi';
import { useAuth } from '../context/AuthContext';

/* ── Caché localStorage (mismo patrón que useStats) ── */
const CACHE_KEY = 'plataforma-ia_live_metrics';

interface CachedLive {
  data: LiveMetrics;
  timestamp: number;
}

function getCachedLive(): CachedLive | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedLive;
  } catch {
    return null;
  }
}

function setCachedLive(data: LiveMetrics): void {
  try {
    const payload: CachedLive = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignorar errores de cuota
  }
}

/* ── Hook ── */
interface UseLiveMetricsResult {
  metrics: LiveMetrics | null;
  isLive: boolean;
  error: string | null;
}

export function useLiveMetrics(intervalMs = 30_000, userEmail?: string | null): UseLiveMetricsResult {
  const { getIdToken } = useAuth();
  const cached = getCachedLive();
  const [metrics, setMetrics] = useState<LiveMetrics | null>(cached?.data ?? null);
  const [isLive, setIsLive] = useState(cached !== null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userEmailRef = useRef(userEmail);
  userEmailRef.current = userEmail;

  const poll = async () => {
    try {
      const token = await getIdToken();
      if (userEmailRef.current) {
        postPresence(userEmailRef.current, token).catch(() => {});
      }
      const data = await fetchLiveMetrics(token);
      setMetrics(data);
      setCachedLive(data);
      setIsLive(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      // isLive permanece true si ya tenía datos previos (muestra valor stale)
    }
  };

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, intervalMs);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [intervalMs]);

  return { metrics, isLive, error };
}
