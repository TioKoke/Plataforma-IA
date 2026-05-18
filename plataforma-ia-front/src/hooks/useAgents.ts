import { useState, useEffect, useCallback } from 'react';
import { fetchAgents, type Agent, type AgentListResponse, type AgentFilters } from '../services/agentsApi';
import { useAuth } from '../context/AuthContext';

interface UseAgentsReturn {
  agents: Agent[];
  total: number;
  categorias: string[];
  divisiones: string[];
  creadores: string[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAgents(filters?: AgentFilters): UseAgentsReturn {
  const { getIdToken } = useAuth();
  const [data, setData] = useState<AgentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serializar filtros para usarlo como dependencia estable
  const filtersKey = JSON.stringify(filters ?? {});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const result = await fetchAgents(JSON.parse(filtersKey) as AgentFilters, token);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando agentes');
    } finally {
      setLoading(false);
    }
  }, [filtersKey, getIdToken]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    agents: data?.agents ?? [],
    total: data?.total ?? 0,
    categorias: data?.categorias ?? [],
    divisiones: data?.divisiones ?? [],
    creadores: data?.creadores ?? [],
    loading,
    error,
    refetch: load,
  };
}
