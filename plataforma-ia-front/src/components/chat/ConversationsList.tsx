import { useEffect, useState, useCallback } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchMyConversations, deleteMyConversation, type Conversation } from '../../services/conversationsApi';

interface ConversationsListProps {
  /** ID de la conversación activa actualmente. */
  activeId: string | null;
  /** Trigger externo (cambia cuando se crea una conversación nueva) para refrescar. */
  refreshKey?: number | string;
  /** Click en una conversación: cargar su ID. */
  onSelect: (conversationId: string) => void;
}

function formatTitle(c: Conversation): string {
  const title = (c.title || "").trim();
  if (title) return title;
  // Fallback para conversaciones legacy sin título guardado.
  if (c.created_at) {
    try {
      const dt = new Date(c.created_at);
      return dt.toLocaleString('es-CL', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      // fall through
    }
  }
  return c.id.slice(0, 16);
}

function formatTimestamp(c: Conversation): string | null {
  if (!c.created_at) return null;
  try {
    const dt = new Date(c.created_at);
    return dt.toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return null;
  }
}

export function ConversationsList({ activeId, refreshKey, onSelect }: ConversationsListProps) {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const data = await fetchMyConversations(token);
      setItems(data.items);
    } catch (e) {
      setError((e as Error).message || 'No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const handleDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar esta conversación y sus archivos asociados?')) {
      return;
    }
    setDeletingId(conversationId);
    try {
      const token = await getIdToken();
      await deleteMyConversation(conversationId, token);
      setItems((prev) => prev.filter((c) => c.id !== conversationId));
    } catch (err) {
      setError((err as Error).message || 'No se pudo eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="font-heading font-semibold text-plataforma-gris-oscuro text-xs uppercase tracking-wide">
          Historial
        </h3>
        {items.length > 0 && (
          <span className="text-[10px] text-slate-400">{items.length}</span>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
          <Loader2 size={12} className="animate-spin" />
          <span>Cargando…</span>
        </div>
      )}

      {error && !loading && (
        <p className="text-xs text-red-600 py-2">{error}</p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-xs text-slate-400 py-2">
          Aún no tienes conversaciones guardadas.
        </p>
      )}

      <ul className="space-y-1">
        {items.map((c) => {
          const isActive = c.id === activeId;
          const isDeleting = c.id === deletingId;
          const title = formatTitle(c);
          const ts = formatTimestamp(c);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                disabled={isDeleting}
                title={title}
                className={`group w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-2 transition-colors ${
                  isActive
                    ? 'bg-plataforma-turquesa/10 border border-plataforma-turquesa/30 text-plataforma-gris-oscuro'
                    : 'border border-transparent hover:bg-slate-100 text-slate-600'
                } ${isDeleting ? 'opacity-50' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-snug line-clamp-2 break-words">
                    {title}
                  </p>
                  {ts && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{ts}</p>
                  )}
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Eliminar conversación"
                  onClick={(e) => handleDelete(c.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleDelete(c.id, e as unknown as React.MouseEvent);
                    }
                  }}
                  className={`opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all flex-shrink-0 ${
                    isDeleting ? 'opacity-100' : ''
                  }`}
                >
                  {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
