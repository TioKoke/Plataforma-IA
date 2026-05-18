import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Pencil, Trash2, Plus, Bot, Save, X, ImagePlus,
    Search, Sparkles, ListChecks, Award, Image as ImageIcon, Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import {
    fetchAgents, createAgent, updateAgent, deleteAgent, uploadAgentIcon,
} from '../../services/agentsApi';
import type { Agent } from '../../services/agentsApi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function resolveIconUrl(icon_url: string): string {
    if (icon_url.startsWith('/agents/')) return `${API_URL}${icon_url}`;
    return icon_url;
}

/** Mini avatar para tabla y modal */
function AgentAvatar({ icon_url, sizePx = 32 }: { icon_url?: string; sizePx?: number }) {
    const [failed, setFailed] = useState(false);
    if (icon_url && !failed) {
        return (
            <img
                src={resolveIconUrl(icon_url)}
                onError={() => setFailed(true)}
                className="rounded-lg object-cover"
                style={{ width: sizePx, height: sizePx }}
                alt="icon"
            />
        );
    }
    return <Bot size={Math.round(sizePx * 0.55)} className="text-ink-muted" />;
}

const STATE_STYLES: Record<string, string> = {
    Activo: 'bg-bg-inset text-ink-2 border-border-soft',
    Inactivo: 'bg-bg-inset text-ink-muted border-border-soft',
    'En Desarrollo': 'bg-bg-inset text-ink-muted border-border-soft',
    Producción: 'bg-bg-inset text-ink-2 border-border-soft',
};

