import { useNavigate } from 'react-router-dom';
import {
  Users, Bot, MessageSquare, Zap, ArrowRight, Sparkles, Video,
} from 'lucide-react';

export default function HomePage() {
  const nav = useNavigate();

  const stats = [
    { value: '1,284', label: 'Usuarios activos',     hint: 'Conectados esta semana', icon: Users },
    { value: '17',    label: 'Agentes disponibles',  hint: 'En todas las áreas',     icon: Bot },
    { value: '8,420', label: 'Interacciones',        hint: 'Desde el lanzamiento',   icon: MessageSquare },
    { value: '98.6%', label: 'Uptime',               hint: 'Últimos 30 días',         icon: Zap },
  ];

  const resources = [
    { tag: 'Videos',   tone: 'primary' as const, icon: Video,         title: 'Centro de aprendizaje',     desc: 'Contenido audiovisual estructurado por nivel para que tu equipo se familiarice con IA aplicada al negocio.', cta: 'Ver videos',       to: '/aprende' },
    { tag: 'Catálogo', tone: 'ink'     as const, icon: Bot,           title: 'Catálogo de agentes',       desc: 'Explora 17 agentes especializados en procesos críticos, prueba sus capacidades y solicita despliegues.',     cta: 'Explorar agentes', to: '/agentes' },
    { tag: 'Chat',     tone: 'muted'   as const, icon: MessageSquare, title: 'Asistente conversacional',  desc: 'Consulta en lenguaje natural sobre procesos, sube documentos y recibe respuestas con contexto verificado.',  cta: 'Abrir chat',       to: '/chat' },
  ];

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border-soft">
        <div className="grid-bg grid-fade absolute inset-0 opacity-60" />
        <div
          className="absolute -top-52 -right-44 size-[540px] blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--primary-soft) 0%, transparent 65%)' }}
        />

        <div className="ck-container relative grid grid-cols-[1.1fr_1fr] gap-16 items-center py-20">
          <div>
            <span className="ck-pill mb-5">
              <span
                className="size-1.5 rounded-full"
                style={{ background: 'var(--success-ck)', boxShadow: '0 0 0 3px var(--success-soft)' }}
              />
              <span className="ck-mono text-[11px] tracking-wider text-ink-2">
                PLATAFORMA ACTIVA · v2.4
              </span>
            </span>

            <h1 className="ck-display text-[64px]">
              Acelera tu organización<br />
              con <span style={{ color: 'var(--primary-ck)' }}>agentes de IA</span> que entienden tu contexto.
            </h1>

            <p className="mt-5 text-[17px] text-ink-muted max-w-[540px] leading-relaxed">
              Una plataforma unificada para acceder, entrenar y desplegar agentes especializados —
              con observabilidad, control de costos y gobernanza desde el primer día.
            </p>

            <div className="flex gap-3 mt-8">
              <button className="ck-btn ck-btn-primary" onClick={() => nav('/chat')}>
                Abrir Chat IA <ArrowRight className="size-4" />
              </button>
              <button className="ck-btn ck-btn-outline" onClick={() => nav('/agentes')}>
                Ver catálogo de agentes
              </button>
            </div>

            <div className="flex gap-6 mt-9 pt-6 border-t border-border-soft">
              {[
                { k: 'SOC 2',    v: 'Type II' },
                { k: 'Latencia', v: '<200ms' },
                { k: 'Modelos',  v: '12 LLMs' },
              ].map((it) => (
                <div key={it.k}>
                  <div className="ck-mono text-[11px] text-ink-muted tracking-wider">{it.k.toUpperCase()}</div>
                  <div className="text-[15px] font-semibold text-ink mt-1">{it.v}</div>
                </div>
              ))}
            </div>
          </div>

          <HeroPreview />
        </div>
      </section>

      {/* STATS */}
      <section className="py-12 border-b border-border-soft">
        <div className="ck-container">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="ck-display text-[22px] m-0">Estado de la plataforma</h2>
            <span className="ck-pill">
              <span className="size-1.5 rounded-full" style={{ background: 'var(--success-ck)' }} />
              <span className="text-ink-muted">Actualizado hace 2 min</span>
            </span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="ck-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className="size-9 rounded-[10px] grid place-items-center"
                      style={{ background: 'var(--primary-soft)', color: 'var(--primary-ink)' }}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="ck-mono text-[10px] text-ink-muted tracking-wider">EN VIVO</span>
                  </div>
                  <div className="ck-display text-[32px] leading-none">{s.value}</div>
                  <div className="mt-1.5 text-[13.5px] font-medium text-ink-2">{s.label}</div>
                  <div className="text-xs text-ink-muted">{s.hint}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* RESOURCES */}
      <section className="pt-20 pb-8">
        <div className="ck-container">
          <div className="grid grid-cols-[1fr_auto] items-end gap-6 mb-8">
            <div>
              <span className="ck-mono text-[11px] tracking-wider" style={{ color: 'var(--primary-ck)' }}>
                03 RECURSOS
              </span>
              <h2 className="ck-display text-[40px] mt-2 max-w-[720px]">
                Todo lo que necesitas, en un solo lugar.
              </h2>
              <p className="mt-3 text-base text-ink-muted max-w-[560px]">
                Aprende, prueba y conversa con la plataforma. Diseñada para que cualquier persona del equipo pueda incorporar IA a su trabajo diario.
              </p>
            </div>
            <button className="ck-btn ck-btn-outline" onClick={() => nav('/agentes')}>
              Explorar catálogo completo <ArrowRight className="size-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {resources.map((r) => (
              <ResourceCard key={r.title} {...r} onClick={() => nav(r.to)} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pt-16 pb-24">
        <div className="ck-container">
          <div className="ck-card relative overflow-hidden px-14 py-12 grid grid-cols-[1.4fr_1fr] gap-12 items-center">
            <div
              className="absolute inset-0 opacity-50 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 90% 50%, var(--primary-soft) 0%, transparent 50%)',
              }}
            />
            <div className="relative">
              <span
                className="ck-pill mb-4 border-transparent"
                style={{ background: 'var(--primary-soft)', color: 'var(--primary-ink)' }}
              >
                <Sparkles className="size-3" style={{ color: 'var(--primary-ck)' }} />
                <span className="ck-mono text-[11px] tracking-wider">PROPUESTAS ABIERTAS</span>
              </span>
              <h2 className="ck-display text-[40px]">¿Tienes una idea para un nuevo agente?</h2>
              <p className="mt-3.5 mb-6 text-base text-ink-muted max-w-[520px]">
                Cualquier persona del equipo puede proponer un caso de uso. Lo revisamos en menos de 5 días hábiles y, si encaja, lo construimos contigo.
              </p>
              <div className="flex gap-3">
                <button className="ck-btn ck-btn-primary" onClick={() => nav('/chat')}>
                  Proponer en Chat IA <ArrowRight className="size-4" />
                </button>
                <button className="ck-btn ck-btn-ghost" onClick={() => nav('/backlog')}>
                  Ver propuestas anteriores
                </button>
              </div>
            </div>
            <ProposalSnippet />
          </div>
        </div>
      </section>
    </>
  );
}

