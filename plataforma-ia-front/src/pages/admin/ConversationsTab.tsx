import { useState, useEffect, useCallback } from 'react';
import { Trash2, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { fetchAllConversations, deleteConversation } from '../../services/adminApi';
import type { ConversationItem } from '../../services/adminApi';

const ConversationsTab = () => {
    const { getIdToken } = useAuth();
    const { showAlert } = useAlert();
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadConversations = useCallback(async () => {
        const token = await getIdToken();
        if (!token) return;
        try {
            setIsLoading(true);
            const data = await fetchAllConversations(token);
            setConversations(data.items);
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Error al cargar las conversaciones.');
        } finally {
            setIsLoading(false);
        }
    }, [getIdToken]);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    const handleDelete = async (id: string) => {
        const token = await getIdToken();
        if (!token) return;
        if (!window.confirm('¿Estás seguro de eliminar esta conversación?')) return;

        try {
            await deleteConversation(id, token);
            await loadConversations();
        } catch (err) {
            console.error(err);
            showAlert('Error al eliminar conversación', 'error');
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Cargando conversaciones...</div>;
    }

    if (error) {
        return (
            <div className="p-8 flex items-center justify-center gap-2 text-red-500">
                <AlertCircle size={20} />
                {error}
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <MessageSquare size={20} className="text-plataforma-naranja" />
                    Conversaciones
                </h2>
                <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    Total: {conversations.length}
                </span>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                            <tr>
                                <th className="px-6 py-4 font-semibold">ID Conversación</th>
                                <th className="px-6 py-4 font-semibold">Email Usuario</th>
                                <th className="px-6 py-4 font-semibold">Thread ID</th>
                                <th className="px-6 py-4 font-semibold">Fecha de Creación</th>
                                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {conversations.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        No hay conversaciones registradas
                                    </td>
                                </tr>
                            ) : (
                                conversations.map((conv) => (
                                    <tr key={conv.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">{conv.id}</td>
                                        <td className="px-6 py-4 text-gray-600">{conv.user_email || '-'}</td>
                                        <td className="px-6 py-4 text-gray-500 text-xs font-mono">{conv.thread_id || '-'}</td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(conv.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDelete(conv.id)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ConversationsTab;
