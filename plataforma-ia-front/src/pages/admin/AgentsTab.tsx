import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Pencil, Trash2, Plus, Bot, Save, X, ImagePlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { fetchAgents, createAgent, updateAgent, deleteAgent, uploadAgentIcon } from '../../services/agentsApi';
import type { Agent } from '../../services/agentsApi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function resolveIconUrl(icon_url: string): string {
    if (icon_url.startsWith('/agents/')) return `${API_URL}${icon_url}`;
    return icon_url;
}

/** Mini avatar para tabla y modal */
function AgentAvatar({ icon_url, size = 8 }: { icon_url?: string; size?: number }) {
    const [failed, setFailed] = useState(false);
    const cls = `w-${size} h-${size} rounded-lg object-cover`;
    if (icon_url && !failed) {
        return (
            <img
                src={resolveIconUrl(icon_url)}
                onError={() => setFailed(true)}
                className={cls}
                alt="icon"
            />
        );
    }
    return <Bot size={size * 4} className="text-gray-400" />;
}

const AgentsTab = () => {
    const { getIdToken } = useAuth();
    const { showAlert } = useAlert();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const token = await getIdToken();
            const data = await fetchAgents(undefined, token);
            setAgents(data.agents);
        } catch (err) {
            console.error(err);
            showAlert('Error cargando agentes', 'error');
        } finally {
            setLoading(false);
        }
    }, [showAlert, getIdToken]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (agent?: Agent) => {
        if (agent) {
            setEditingAgent(agent);
        } else {
            setEditingAgent(null);
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingAgent(null);
    };

    const handleDelete = async (agentId: string, categoria: string) => {
        const token = await getIdToken();
        if (!token) return;
        if (!window.confirm('¿Eliminar permanente este agente?')) return;
        try {
            await deleteAgent(agentId, categoria, token);
            await loadData();
        } catch (err) {
            console.error(err);
            showAlert('Error al eliminar', 'error');
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Bot size={20} className="text-plataforma-naranja" />
                    Catálogo de Agentes
                </h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-plataforma-naranja text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
                >
                    <Plus size={18} />
                    Nuevo Agente
                </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Nombre</th>
                                <th className="px-6 py-4 font-semibold">Categoría</th>
                                <th className="px-6 py-4 font-semibold">División</th>
                                <th className="px-6 py-4 font-semibold">Estado</th>
                                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Cargando...</td></tr>
                            ) : agents.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No hay agentes registrados</td></tr>
                            ) : (
                                agents.map((ag) => (
                                    <tr key={ag.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900 border-l-4 border-transparent hover:border-plataforma-naranja">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                    <AgentAvatar icon_url={ag.icon_url} size={8} />
                                                </div>
                                                {ag.nombre}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">{ag.categoria}</span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{ag.division}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${ag.estado === 'Activo' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {ag.estado}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => handleOpenModal(ag)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mr-2">
                                                <Pencil size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(ag.id, ag.categoria)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
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

            {isModalOpen && (
                <AgentModal
                    agent={editingAgent}
                    onClose={closeModal}
                    onSuccess={() => { closeModal(); loadData(); }}
                    getIdToken={getIdToken}
                />
            )}
        </div>
    );
};

interface AgentModalProps {
    agent: Agent | null;
    onClose: () => void;
    onSuccess: () => void;
    getIdToken: () => Promise<string | null>;
}

const AgentModal: React.FC<AgentModalProps> = ({ agent, onClose, onSuccess, getIdToken }) => {
    const { showAlert } = useAlert();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState<Partial<Agent>>(
        agent || {
            nombre: '', tipo: 'Bot de Chat', descripcion: '', creador: '',
            modelo: 'GPT-4o', estado: 'Activo', enlace: '', categoria: '',
            division: 'Casa Matriz', casos_uso: [], beneficios: []
        }
    );
    const [loading, setLoading] = useState(false);
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState<string | null>(
        agent?.icon_url ? resolveIconUrl(agent.icon_url) : null
    );

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIconFile(file);
        setIconPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = await getIdToken();
        if (!token) {
            showAlert("Usuario no autenticado", "error");
            return;
        }
        setLoading(true);
        try {
            let savedAgent: Agent;
            if (agent) {
                savedAgent = await updateAgent(agent.id, agent.categoria, formData, token);
            } else {
                savedAgent = await createAgent(formData as Omit<Agent, 'id'>, token);
            }
            if (iconFile) {
                await uploadAgentIcon(savedAgent.id, iconFile, token);
            }
            onSuccess();
        } catch (err) {
            console.error(err);
            showAlert('Error guardando agente', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const addArrayItem = (field: 'casos_uso' | 'beneficios') => {
        setFormData(prev => ({ ...prev, [field]: [...(prev[field] || []), ''] }));
    };

    const updateArrayItem = (index: number, value: string, field: 'casos_uso' | 'beneficios') => {
        setFormData(prev => {
            const newArray = [...(prev[field] || [])];
            newArray[index] = value;
            return { ...prev, [field]: newArray };
        });
    };

    const removeArrayItem = (index: number, field: 'casos_uso' | 'beneficios') => {
        setFormData(prev => {
            const newArray = [...(prev[field] || [])];
            newArray.splice(index, 1);
            return { ...prev, [field]: newArray };
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
                    <h3 className="text-xl font-bold">{agent ? 'Editar Agente' : 'Nuevo Agente'}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Sección de ícono */}
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="w-16 h-16 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                            {iconPreview ? (
                                <img src={iconPreview} className="w-full h-full object-cover" alt="preview" />
                            ) : (
                                <Bot size={28} className="text-gray-400" />
                            )}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 mb-1">Ícono del agente</p>
                            {agent ? (
                                <>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-plataforma-naranja hover:text-plataforma-naranja transition-colors"
                                    >
                                        <ImagePlus size={14} />
                                        {iconFile ? 'Cambiar imagen' : (agent.icon_url ? 'Reemplazar ícono' : 'Subir ícono')}
                                    </button>
                                    {iconFile && (
                                        <p className="text-xs text-gray-500 mt-1">{iconFile.name} — se subirá al guardar</p>
                                    )}
                                </>
                            ) : (
                                <p className="text-xs text-gray-500">Guarda el agente primero para subir un ícono</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                            <input required name="nombre" value={formData.nombre} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría <span className="text-xs font-normal text-gray-500">(Partition key)</span></label>
                            <input required name="categoria" value={formData.categoria} onChange={handleChange} disabled={!!agent} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja disabled:bg-gray-100" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                            <textarea required name="descripcion" value={formData.descripcion} onChange={handleChange} rows={3} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">División</label>
                            <input required name="division" value={formData.division} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Creador</label>
                            <input required name="creador" value={formData.creador} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                            <input required name="modelo" value={formData.modelo} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                            <input required name="tipo" value={formData.tipo} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                            <select name="estado" value={formData.estado} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja">
                                <option value="Activo">Activo</option>
                                <option value="Inactivo">Inactivo</option>
                                <option value="En Desarrollo">En Desarrollo</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Enlace</label>
                            <input name="enlace" value={formData.enlace} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja" placeholder="https://..." />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Casos de Uso</label>
                            <div className="space-y-2">
                                {formData.casos_uso?.map((item, index) => (
                                    <div key={index} className="flex gap-2 items-start">
                                        <input
                                            value={item}
                                            onChange={(e) => updateArrayItem(index, e.target.value, 'casos_uso')}
                                            className="flex-1 px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja"
                                            placeholder="Describa el caso de uso..."
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeArrayItem(index, 'casos_uso')}
                                            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => addArrayItem('casos_uso')}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-plataforma-naranja bg-orange-50 border border-orange-100 rounded-lg hover:bg-orange-100 transition-colors"
                                >
                                    <Plus size={16} /> Agregar Caso de Uso
                                </button>
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Beneficios</label>
                            <div className="space-y-2">
                                {formData.beneficios?.map((item, index) => (
                                    <div key={index} className="flex gap-2 items-start">
                                        <input
                                            value={item}
                                            onChange={(e) => updateArrayItem(index, e.target.value, 'beneficios')}
                                            className="flex-1 px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja"
                                            placeholder="Describa el beneficio..."
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeArrayItem(index, 'beneficios')}
                                            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => addArrayItem('beneficios')}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-plataforma-turquesa bg-teal-50 border border-teal-100 rounded-lg hover:bg-teal-100 transition-colors"
                                >
                                    <Plus size={16} /> Agregar Beneficio
                                </button>
                            </div>
                        </div>
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

export default AgentsTab;