/* ─────────────────── Subcomponents ─────────────────── */

interface ResourceCardProps {
  tag: string;
  tone: 'primary' | 'ink' | 'muted';
  icon: typeof Bot;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
}
function ResourceCard({ tag, tone, icon: Icon, title, desc, cta, onClick }: ResourceCardProps) {
  const toneStyle = {
    primary: { background: 'var(--primary-ck)', color: 'var(--primary-fg)' },
    ink:     { background: 'var(--ink)',         color: 'var(--bg-elev)' },
    muted:   { background: 'var(--bg-inset)',    color: 'var(--ink)' },
  }[tone];
  return (
    <div
      onClick={onClick}
      className="ck-card p-6 flex flex-col cursor-pointer min-h-[280px] transition-all hover:-translate-y-0.5 hover:shadow-pop"
    >
      <div className="flex justify-between items-start mb-6">
        <span className="size-11 rounded-xl grid place-items-center" style={toneStyle}>
          <Icon className="size-5" />
        </span>
        <span className="ck-pill ck-mono text-[10.5px] tracking-wider uppercase">{tag}</span>
      </div>
      <h3 className="ck-display text-[22px]">{title}</h3>
      <p className="mt-2.5 text-sm text-ink-muted leading-relaxed flex-1">{desc}</p>
      <div
        className="mt-6 flex items-center gap-2 font-medium text-[13.5px]"
        style={{ color: 'var(--primary-ck)' }}
      >
        {cta} <ArrowRight className="size-3.5" />
      </div>
    </div>
  );
}

