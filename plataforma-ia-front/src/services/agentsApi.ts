const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Agent {
  id: string;
  nombre: string;
  tipo: string;
  descripcion: string;
  creador: string;
  modelo: string;
  estado: string;
  enlace: string;
  categoria: string;
  division: string;
  casos_uso: string[];
  beneficios: string[];
  icon_url?: string;
}

export interface AgentListResponse {
  agents: Agent[];
  total: number;
  categorias: string[];
  divisiones: string[];
  creadores: string[];
}

export interface AgentFilters {
  categoria?: string;
  division?: string;
  creador?: string;
  search?: string;
}

export async function fetchAgents(filters?: AgentFilters, idToken?: string | null): Promise<AgentListResponse> {
  const params = new URLSearchParams();
  if (filters?.categoria) params.set('categoria', filters.categoria);
  if (filters?.division) params.set('division', filters.division);
  if (filters?.creador) params.set('creador', filters.creador);
  if (filters?.search) params.set('search', filters.search);

  const query = params.toString();
  const url = `${API_URL}/agents/${query ? `?${query}` : ''}`;

  const headers: HeadersInit = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function createAgent(agent: Omit<Agent, 'id'>, idToken: string): Promise<Agent> {
  const res = await fetch(`${API_URL}/agents/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(agent),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function updateAgent(
  agentId: string,
  categoria: string,
  updates: Partial<Agent>,
  idToken: string
): Promise<Agent> {
  const params = new URLSearchParams({ categoria });
  const res = await fetch(`${API_URL}/agents/${agentId}?${params}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function deleteAgent(
  agentId: string,
  categoria: string,
  idToken: string
): Promise<void> {
  const params = new URLSearchParams({ categoria });
  const res = await fetch(`${API_URL}/agents/${agentId}?${params}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${idToken}`,
    },
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}

export async function uploadAgentIcon(agentId: string, file: File, idToken: string): Promise<Agent> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/agents/${agentId}/icon`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${idToken}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

