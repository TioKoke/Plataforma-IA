import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Search as SearchIcon, SlidersHorizontal, Plus, MessageSquare,
  ArrowRight, Loader2, X, CheckCircle2,
} from 'lucide-react';
import { useAgents } from '../hooks/useAgents';
import type { Agent } from '../services/agentsApi';

/**
 * Catálogo de agentes — diseño Claude Design conectado a /agents/ real.
 * Cada card abre un modal con todos los metadatos del agente y dos CTAs:
 * "Probar en chat" y "Cerrar".
 */
export default function AgentsPage() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todas');
  const [selected, setSelected] = useState<Agent | null>(null);
  const nav = useNavigate();

  const { agents, total, categorias, loading, error } = useAgents();

  const categoryOptions = useMemo(
    () => ['Todas', ...categorias.filter(Boolean)],
    [categorias],
  );

  const visible = useMemo(() => {
    return agents.filter((a) => {
      const inCategory = cat === 'Todas' || a.categoria === cat;
      const ql = q.toLowerCase();
      const matchesText =
        !q ||
        a.nombre.toLowerCase().includes(ql) ||
        (a.descripcion || '').toLowerCase().includes(ql);
      return inCategory && matchesText;
    });
  }, [agents, cat, q]);

  const tryAgent = (a: Agent) => nav(`/chat?agent=${encodeURIComponent(a.id)}`);

  return (
    <>
      <section className="relative pt-12 pb-6">
        <div className="ck-container">
          <span className="ck-pill mb-4">
            <Bot className="size-3" />
            <span className="ck-mono text-[11px] tracking-wider text-ink-2">
              DIRECTORIO CORPORATIVO
            </span>
          </span>
          <h1 className="ck-display text-[56px] max-w-[900px]">
            Catálogo de <em className="italic font-normal">agentes IA</em>
          </h1>
          <p className="mt-4 text-[17px] text-ink-muted max-w-[640px] leading-relaxed">
            Explora {total || agents.length} agentes especializados diseñados para potenciar la eficiencia, seguridad e innovación en tu organización.
          </p>
        </div>
      </section>

      <section className="border-b border-border-soft">
        <div className="ck-container pb-6">
          <div className="flex gap-3 mb-4">
            <div className="flex-1 flex items-center px-3.5 bg-bg-elev border border-border-soft rounded-[10px]">
              <SearchIcon className="size-4 text-ink-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar agentes por nombre o descripción…"
                className="flex-1 px-3 py-3 bg-transparent border-0 outline-none text-sm text-ink"
              />
              <span className="ck-mono text-[11px] text-ink-muted-soft">
                {visible.length} resultados
              </span>
            </div>
            <button className="ck-btn ck-btn-outline">
              <SlidersHorizontal className="size-4" /> Ordenar: Más usados
            </button>
            <button className="ck-btn ck-btn-primary" onClick={() => nav('/backlog')}>
              <Plus className="size-4" /> Solicitar agente
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className="ck-pill cursor-pointer text-xs"
                style={
                  c === cat
                    ? { background: 'var(--ink)', color: 'var(--bg-elev)', borderColor: 'var(--ink)' }
                    : undefined
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="pt-8 pb-20">
        <div className="ck-container">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} />
          ) : visible.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {visible.map((a) => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  onOpen={() => setSelected(a)}
                  onTry={() => tryAgent(a)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {selected && (
        <AgentDetailsModal
          agent={selected}
          onClose={() => setSelected(null)}
          onTry={() => {
            tryAgent(selected);
            setSelected(null);
          }}
        />
      )}
    </>
  );
}

function AgentCard({ agent, onOpen, onTry }: { agent: Agent; onOpen: () => void; onTry: () => void }) {
  const isProd = agent.estado?.toLowerCase().startsWith('produc');
  const status = isProd
    ? { label: 'Activo', dot: 'var(--success-ck)', soft: 'var(--success-soft)', ink: 'oklch(0.40 0.14 155)' }
    : { label: agent.estado || 'Beta', dot: 'oklch(0.65 0.14 65)', soft: 'oklch(0.96 0.04 65)', ink: 'oklch(0.42 0.14 65)' };

  return (
    <div
      onClick={onOpen}
      className="ck-card flex flex-col overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-pop cursor-pointer"
    >
      <div className="px-5 pt-5 flex justify-between items-start">
        <span className="size-11 rounded-xl grid place-items-center bg-ink text-bg-elev">
          <Bot className="size-5" />
        </span>
        <span
          className="ck-pill text-[11px] border-transparent"
          style={{ background: status.soft, color: status.ink }}
        >
          <span className="size-1.5 rounded-full" style={{ background: status.dot }} />
          {status.label}
        </span>
      </div>

      <div className="px-5 pt-4">
        <span className="ck-mono text-[10.5px] text-ink-muted tracking-wider">
          {(agent.categoria || 'GENERAL').toUpperCase()}
        </span>
        <h3 className="ck-display text-[18px] mt-1.5">{agent.nombre}</h3>
        <p className="mt-2 text-[13.5px] text-ink-muted leading-relaxed min-h-[60px] line-clamp-3">
          {agent.descripcion || 'Agente especializado.'}
        </p>
      </div>

      <div className="mx-5 mt-4 pt-3.5 border-t border-border-soft flex justify-between items-center text-xs text-ink-muted">
        <span className="ck-mono truncate max-w-[120px]" title={agent.division || ''}>
          {agent.division || '—'}
        </span>
        <span className="inline-flex items-center gap-1.5 truncate max-w-[140px]" title={agent.modelo || ''}>
          <span className="size-1 rounded-full bg-ink-muted shrink-0" />
          {agent.modelo || 'Sonnet 4.6'}
        </span>
      </div>

      <div className="grid grid-cols-2 border-t border-border-soft mt-3.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTry(); }}
          className="py-3 text-[13px] font-medium border-r border-border-soft inline-flex items-center justify-center gap-2"
          style={{ color: 'var(--primary-ck)' }}
        >
          <MessageSquare className="size-3.5" /> Probar
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="py-3 text-[13px] font-medium text-ink-2 inline-flex items-center justify-center gap-2"
        >
          Ver detalles <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── Modal de detalle ─────────────────── */

function AgentDetailsModal({
  agent, onClose, onTry,
}: { agent: Agent; onClose: () => void; onTry: () => void }) {
  // Cerrar con ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lockear scroll del body mientras el modal está abierto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const isProd = agent.estado?.toLowerCase().startsWith('produc');
  const status = isProd
    ? { label: 'Activo', dot: 'var(--success-ck)', soft: 'var(--success-soft)', ink: 'oklch(0.40 0.14 155)' }
    : { label: agent.estado || 'Beta', dot: 'oklch(0.65 0.14 65)', soft: 'oklch(0.96 0.04 65)', ink: 'oklch(0.42 0.14 65)' };

  const casos = (agent.casos_uso || []).filter(Boolean);
  const beneficios = (agent.beneficios || []).filter(Boolean);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      style={{ background: 'oklch(0.18 0.02 255 / 0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-bg-elev rounded-[16px] border border-border-soft w-full max-w-[720px] max-h-[88vh] overflow-y-auto shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-bg-elev border-b border-border-soft px-6 py-4 flex items-start justify-between gap-4 z-10">
          <div className="flex items-start gap-3 min-w-0">
            <span className="shrink-0 size-12 rounded-xl grid place-items-center bg-ink text-bg-elev">
              <Bot className="size-6" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="ck-mono text-[10.5px] text-ink-muted tracking-wider">
                  {(agent.categoria || 'GENERAL').toUpperCase()}
                </span>
                <span
                  className="ck-pill text-[11px] border-transparent"
                  style={{ background: status.soft, color: status.ink }}
                >
                  <span className="size-1.5 rounded-full" style={{ background: status.dot }} />
                  {status.label}
                </span>
              </div>
              <h2 id="agent-modal-title" className="ck-display text-[24px] leading-tight">
                {agent.nombre}
              </h2>
              <div className="ck-mono text-[11px] text-ink-muted mt-1">
                {agent.division || '—'} · {agent.modelo || 'Sonnet 4.6'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="ck-btn ck-btn-ghost !p-2 shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {/* Descripción */}
          <section>
            <div className="ck-mono text-[11px] text-ink-muted tracking-wider mb-2">
              DESCRIPCIÓN
            </div>
            <p className="text-sm text-ink-2 leading-relaxed">
              {agent.descripcion || 'Sin descripción disponible.'}
            </p>
          </section>

          {/* Casos de uso */}
          {casos.length > 0 && (
            <section>
              <div className="ck-mono text-[11px] text-ink-muted tracking-wider mb-3">
                CASOS DE USO
              </div>
              <ul className="space-y-2.5">
                {casos.map((caso, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-ink-2 leading-relaxed">
                    <span
                      className="shrink-0 mt-0.5 size-5 rounded-full grid place-items-center text-[11px] font-semibold"
                      style={{ background: 'var(--primary-soft)', color: 'var(--primary-ink)' }}
                    >
                      {i + 1}
                    </span>
                    <span>{caso}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Beneficios */}
          {beneficios.length > 0 && (
            <section>
              <div className="ck-mono text-[11px] text-ink-muted tracking-wider mb-3">
                BENEFICIOS
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {beneficios.map((b, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-sm text-ink-2 ck-card p-3"
                  >
                    <CheckCircle2
                      className="size-4 mt-0.5 shrink-0"
                      style={{ color: 'var(--success-ck)' }}
                    />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Metadata adicional */}
          <section className="pt-4 border-t border-border-soft grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="ck-mono text-[10.5px] text-ink-muted tracking-wider">CATEGORÍA</div>
              <div className="text-ink mt-1">{agent.categoria || '—'}</div>
            </div>
            <div>
              <div className="ck-mono text-[10.5px] text-ink-muted tracking-wider">DIVISIÓN</div>
              <div className="text-ink mt-1">{agent.division || '—'}</div>
            </div>
            <div>
              <div className="ck-mono text-[10.5px] text-ink-muted tracking-wider">MODELO</div>
              <div className="text-ink mt-1 ck-mono text-xs">{agent.modelo || 'Sonnet 4.6'}</div>
            </div>
            <div>
              <div className="ck-mono text-[10.5px] text-ink-muted tracking-wider">CREADOR</div>
              <div className="text-ink mt-1">{agent.creador || 'Equipo IA'}</div>
            </div>
          </section>
        </div>

        {/* Footer CTA */}
        <div className="sticky bottom-0 bg-bg-elev border-t border-border-soft px-6 py-4 flex items-center justify-between gap-3">
          <span className="text-[12px] text-ink-muted hidden sm:inline">
            Pulsa <kbd className="ck-mono text-[10.5px] border border-border-soft px-1.5 py-0.5 rounded">Esc</kbd> para cerrar
          </span>
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className="ck-btn ck-btn-ghost text-sm">
              Cerrar
            </button>
            <button type="button" onClick={onTry} className="ck-btn ck-btn-primary text-sm">
              <MessageSquare className="size-4" /> Probar este agente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── States ─────────────────── */

function LoadingState() {
  return (
    <div className="ck-card text-center py-16 px-8">
      <Loader2 className="size-7 animate-spin mx-auto text-ink-muted" />
      <p className="mt-4 text-sm text-ink-muted">Cargando catálogo de agentes…</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="ck-card text-center py-16 px-8">
      <div className="size-14 rounded-2xl bg-bg-inset grid place-items-center mx-auto mb-4">
        <SearchIcon className="size-6 text-ink-muted" />
      </div>
      <h3 className="ck-display text-[20px]">No se pudo cargar el catálogo</h3>
      <p className="mt-2 text-sm text-ink-muted max-w-[380px] mx-auto">{message}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="ck-card text-center py-16 px-8">
      <div className="size-14 rounded-2xl bg-bg-inset text-ink-muted grid place-items-center mx-auto mb-4">
        <SearchIcon className="size-6" />
      </div>
      <h3 className="ck-display text-[20px]">No encontramos agentes que coincidan</h3>
      <p className="mt-2 text-sm text-ink-muted max-w-[380px] mx-auto">
        Prueba con otros términos o solicita un nuevo agente para tu equipo.
      </p>
      <button className="ck-btn ck-btn-primary mt-5">
        <Plus className="size-3.5" /> Solicitar agente
      </button>
    </div>
  );
}
