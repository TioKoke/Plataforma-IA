import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, ClipboardList, X, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { fetchBacklogs, updateBacklogFull, deleteBacklog } from '../../services/backlogApi';
import type { BacklogItem, BacklogEstado } from '../../services/backlogApi';

const BacklogsTab = () => {
    const { getIdToken } = useAuth();
    const { showAlert } = useAlert();
    const [backlogs, setBacklogs] = useState<BacklogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const token = await getIdToken();
            const data = await fetchBacklogs(undefined, token);
            setBacklogs(data.items);
        } catch (err) {
            console.error(err);
            showAlert('Error cargando backlogs', 'error');
        } finally {
            setLoading(false);
        }
    }, [showAlert, getIdToken]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleEdit = (item: BacklogItem) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleDelete = async (backlogId: string, division: string) => {
        const token = await getIdToken();
        if (!token) return;
        if (!window.confirm('¿Eliminar este requerimiento?')) return;
        try {
            await deleteBacklog(backlogId, division, token);
            await loadData();
        } catch (err) {
            console.error(err);
            showAlert('Error al eliminar requerimiento', 'error');
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <ClipboardList size={20} className="text-plataforma-naranja" />
                    Requerimientos (Backlog)
                </h2>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                            <tr>
                                <th className="px-6 py-4 font-semibold">ID</th>
                                <th className="px-6 py-4 font-semibold">Título</th>
                                <th className="px-6 py-4 font-semibold">Estado</th>
                                <th className="px-6 py-4 font-semibold">División/Solicitante</th>
                                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Cargando...</td></tr>
                            ) : backlogs.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No hay requerimientos</td></tr>
                            ) : (
                                backlogs.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-gray-500">{item.id.substring(0, 10)}...</td>
                                        <td className="px-6 py-4 font-medium text-gray-900 border-l-4 border-transparent hover:border-plataforma-naranja truncate max-w-[200px]">
                                            {item.titulo}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                                {item.estado}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 text-xs flex flex-col">
                                            <span>{item.division}</span>
                                            <span className="text-gray-400">{item.solicitante_email}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => handleEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mr-2">
                                                <Pencil size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(item.id, item.division)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
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

            {isModalOpen && editingItem && (
                <BacklogModal item={editingItem} onClose={() => setIsModalOpen(false)} onSuccess={() => { setIsModalOpen(false); loadData(); }} getIdToken={getIdToken} />
            )}
        </div>
    );
};

const BacklogModal = ({ item, onClose, onSuccess, getIdToken }: { item: BacklogItem, onClose: () => void, onSuccess: () => void, getIdToken: () => Promise<string | null> }) => {
    const { showAlert } = useAlert();
    const [formData, setFormData] = useState<Partial<BacklogItem>>(item);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = await getIdToken();
        if (!token) {
            showAlert("Usuario no autenticado", "error");
            return;
        }
        setLoading(true);
        try {
            await updateBacklogFull(item.id, item.division, formData, token);
            onSuccess();
        } catch (err) {
            console.error(err);
            showAlert('Error guardando requerimiento', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
                    <h3 className="text-xl font-bold">Editar Requerimiento</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                        <input required value={formData.titulo || ''} onChange={e => setFormData({ ...formData, titulo: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                        <select value={formData.estado || ''} onChange={e => setFormData({ ...formData, estado: e.target.value as BacklogEstado })} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja">
                            <option value="pendiente">Pendiente</option>
                            <option value="en_revision">En Revisión</option>
                            <option value="aprobado">Aprobado</option>
                            <option value="en_desarrollo">En Desarrollo</option>
                            <option value="rechazado">Rechazado</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                        <textarea required rows={4} value={formData.descripcion || ''} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja" />
                    </div>
                    <div className="mt-8 flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                        <button type="submit" disabled={loading} className="px-6 py-2 bg-plataforma-naranja text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
                            <Save size={16} />
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BacklogsTab;
