const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface ConversationItem {
    id: string;
    thread_id?: string;
    user_email?: string;
    created_at: string;
}

export interface ConversationListResponse {
    total: number;
    items: ConversationItem[];
}

export async function fetchAllConversations(idToken: string): Promise<ConversationListResponse> {
    const res = await fetch(`${API_URL}/chat/conversations`, {
        headers: {
            Authorization: `Bearer ${idToken}`,
        },
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    return res.json();
}

export async function deleteConversation(conversationId: string, idToken: string): Promise<void> {
    const res = await fetch(`${API_URL}/chat/conversation/${conversationId}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${idToken}`,
        },
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}
