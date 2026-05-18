import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Search as SearchIcon, SlidersHorizontal, Plus, MessageSquare,
  ArrowRight, Loader2, ExternalLink,
} from 'lucide-react';
import { useAgents } from '../hooks/useAgents';
import type { Agent } from '../services/agentsApi';

/**
 * Catálogo de agentes — nuevo diseño Claude Design conectado a /agents/ real.
 */
export default function AgentsPage() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todas');
  const nav = useNavigate();

  const { agents, total, categorias, loading, error } = useAgents();

  const categoryOptions = useMemo(
    () => ['Todas', ...categorias.filter(Boolean)],
    [categorias],
  );

  // Solo agentes en producción se muestran (resto = no listos para usar).
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
                  onTry={() => nav(`/chat?agent=${encodeURIComponent(a.id)}`)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function AgentCard({ agent, onTry }: { agent: Agent; onTry: () => void }) {
  const isProd = agent.estado?.toLowerCase().startsWith('produc');
  const status = isProd
    ? { label: 'Activo', dot: 'var(--success-ck)', soft: 'var(--success-soft)', ink: 'oklch(0.40 0.14 155)' }
    : { label: agent.estado || 'Beta', dot: 'oklch(0.65 0.14 65)', soft: 'oklch(0.96 0.04 65)', ink: 'oklch(0.42 0.14 65)' };

  return (
    <div className="ck-card flex flex-col overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-pop cursor-pointer">
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
          {agent.modelo || 'Claude'}
        </span>
      </div>

      <div className="grid grid-cols-2 border-t border-border-soft mt-3.5">
        <button
          onClick={onTry}
          className="py-3 text-[13px] font-medium border-r border-border-soft inline-flex items-center justify-center gap-2"
          style={{ color: 'var(--primary-ck)' }}
        >
          <MessageSquare className="size-3.5" /> Probar
        </button>
        {agent.enlace ? (
          <a
            href={agent.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="py-3 text-[13px] font-medium text-ink-2 inline-flex items-center justify-center gap-2"
          >
            Ver detalles <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <button className="py-3 text-[13px] font-medium text-ink-2 inline-flex items-center justify-center gap-2">
            Ver detalles <ArrowRight className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

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
