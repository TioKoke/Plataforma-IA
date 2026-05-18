const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Conversation {
  id: string;
  /** Título de la conversación — primer mensaje del usuario truncado a ~80 chars. */
  title?: string | null;
  thread_id?: string | null;
  user_email?: string | null;
  division?: string | null;
  created_at?: string;
}

export interface ConversationsResponse {
  total: number;
  items: Conversation[];
}

export async function fetchMyConversations(idToken?: string | null): Promise<ConversationsResponse> {
  const headers: HeadersInit = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const res = await fetch(`${API_URL}/chat/my-conversations`, { headers });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function deleteMyConversation(
  conversationId: string,
  idToken?: string | null,
): Promise<void> {
  const headers: HeadersInit = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const res = await fetch(
    `${API_URL}/chat/my-conversation/${encodeURIComponent(conversationId)}`,
    { method: 'DELETE', headers },
  );
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}

export interface PersistedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ConversationMessagesResponse {
  conversation_id: string;
  total: number;
  items: PersistedMessage[];
}

export async function fetchConversationMessages(
  conversationId: string,
  idToken?: string | null,
): Promise<ConversationMessagesResponse> {
  const headers: HeadersInit = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const res = await fetch(
    `${API_URL}/chat/my-conversation/${encodeURIComponent(conversationId)}/messages`,
    { headers },
  );
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}
