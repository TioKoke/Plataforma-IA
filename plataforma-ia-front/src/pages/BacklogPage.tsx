import { useState } from 'react';
import {
  Plus, X, ChevronRight, ThumbsUp, AlertCircle, Loader2,
  ClipboardList, Filter, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import SpotlightCard from '../components/reactbits/SpotlightCard';
import BlurText from '../components/reactbits/BlurText';
import { useBacklogs } from '../hooks/useBacklogs';
import {
  createBacklog,
  updateBacklogEstado,
  voteBacklog,
  type BacklogItem,
  type BacklogEstado,
  type BacklogPrioridad,
  type BacklogCreateForm,
} from '../services/backlogApi';

// ── Estado badge ─────────────────────────────────────────────────────────────
const ESTADO_CONFIG: Record<BacklogEstado, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-gray-100 text-gray-700' },
  en_revision: { label: 'En revisión', color: 'bg-yellow-100 text-yellow-800' },
  aprobado: { label: 'Aprobado', color: 'bg-green-100 text-green-800' },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-800' },
  en_desarrollo: { label: 'En desarrollo', color: 'bg-blue-100 text-blue-800' },
};

const PRIORIDAD_CONFIG: Record<BacklogPrioridad, { label: string; color: string }> = {
  baja: { label: 'Baja', color: 'bg-gray-100 text-gray-600' },
  media: { label: 'Media', color: 'bg-yellow-50 text-yellow-700' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  critica: { label: 'Crítica', color: 'bg-red-100 text-red-700 font-semibold' },
};


// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function EstadoBadge({ estado }: { estado: BacklogEstado }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, color: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function PrioridadBadge({ prioridad }: { prioridad: BacklogPrioridad }) {
  const cfg = PRIORIDAD_CONFIG[prioridad] ?? { label: prioridad, color: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ── Detail modal ─────────────────────────────────────────────────────────────
function DetailModal({
  item,
  onClose,
  isAdmin,
  onEstadoChange,
}: {
  item: BacklogItem;
  onClose: () => void;
  isAdmin: boolean;
  onEstadoChange: (id: string, division: string, estado: BacklogEstado) => Promise<void>;
}) {
  const [changing, setChanging] = useState(false);

  const handleEstado = async (estado: BacklogEstado) => {
    setChanging(true);
    try {
      await onEstadoChange(item.id, item.division, estado);
      onClose();
    } finally {
      setChanging(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="bg-white rounded-xl shadow-2xl max-w-[800px] w-full max-h-[90vh] overflow-y-auto relative z-10 flex flex-col"
      >
        <div className="flex items-start justify-between p-6 border-b border-gray-100 bg-white/95 backdrop-blur-md sticky top-0 z-20">
          <div>
            <BlurText
              text={item.titulo}
              delay={30}
              className="font-heading font-semibold text-xl text-plataforma-gris-oscuro mb-2"
            />
            <div className="flex items-center gap-2 mt-1">
              <EstadoBadge estado={item.estado} />
              <PrioridadBadge prioridad={item.prioridad} />
              <span className="text-xs text-gray-500">{item.origen === 'chat' ? '· Vía chat' : '· Vía formulario'}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors bg-white shadow-sm border border-gray-100 text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-gray-50/30">

          <SpotlightCard className="col-span-1 p-5 bg-white border-gray-100 shadow-sm" spotlightColor="rgba(244, 115, 28, 0.08)">
            <Field label="ID" value={item.id} mono />
          </SpotlightCard>

          <SpotlightCard className="col-span-1 p-5 bg-white border-gray-100 shadow-sm" spotlightColor="rgba(244, 115, 28, 0.08)">
            <Field label="Solicitante" value={`${item.solicitante_nombre} (${item.solicitante_email})`} />
          </SpotlightCard>

          <SpotlightCard className="col-span-1 md:col-span-2 p-5 bg-white border-gray-100 shadow-sm" spotlightColor="rgba(244, 115, 28, 0.08)">
            <Field label="Descripción general" value={item.descripcion} />
          </SpotlightCard>

          <SpotlightCard className="col-span-1 md:col-span-2 p-5 bg-white border-gray-100 shadow-sm" spotlightColor="rgba(244, 115, 28, 0.08)">
            <Field label="Problema a resolver" value={item.problema_a_resolver} />
          </SpotlightCard>

          <SpotlightCard className="col-span-1 md:col-span-2 p-5 bg-white border-gray-100 shadow-sm" spotlightColor="rgba(244, 115, 28, 0.08)">
            <Field label="Usuarios objetivo" value={item.usuarios_objetivo} />
          </SpotlightCard>

          {item.funcionalidades_clave.length > 0 && (
            <SpotlightCard className="col-span-1 md:col-span-2 p-5 bg-white border-gray-100 shadow-sm" spotlightColor="rgba(244, 115, 28, 0.08)">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-plataforma-naranja"></span>
                Funcionalidades clave
              </p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {item.funcionalidades_clave.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-700 bg-gray-50/50 p-2.5 rounded-lg border border-gray-50">
                    <span className="text-plataforma-turquesa mt-0.5">•</span> {f}
                  </li>
                ))}
              </ul>
            </SpotlightCard>
          )}

          <SpotlightCard className="col-span-1 p-5 bg-white border-gray-100 shadow-sm" spotlightColor="rgba(244, 115, 28, 0.08)">
            <Field label="Fuentes de datos" value={item.datos_fuentes} />
          </SpotlightCard>

          <SpotlightCard className="col-span-1 p-5 bg-white border-gray-100 shadow-sm" spotlightColor="rgba(244, 115, 28, 0.08)">
            <Field label="Beneficio esperado" value={item.beneficio_esperado} />
          </SpotlightCard>

          <SpotlightCard className="col-span-1 p-5 bg-white border-gray-100 shadow-sm" spotlightColor="rgba(244, 115, 28, 0.08)">
            <Field label="División" value={item.division} />
          </SpotlightCard>

          <SpotlightCard className="col-span-1 p-5 bg-white border-gray-100 shadow-sm flex flex-col justify-center" spotlightColor="rgba(244, 115, 28, 0.08)">
            <div className="flex justify-between items-center w-full">
              <Field label="Creado" value={formatDate(item.created_at)} />
              <div className="text-right">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Votos</p>
                <p className="text-gray-900 font-medium flex items-center justify-end gap-1.5">
                  <ThumbsUp size={14} className="text-plataforma-turquesa" />
                  <span className="text-lg">{item.votos}</span>
                </p>
              </div>
            </div>
          </SpotlightCard>
        </div>

        {isAdmin && (
          <div className="p-6 bg-gray-50 border-t border-gray-200 mt-auto">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Administración: Cambiar estado</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ESTADO_CONFIG) as BacklogEstado[]).map((e) => (
                <button
                  key={e}
                  disabled={e === item.estado || changing}
                  onClick={() => handleEstado(e)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border shadow-sm transition-all focus:ring-2 focus:ring-offset-1 focus:ring-plataforma-naranja disabled:opacity-50 ${e === item.estado
                    ? 'border-plataforma-naranja text-plataforma-naranja bg-plataforma-naranja/5 ring-1 ring-plataforma-naranja'
                    : 'border-gray-200 text-gray-600 bg-white hover:border-plataforma-naranja hover:text-plataforma-naranja hover:shadow-md'
                    }`}
                >
                  {changing && e !== item.estado ? <Loader2 size={14} className="animate-spin inline mr-1.5" /> : null}
                  {ESTADO_CONFIG[e].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-gray-800 leading-relaxed ${mono ? 'font-mono text-xs bg-gray-100/80 px-2 py-1.5 rounded-md inline-block text-gray-600' : ''}`}>{value}</p>
    </div>
  );
}

// ── Create panel (slide-in) ───────────────────────────────────────────────────
const EMPTY_FORM: BacklogCreateForm = {
  titulo: '',
  descripcion: '',
  problema_a_resolver: '',
  usuarios_objetivo: '',
  funcionalidades_clave: [],
  datos_fuentes: '',
  beneficio_esperado: '',
  prioridad: 'media',
  division: '',
  solicitante_nombre: '',
  solicitante_email: '',
  origen: 'formulario',
};

function CreatePanel({
  onClose,
  onCreated,
  defaultEmail,
  defaultNombre,
  defaultDivision,
}: {
  onClose: () => void;
  onCreated: () => void;
  defaultEmail: string;
  defaultNombre: string;
  defaultDivision: string;
}) {
  const { getIdToken } = useAuth();
  const [form, setForm] = useState<BacklogCreateForm>({
    ...EMPTY_FORM,
    solicitante_email: defaultEmail,
    solicitante_nombre: defaultNombre,
    division: defaultDivision,
  });
  const [funcInput, setFuncInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof BacklogCreateForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const addFunc = () => {
    const trimmed = funcInput.trim();
    if (!trimmed) return;
    setForm((prev) => ({
      ...prev,
      funcionalidades_clave: [...prev.funcionalidades_clave, trimmed],
    }));
    setFuncInput('');
  };

  const removeFunc = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      funcionalidades_clave: prev.funcionalidades_clave.filter((_, i) => i !== idx),
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo || !form.problema_a_resolver) {
      setError('El título y el problema a resolver son obligatorios.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getIdToken();
      await createBacklog(form, token);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear requerimiento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-heading font-semibold text-lg text-plataforma-gris-oscuro">
            Nuevo requerimiento
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {error}
            </div>
          )}

          <FormField label="Título *" required>
            <input
              value={form.titulo}
              onChange={(e) => update('titulo', e.target.value)}
              placeholder="Ej: Agente de análisis de vibraciones SAG"
              className="input-base"
              required
            />
          </FormField>

          <FormField label="Descripción">
            <textarea
              value={form.descripcion}
              onChange={(e) => update('descripcion', e.target.value)}
              placeholder="Descripción general del agente propuesto"
              rows={2}
              className="input-base resize-none"
            />
          </FormField>

          <FormField label="Problema a resolver *" required>
            <textarea
              value={form.problema_a_resolver}
              onChange={(e) => update('problema_a_resolver', e.target.value)}
              placeholder="¿Qué problema específico busca resolver este agente?"
              rows={2}
              className="input-base resize-none"
              required
            />
          </FormField>

          <FormField label="Usuarios objetivo">
            <input
              value={form.usuarios_objetivo}
              onChange={(e) => update('usuarios_objetivo', e.target.value)}
              placeholder="Ej: Ingenieros de mantenimiento, supervisores de turno"
              className="input-base"
            />
          </FormField>

          <FormField label="Funcionalidades clave">
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={funcInput}
                  onChange={(e) => setFuncInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFunc(); } }}
                  placeholder="Agregar funcionalidad..."
                  className="input-base flex-1"
                />
                <button
                  type="button"
                  onClick={addFunc}
                  className="px-3 py-2 bg-plataforma-naranja text-white rounded-lg text-sm hover:bg-plataforma-naranja/90 transition-colors"
                >
                  +
                </button>
              </div>
              {form.funcionalidades_clave.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg text-sm">
                  <span className="flex-1 text-gray-700">{f}</span>
                  <button type="button" onClick={() => removeFunc(i)} className="text-gray-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </FormField>

          <FormField label="Fuentes de datos">
            <input
              value={form.datos_fuentes}
              onChange={(e) => update('datos_fuentes', e.target.value)}
              placeholder="Ej: OSIsoft PI, Excel de mantenciones, SAP"
              className="input-base"
            />
          </FormField>

          <FormField label="Beneficio esperado">
            <textarea
              value={form.beneficio_esperado}
              onChange={(e) => update('beneficio_esperado', e.target.value)}
              placeholder="Ej: Reducir detenciones no programadas en 20%"
              rows={2}
              className="input-base resize-none"
            />
          </FormField>

          <FormField label="Prioridad">
            <select
              value={form.prioridad}
              onChange={(e) => update('prioridad', e.target.value)}
              className="input-base"
            >
              {(Object.keys(PRIORIDAD_CONFIG) as BacklogPrioridad[]).map((p) => (
                <option key={p} value={p}>{PRIORIDAD_CONFIG[p].label}</option>
              ))}
            </select>
          </FormField>

          <div className="pt-2 border-t border-gray-100 space-y-2">
            <p className="text-xs text-gray-500">Solicitante (pre-llenado desde tu sesión)</p>
            <p className="text-sm text-gray-700">{form.solicitante_nombre}</p>
            <p className="text-xs text-gray-500">{form.solicitante_email}</p>
            {defaultDivision ? (
              <p className="text-xs text-gray-500">División: {form.division}</p>
            ) : (
              <FormField label="División *" required>
                <input
                  value={form.division}
                  onChange={(e) => update('division', e.target.value)}
                  placeholder="Ej: Minería, Refinería, Exploración"
                  className="input-base"
                  required
                />
              </FormField>
            )}
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-plataforma-naranja text-white rounded-lg text-sm hover:bg-plataforma-naranja/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function BacklogRow({
  item,
  onSelect,
  onVote,
  votingId,
  userEmail,
}: {
  item: BacklogItem;
  onSelect: (item: BacklogItem) => void;
  onVote: (id: string, division: string) => void;
  votingId: string | null;
  userEmail: string;
}) {
  const yaVoto = userEmail ? item.votos_usuarios?.includes(userEmail) : false;

  return (
    <tr className="hover:bg-gray-50 transition-colors cursor-pointer group" onClick={() => onSelect(item)}>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-plataforma-gris-oscuro group-hover:text-plataforma-naranja transition-colors">
          {item.titulo}
        </p>
        <p className="text-xs text-gray-500 truncate max-w-xs mt-0.5">{item.descripcion}</p>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <EstadoBadge estado={item.estado} />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <PrioridadBadge prioridad={item.prioridad} />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
        {formatDate(item.created_at)}
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
        {item.origen === 'chat' ? 'Chat' : 'Formulario'}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={(e) => { e.stopPropagation(); if (!yaVoto) onVote(item.id, item.division); }}
          disabled={votingId === item.id || yaVoto}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${yaVoto
            ? 'border-plataforma-turquesa text-plataforma-turquesa bg-plataforma-turquesa/5 cursor-default'
            : 'border-gray-200 text-gray-600 hover:border-plataforma-turquesa hover:text-plataforma-turquesa disabled:opacity-50'
            }`}
          title={yaVoto ? 'Ya votaste por este requerimiento' : 'Votar por este requerimiento'}
        >
          {votingId === item.id
            ? <Loader2 size={12} className="animate-spin" />
            : yaVoto
              ? <CheckCircle2 size={12} />
              : <ThumbsUp size={12} />}
          {item.votos}
        </button>
      </td>
      <td className="px-4 py-3">
        <ChevronRight size={16} className="text-gray-400 group-hover:text-plataforma-naranja transition-colors" />
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const BacklogPage = () => {
  const { userEmail, userName, userDivision, isAdmin, isReviewer, getIdToken } = useAuth();
  const canManage = isAdmin || isReviewer;

  const [activeTab, setActiveTab] = useState<'mis' | 'todos'>('mis');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BacklogItem | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState<BacklogEstado | ''>('');
  const [filterPrioridad, setFilterPrioridad] = useState<BacklogPrioridad | ''>('');

  const misFilters = {
    division: userDivision ?? undefined,
    mi_email: userEmail ?? undefined,
    estado: filterEstado || undefined,
    prioridad: filterPrioridad || undefined,
  };

  const todosFilters = {
    // Reviewer y Admin ven todas las divisiones; User solo la suya
    division: canManage ? undefined : (userDivision ?? undefined),
    estado: filterEstado || undefined,
    prioridad: filterPrioridad || undefined,
  };

  // null → skip fetch; se usa cuando la tab está inactiva o cuando
  // userDivision aún no se cargó (para evitar que usuarios normales
  // vean items de otras divisiones durante el load inicial)
  const misActive = activeTab === 'mis' ? misFilters : null;
  const todosActive = activeTab === 'todos'
    ? (canManage || userDivision !== null ? todosFilters : null)
    : null;

  const misBacklogs = useBacklogs(misActive);
  const todosBacklogs = useBacklogs(todosActive);

  const current = activeTab === 'mis' ? misBacklogs : todosBacklogs;

  const handleVote = async (id: string, division: string) => {
    if (!userEmail) return;
    setVotingId(id);
    try {
      const token = await getIdToken();
      await voteBacklog(id, division, userEmail, token);
      current.refetch();
    } catch (err) {
      if (err instanceof Error && err.message !== 'ya_votaste') {
        console.error('Error al votar:', err.message);
      }
    } finally {
      setVotingId(null);
    }
  };

  const handleEstadoChange = async (id: string, division: string, estado: BacklogEstado) => {
    const token = await getIdToken();
    if (!token) return;
    await updateBacklogEstado(id, division, estado, token);
    current.refetch();
  };

  return (
    <div className="min-h-screen bg-bg">
      <div className="ck-container py-10">

        {/* Header — design system */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="ck-pill mb-3">
              <ClipboardList className="size-3" />
              <span className="ck-mono text-[11px] tracking-wider text-ink-2">
                MIS REQUERIMIENTOS
              </span>
            </span>
            <h1 className="ck-display text-[40px] leading-tight">
              Backlog
            </h1>
            <p className="text-base text-ink-muted mt-2">
              Propuestas de nuevos agentes IA{userDivision ? ` · División ${userDivision}` : ''}.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="ck-btn ck-btn-primary"
          >
            <Plus className="size-4" />
            Nuevo requerimiento
          </button>
        </div>

        {/* Tabs — pill-style */}
        <div className="flex gap-0.5 mb-5 bg-bg-inset p-1 rounded-full border border-border-soft w-fit">
          <button
            onClick={() => setActiveTab('mis')}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all ${activeTab === 'mis'
              ? 'bg-bg-elev text-ink shadow-[0_1px_2px_oklch(0.18_0.02_255/0.06),0_0_0_1px_var(--border-soft)]'
              : 'text-ink-muted hover:text-ink-2'}`}
          >
            Mis requerimientos
          </button>
          <button
            onClick={() => setActiveTab('todos')}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all ${activeTab === 'todos'
              ? 'bg-bg-elev text-ink shadow-[0_1px_2px_oklch(0.18_0.02_255/0.06),0_0_0_1px_var(--border-soft)]'
              : 'text-ink-muted hover:text-ink-2'}`}
          >
            {canManage ? 'Todos' : `Todos (${userDivision})`}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Filter size={14} className="text-gray-400" />
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as BacklogEstado | '')}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:border-plataforma-naranja"
          >
            <option value="">Todos los estados</option>
            {(Object.keys(ESTADO_CONFIG) as BacklogEstado[]).map((e) => (
              <option key={e} value={e}>{ESTADO_CONFIG[e].label}</option>
            ))}
          </select>
          <select
            value={filterPrioridad}
            onChange={(e) => setFilterPrioridad(e.target.value as BacklogPrioridad | '')}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:border-plataforma-naranja"
          >
            <option value="">Todas las prioridades</option>
            {(Object.keys(PRIORIDAD_CONFIG) as BacklogPrioridad[]).map((p) => (
              <option key={p} value={p}>{PRIORIDAD_CONFIG[p].label}</option>
            ))}
          </select>
          <button
            onClick={current.refetch}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-plataforma-naranja transition-colors"
          >
            <RefreshCw size={13} /> Actualizar
          </button>
          <span className="ml-auto text-xs text-gray-500">{current.total} requerimiento(s)</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {current.loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-plataforma-naranja" />
            </div>
          ) : current.error ? (
            <div className="flex items-center justify-center gap-2 py-16 text-red-600">
              <AlertCircle size={18} />
              <span className="text-sm">{current.error}</span>
            </div>
          ) : current.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <ClipboardList size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Sin requerimientos registrados</p>
              <p className="text-xs mt-1">
                {activeTab === 'mis'
                  ? 'Propón un nuevo agente desde el chat o con el botón "Nuevo requerimiento"'
                  : 'Nadie de tu división ha registrado requerimientos aún'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Requerimiento</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Prioridad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Origen</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Votos</th>
                  <th className="px-4 py-3 w-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {current.items.map((item) => (
                  <BacklogRow
                    key={item.id}
                    item={item}
                    onSelect={setSelectedItem}
                    onVote={handleVote}
                    votingId={votingId}
                    userEmail={userEmail ?? ''}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create panel */}
      {showCreate && (
        <CreatePanel
          onClose={() => setShowCreate(false)}
          onCreated={current.refetch}
          defaultEmail={userEmail ?? ''}
          defaultNombre={userName ?? ''}
          defaultDivision={userDivision ?? ''}
        />
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selectedItem && (
          <DetailModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            isAdmin={canManage}
            onEstadoChange={handleEstadoChange}
          />
        )}
      </AnimatePresence>

      {/* Inline CSS for inputs */}
      <style>{`
        .input-base {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-base:focus {
          border-color: #F4731C;
        }
      `}</style>
    </div>
  );
};

export default BacklogPage;