function HeroPreview() {
  return (
    <div
      className="relative bg-bg-elev border border-border-soft rounded-[18px] overflow-hidden"
      style={{
        boxShadow: '0 30px 60px -30px oklch(0.20 0.02 255 / 0.18), 0 8px 20px -8px oklch(0.20 0.02 255 / 0.08)',
      }}
    >
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border-soft bg-bg-muted">
        <span className="size-2.5 rounded-full" style={{ background: 'oklch(0.86 0.008 250)' }} />
        <span className="size-2.5 rounded-full" style={{ background: 'oklch(0.86 0.008 250)' }} />
        <span className="size-2.5 rounded-full" style={{ background: 'oklch(0.86 0.008 250)' }} />
        <span className="ck-mono ml-3 text-[11px] text-ink-muted">plataforma.ai / agents / forecast-q3</span>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="size-9 rounded-[10px] grid place-items-center bg-ink text-bg-elev">
            <Bot className="size-4" />
          </span>
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold">Forecast Agent · Q3</div>
            <div className="ck-mono text-[11px] text-ink-muted">Activo · 12 ejecuciones hoy</div>
          </div>
          <span className="ck-pill">
            <span className="size-1.5 rounded-full" style={{ background: 'var(--success-ck)' }} />
            <span className="text-[11px]">OK</span>
          </span>
        </div>

        <Bubble side="user" text="¿Cuál es la proyección de ingresos para el próximo trimestre?" />
        <Bubble side="ai" text="Basado en los datos de los últimos 18 meses y la temporalidad observada, proyecto $2.4M (±6%) para Q3. Los drivers principales son…" />

        <div
          className="mt-3.5 p-3 rounded-[10px] bg-bg-inset"
          style={{ border: '1px dashed var(--border-strong)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="ck-mono text-[10.5px] text-ink-muted tracking-wider">FUENTES</span>
            <span className="ck-mono text-[10.5px] text-ink-muted">3 documentos</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['Ventas Q1.xlsx', 'Forecast Model v3', 'Mercado · Informe'].map((s) => (
              <span
                key={s}
                className="text-[11px] px-2 py-0.5 rounded-md bg-bg-elev border border-border-soft ck-mono text-ink-2"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ side, text }: { side: 'user' | 'ai'; text: string }) {
  const isUser = side === 'user';
  return (
    <div className={`flex mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3 py-2.5 rounded-xl text-[13px] leading-snug ${
          isUser ? 'text-[var(--primary-fg)]' : 'bg-bg-muted text-ink border border-border-soft'
        }`}
        style={isUser ? { background: 'var(--primary-ck)' } : undefined}
      >
        {text}
      </div>
    </div>
  );
}

function ProposalSnippet() {
  return (
    <div className="relative bg-bg-elev border border-border-soft rounded-[14px] overflow-hidden shadow-ck">
      <div className="px-3.5 py-2.5 border-b border-border-soft flex items-center justify-between bg-bg-muted">
        <span className="ck-mono text-[11px] text-ink-muted tracking-wider">PROP-2031</span>
        <span
          className="ck-pill border-transparent"
          style={{ background: 'var(--success-soft)', color: 'oklch(0.40 0.14 155)' }}
        >
          <span className="size-1.5 rounded-full" style={{ background: 'var(--success-ck)' }} />
          En revisión
        </span>
      </div>
      <div className="px-4 py-4">
        <div className="text-sm font-semibold text-ink">Asistente de onboarding RRHH</div>
        <div className="text-[12.5px] text-ink-muted mt-1 leading-relaxed">
          Automatizar el primer día de cada empleado nuevo con un agente que responde dudas y guía documentación.
        </div>
        <div className="mt-3.5 pt-3.5 border-t border-border-soft flex justify-between items-center text-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            <span className="size-5 rounded-full bg-bg-inset grid place-items-center text-ink-2 text-[10px] font-semibold">
              MR
            </span>
            <span>María R. · RRHH</span>
          </div>
          <span className="ck-mono">2 días</span>
        </div>
      </div>
    </div>
  );
}
