const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export type BacklogEstado = 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado' | 'en_desarrollo';
export type BacklogPrioridad = 'baja' | 'media' | 'alta' | 'critica';

export interface BacklogItem {
  id: string;
  titulo: string;
  descripcion: string;
  problema_a_resolver: string;
  usuarios_objetivo: string;
  funcionalidades_clave: string[];
  datos_fuentes: string;
  beneficio_esperado: string;
  estado: BacklogEstado;
  prioridad: BacklogPrioridad;
  division: string;
  solicitante_nombre: string;
  solicitante_email: string;
  origen: string;
  conversation_id?: string;
  created_at: string;
  updated_at: string;
  votos: number;
  votos_usuarios: string[];
}

export interface BacklogCreateForm {
  titulo: string;
  descripcion: string;
  problema_a_resolver: string;
  usuarios_objetivo: string;
  funcionalidades_clave: string[];
  datos_fuentes: string;
  beneficio_esperado: string;
  prioridad: BacklogPrioridad;
  division: string;
  solicitante_nombre: string;
  solicitante_email: string;
  origen?: 'chat' | 'formulario';
  conversation_id?: string;
}

export interface BacklogListResponse {
  items: BacklogItem[];
  total: number;
}

export interface BacklogFilters {
  division?: string;
  estado?: BacklogEstado;
  prioridad?: BacklogPrioridad;
  mi_email?: string;
}

export async function fetchBacklogs(filters?: BacklogFilters, idToken?: string | null): Promise<BacklogListResponse> {
  const params = new URLSearchParams();
  if (filters?.division) params.set('division', filters.division);
  if (filters?.estado) params.set('estado', filters.estado);
  if (filters?.prioridad) params.set('prioridad', filters.prioridad);
  if (filters?.mi_email) params.set('mi_email', filters.mi_email);

  const query = params.toString();
  const url = `${API_URL}/backlogs/${query ? `?${query}` : ''}`;

  const headers: HeadersInit = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function createBacklog(form: BacklogCreateForm, idToken?: string | null): Promise<BacklogItem> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const res = await fetch(`${API_URL}/backlogs/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function updateBacklogEstado(
  backlogId: string,
  division: string,
  estado: BacklogEstado,
  idToken: string,
): Promise<BacklogItem> {
  const params = new URLSearchParams({ division });
  const res = await fetch(`${API_URL}/backlogs/${backlogId}/estado?${params}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ estado }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function voteBacklog(backlogId: string, division: string, voterEmail: string, idToken?: string | null): Promise<BacklogItem> {
  const params = new URLSearchParams({ division, voter_email: voterEmail });
  const headers: HeadersInit = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const res = await fetch(`${API_URL}/backlogs/${backlogId}/votar?${params}`, {
    method: 'POST',
    headers,
  });
  if (res.status === 409) throw new Error('ya_votaste');
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function updateBacklogFull(
  backlogId: string,
  division: string,
  updates: Partial<BacklogItem>,
  idToken: string
): Promise<BacklogItem> {
  const params = new URLSearchParams({ division });
  const res = await fetch(`${API_URL}/backlogs/${backlogId}?${params}`, {
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

export async function deleteBacklog(
  backlogId: string,
  division: string,
  idToken: string
): Promise<void> {
  const params = new URLSearchParams({ division });
  const res = await fetch(`${API_URL}/backlogs/${backlogId}?${params}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${idToken}`,
    },
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}