const AgentsTab = () => {
    const { getIdToken } = useAuth();
    const { showAlert } = useAlert();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
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

    useEffect(() => { loadData(); }, [loadData]);

    const handleOpenModal = (agent?: Agent) => {
        setEditingAgent(agent ?? null);
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

    const filtered = search
        ? agents.filter((a) => {
              const q = search.toLowerCase();
              return (
                  a.nombre.toLowerCase().includes(q) ||
                  a.categoria.toLowerCase().includes(q) ||
                  a.division.toLowerCase().includes(q)
              );
          })
        : agents;

    return (
        <div className="p-6">
            {/* Heading + acciones */}
            <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                <div>
                    <h2 className="ck-display text-[22px] flex items-center gap-2.5">
                        <span
                            className="size-8 rounded-lg grid place-items-center"
                            style={{ background: 'var(--primary-soft)', color: 'var(--primary-ink)' }}
                        >
                            <Bot size={16} />
                        </span>
                        Catálogo de Agentes
                    </h2>
                    <p className="text-sm text-ink-muted mt-1.5">
                        Edita la configuración, el modelo, los casos de uso y los beneficios de cada agente.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <div className="flex items-center px-3 bg-bg-elev border border-border-soft rounded-[10px] h-10 w-72">
                        <Search className="size-4 text-ink-muted-soft" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por nombre, categoría…"
                            className="flex-1 px-2.5 bg-transparent border-0 outline-none text-sm text-ink"
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="ck-btn ck-btn-primary"
                    >
                        <Plus size={16} />
                        Nuevo agente
                    </button>
                </div>
            </div>

            {/* Tabla */}
            <div className="ck-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="border-b border-border-soft bg-bg-inset/60">
                            <tr className="ck-mono text-[11px] tracking-wider text-ink-muted">
                                <th className="px-5 py-3 font-medium uppercase">Nombre</th>
                                <th className="px-5 py-3 font-medium uppercase">Categoría</th>
                                <th className="px-5 py-3 font-medium uppercase">División</th>
                                <th className="px-5 py-3 font-medium uppercase">Modelo</th>
                                <th className="px-5 py-3 font-medium uppercase">Estado</th>
                                <th className="px-5 py-3 font-medium uppercase text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-soft">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-10 text-center text-ink-muted text-sm">
                                        Cargando agentes…
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-10 text-center text-ink-muted text-sm">
                                        {search ? 'Sin resultados para tu búsqueda.' : 'No hay agentes registrados.'}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((ag) => (
                                    <tr key={ag.id} className="hover:bg-bg-inset/60 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="size-9 rounded-lg bg-bg-inset border border-border-soft grid place-items-center shrink-0 overflow-hidden">
                                                    <AgentAvatar icon_url={ag.icon_url} sizePx={32} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-medium text-ink truncate">{ag.nombre}</div>
                                                    <div className="text-[12px] text-ink-muted truncate">
                                                        {ag.tipo || 'Agente'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="ck-mono text-[10.5px] tracking-wider px-1.5 py-0.5 rounded bg-bg-inset text-ink-2 border border-border-soft">
                                                {ag.categoria}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-ink-muted text-[13px]">{ag.division}</td>
                                        <td className="px-5 py-3.5 text-ink-muted text-[12.5px] ck-mono">{ag.modelo}</td>
                                        <td className="px-5 py-3.5">
                                            <span
                                                className={`ck-mono text-[10.5px] tracking-wider px-1.5 py-0.5 rounded border ${
                                                    STATE_STYLES[ag.estado] ?? STATE_STYLES.Activo
                                                }`}
                                            >
                                                {ag.estado.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <button
                                                onClick={() => handleOpenModal(ag)}
                                                className="inline-flex items-center justify-center size-8 rounded-lg text-ink-muted hover:text-ink-2 hover:bg-bg-inset transition-colors mr-1"
                                                title="Editar agente"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(ag.id, ag.categoria)}
                                                className="inline-flex items-center justify-center size-8 rounded-lg text-ink-muted hover:text-red-600 hover:bg-bg-inset transition-colors"
                                                title="Eliminar agente"
                                            >
                                                <Trash2 size={14} />
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

/* ─────────────────────────────────────────────────────────────────────── */

interface AgentModalProps {
    agent: Agent | null;
    onClose: () => void;
    onSuccess: () => void;
    getIdToken: () => Promise<string | null>;
}

const SECTION_CLS = 'rounded-xl border border-border-soft bg-bg-elev p-5 space-y-4';
const LABEL_CLS = 'block text-[12px] font-medium text-ink-2 mb-1.5';
const INPUT_CLS =
    'w-full px-3 py-2 bg-bg-elev border border-border-soft rounded-[10px] text-sm text-ink ' +
    'placeholder:text-ink-muted-soft outline-none focus:border-[var(--primary-ck)] focus:ring-1 ' +
    'focus:ring-[var(--primary-ck)] transition-colors';

const AgentModal: React.FC<AgentModalProps> = ({ agent, onClose, onSuccess, getIdToken }) => {
    const { showAlert } = useAlert();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState<Partial<Agent>>(
        agent || {
            nombre: '', tipo: 'Bot de Chat', descripcion: '', creador: '',
            modelo: 'claude-sonnet-4-6', estado: 'Activo', enlace: '', categoria: '',
            division: 'Corporativo', casos_uso: [], beneficios: [],
        },
    );
    const [loading, setLoading] = useState(false);
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState<string | null>(
        agent?.icon_url ? resolveIconUrl(agent.icon_url) : null,
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
            showAlert('Usuario no autenticado', 'error');
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
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const addArrayItem = (field: 'casos_uso' | 'beneficios') =>
        setFormData((prev) => ({ ...prev, [field]: [...(prev[field] || []), ''] }));
    const updateArrayItem = (index: number, value: string, field: 'casos_uso' | 'beneficios') =>
        setFormData((prev) => {
            const arr = [...(prev[field] || [])];
            arr[index] = value;
            return { ...prev, [field]: arr };
        });
    const removeArrayItem = (index: number, field: 'casos_uso' | 'beneficios') =>
        setFormData((prev) => {
            const arr = [...(prev[field] || [])];
            arr.splice(index, 1);
            return { ...prev, [field]: arr };
        });

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'oklch(0.18 0.02 255 / 0.55)', backdropFilter: 'blur(4px)' }}
        >
            <div className="bg-bg-elev rounded-2xl shadow-pop w-full max-w-4xl max-h-[92vh] overflow-y-auto border border-border-soft">
                {/* Sticky header */}
                <div className="sticky top-0 bg-bg-elev/95 backdrop-blur border-b border-border-soft px-6 py-4 flex justify-between items-center z-10">
                    <div>
                        <div className="ck-mono text-[10.5px] tracking-wider text-ink-muted">
                            {agent ? 'EDITAR AGENTE' : 'NUEVO AGENTE'}
                        </div>
                        <h3 className="ck-display text-[22px] leading-tight mt-0.5">
                            {agent ? formData.nombre || 'Agente sin nombre' : 'Crear agente'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="inline-flex items-center justify-center size-9 rounded-lg text-ink-muted hover:text-ink hover:bg-bg-inset transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-bg">
                    {/* ─── Identidad visual ─── */}
                    <section className={SECTION_CLS}>
                        <header className="flex items-center gap-2 mb-1">
                            <ImageIcon size={14} style={{ color: 'var(--primary-ck)' }} />
                            <span className="ck-mono text-[11px] tracking-wider text-ink-2">IDENTIDAD VISUAL</span>
                        </header>
                        <div className="flex items-center gap-4">
                            <div className="size-16 rounded-xl bg-bg-inset border border-border-soft grid place-items-center overflow-hidden shrink-0">
                                {iconPreview ? (
                                    <img src={iconPreview} className="w-full h-full object-cover" alt="preview" />
                                ) : (
                                    <Bot size={26} className="text-ink-muted" />
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="text-[13px] font-medium text-ink mb-1">Ícono del agente</p>
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
                                            className="ck-btn ck-btn-outline"
                                        >
                                            <ImagePlus size={14} />
                                            {iconFile ? 'Cambiar imagen' : agent.icon_url ? 'Reemplazar ícono' : 'Subir ícono'}
                                        </button>
                                        {iconFile && (
                                            <p className="text-[11.5px] text-ink-muted mt-1.5">
                                                {iconFile.name} — se subirá al guardar
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-[12px] text-ink-muted">
                                        Crea y guarda el agente primero, después podrás subir un ícono.
                                    </p>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ─── Datos básicos ─── */}
                    <section className={SECTION_CLS}>
                        <header className="flex items-center gap-2 mb-1">
                            <Settings size={14} style={{ color: 'var(--primary-ck)' }} />
                            <span className="ck-mono text-[11px] tracking-wider text-ink-2">DATOS BÁSICOS</span>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={LABEL_CLS}>Nombre</label>
                                <input required name="nombre" value={formData.nombre} onChange={handleChange} className={INPUT_CLS} />
                            </div>
                            <div>
                                <label className={LABEL_CLS}>
                                    Categoría <span className="text-ink-muted-soft font-normal">(no editable)</span>
                                </label>
                                <input
                                    required
                                    name="categoria"
                                    value={formData.categoria}
                                    onChange={handleChange}
                                    disabled={!!agent}
                                    className={INPUT_CLS + ' disabled:bg-bg-inset disabled:text-ink-muted'}
                                />
                            </div>
                            <div>
                                <label className={LABEL_CLS}>División</label>
                                <input required name="division" value={formData.division} onChange={handleChange} className={INPUT_CLS} />
                            </div>
                            <div>
                                <label className={LABEL_CLS}>Creador / equipo</label>
                                <input required name="creador" value={formData.creador} onChange={handleChange} className={INPUT_CLS} />
                            </div>
                            <div>
                                <label className={LABEL_CLS}>Tipo</label>
                                <input required name="tipo" value={formData.tipo} onChange={handleChange} className={INPUT_CLS} />
                            </div>
                            <div>
                                <label className={LABEL_CLS}>Estado</label>
                                <select name="estado" value={formData.estado} onChange={handleChange} className={INPUT_CLS}>
                                    <option value="Activo">Activo</option>
                                    <option value="Inactivo">Inactivo</option>
                                    <option value="En Desarrollo">En Desarrollo</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className={LABEL_CLS}>Enlace</label>
                                <input
                                    name="enlace"
                                    value={formData.enlace}
                                    onChange={handleChange}
                                    className={INPUT_CLS}
                                    placeholder="https://… (opcional)"
                                />
                            </div>
                        </div>
                    </section>

                    {/* ─── Funcionalidades ─── */}
                    <section className={SECTION_CLS}>
                        <header className="flex items-center gap-2 mb-1">
                            <Sparkles size={14} style={{ color: 'var(--primary-ck)' }} />
                            <span className="ck-mono text-[11px] tracking-wider text-ink-2">FUNCIONALIDADES</span>
                        </header>
                        <p className="text-[12.5px] text-ink-muted -mt-1">
                            Estos campos definen qué hace el agente y cómo se presenta al usuario en el chat.
                            La <span className="font-medium text-ink-2">descripción</span> y los{' '}
                            <span className="font-medium text-ink-2">casos de uso</span> se inyectan al system
                            prompt y guían el comportamiento del modelo.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className={LABEL_CLS}>Descripción funcional</label>
                                <textarea
                                    required
                                    name="descripcion"
                                    value={formData.descripcion}
                                    onChange={handleChange}
                                    rows={3}
                                    className={INPUT_CLS}
                                    placeholder="Qué hace este agente, en qué dominio opera y a quién está dirigido."
                                />
                            </div>
                            <div>
                                <label className={LABEL_CLS}>Modelo</label>
                                <input
                                    required
                                    name="modelo"
                                    value={formData.modelo}
                                    onChange={handleChange}
                                    className={INPUT_CLS}
                                    placeholder="claude-sonnet-4-6 / gpt-4o / etc."
                                />
                            </div>
                            <div className="hidden md:block" />

                            {/* Casos de uso */}
                            <div className="md:col-span-2">
                                <label className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2 mb-2">
                                    <ListChecks size={13} style={{ color: 'var(--primary-ck)' }} />
                                    Casos de uso
                                </label>
                                <div className="space-y-2">
                                    {formData.casos_uso?.map((item, index) => (
                                        <div key={index} className="flex gap-2 items-start">
                                            <span className="ck-mono text-[11px] text-ink-muted-soft pt-2.5 w-5 text-right">
                                                {index + 1}
                                            </span>
                                            <input
                                                value={item}
                                                onChange={(e) => updateArrayItem(index, e.target.value, 'casos_uso')}
                                                className={INPUT_CLS}
                                                placeholder="Ej. Resumir reportes semanales de ventas"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeArrayItem(index, 'casos_uso')}
                                                className="p-2.5 text-ink-muted hover:text-red-600 hover:bg-bg-inset rounded-lg transition-colors border border-transparent hover:border-border-soft"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => addArrayItem('casos_uso')}
                                        className="ck-btn ck-btn-outline"
                                    >
                                        <Plus size={14} /> Agregar caso de uso
                                    </button>
                                </div>
                            </div>

                            {/* Beneficios */}
                            <div className="md:col-span-2">
                                <label className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2 mb-2">
                                    <Award size={13} style={{ color: 'var(--primary-ck)' }} />
                                    Beneficios
                                </label>
                                <div className="space-y-2">
                                    {formData.beneficios?.map((item, index) => (
                                        <div key={index} className="flex gap-2 items-start">
                                            <span className="ck-mono text-[11px] text-ink-muted-soft pt-2.5 w-5 text-right">
                                                {index + 1}
                                            </span>
                                            <input
                                                value={item}
                                                onChange={(e) => updateArrayItem(index, e.target.value, 'beneficios')}
                                                className={INPUT_CLS}
                                                placeholder="Ej. Ahorra 4h por semana al equipo de operaciones"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeArrayItem(index, 'beneficios')}
                                                className="p-2.5 text-ink-muted hover:text-red-600 hover:bg-bg-inset rounded-lg transition-colors border border-transparent hover:border-border-soft"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => addArrayItem('beneficios')}
                                        className="ck-btn ck-btn-outline"
                                    >
                                        <Plus size={14} /> Agregar beneficio
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Footer */}
                    <div className="flex justify-end gap-2.5 pt-4 border-t border-border-soft -mx-6 px-6 -mb-6 pb-6 sticky bottom-0 bg-bg-elev/95 backdrop-blur">
                        <button type="button" onClick={onClose} className="ck-btn ck-btn-ghost">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="ck-btn ck-btn-primary">
                            <Save size={14} />
                            {loading ? 'Guardando…' : agent ? 'Guardar cambios' : 'Crear agente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AgentsTab;
