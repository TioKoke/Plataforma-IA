import { useState, useEffect, useCallback } from 'react';
import {
  fetchBacklogs,
  type BacklogItem,
  type BacklogListResponse,
  type BacklogFilters,
} from '../services/backlogApi';
import { useAuth } from '../context/AuthContext';

interface UseBacklogsReturn {
  items: BacklogItem[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// filters = null → skip fetch (tab inactive or waiting for user data)
// filters = undefined → fetch with no filters (all items)
// filters = BacklogFilters → fetch with specific filters
export function useBacklogs(filters: BacklogFilters | null | undefined): UseBacklogsReturn {
  const { getIdToken } = useAuth();
  const [data, setData] = useState<BacklogListResponse | null>(null);
  const [loading, setLoading] = useState(filters !== null);
  const [error, setError] = useState<string | null>(null);

  const filtersKey = JSON.stringify(filters ?? null);

  const load = useCallback(async () => {
    if (filters === null) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const result = await fetchBacklogs((filters ?? {}) as BacklogFilters, token);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando requerimientos');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, getIdToken]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    loading,
    error,
    refetch: load,
  };
}
