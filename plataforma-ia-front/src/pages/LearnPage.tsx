import { useEffect, useState, useMemo } from 'react';
import {
  BookOpen, Video, Shield, List, Search as SearchIcon, SlidersHorizontal, Play,
  Loader2, X,
} from 'lucide-react';
import { fetchVideos } from '../services/videosApi';
import type { Video as VideoT } from '../services/videosApi';
import YouTubeFacade from '../components/YouTubeFacade';

type Tab = 'videos' | 'cursos' | 'best' | 'gloss';

/**
 * Centro de aprendizaje — diseño Claude Design conectado a /videos/.
 */
export default function LearnPage() {
  const [tab, setTab] = useState<Tab>('videos');
  const [q, setQ] = useState('');

  const tabs: { id: Tab; label: string; icon: typeof Video }[] = [
    { id: 'videos', label: 'Videos',            icon: Video },
    { id: 'cursos', label: 'Cursos',            icon: BookOpen },
    { id: 'best',   label: 'Mejores prácticas', icon: Shield },
    { id: 'gloss',  label: 'Glosario',          icon: List },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Portal de conocimiento"
        eyebrowIcon={<BookOpen className="size-3" />}
        title={<>Centro de <em className="italic font-normal">aprendizaje</em></>}
        kicker="Desarrolla las habilidades de tu equipo y aplica las últimas innovaciones en IA. Contenido curado por especialistas, actualizado mensualmente."
      />

      <section className="border-b border-border-soft">
        <div className="ck-container pb-6">
          <div className="flex gap-1 p-1 bg-bg-inset border border-border-soft rounded-xl w-fit mb-6">
            {tabs.map((t) => {
              const active = t.id === tab;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
                    active
                      ? 'bg-bg-elev text-ink shadow-[0_1px_2px_oklch(0.18_0.02_255/0.06),0_0_0_1px_var(--border-soft)]'
                      : 'text-ink-muted hover:text-ink-2'
                  }`}
                >
                  <Icon className="size-3.5" /> {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex gap-3">
            <div className="flex-1 flex items-center px-3.5 bg-bg-elev border border-border-soft rounded-[10px]">
              <SearchIcon className="size-4 text-ink-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por título, autor o tema…"
                className="flex-1 px-3 py-3 bg-transparent border-0 outline-none text-sm text-ink"
              />
              <span className="ck-mono text-[11px] text-ink-muted-soft border border-border-soft px-1.5 py-0.5 rounded">
                ⌘ K
              </span>
            </div>
            <button className="ck-btn ck-btn-outline">
              <SlidersHorizontal className="size-4" /> Filtros
            </button>
          </div>
        </div>
      </section>

      <section className="pt-10 pb-16">
        <div className="ck-container">
          {tab === 'videos' && <VideoGrid q={q} />}
          {tab === 'cursos' && <CoursesGrid />}
          {tab === 'best'   && <BestPracticesGrid />}
          {tab === 'gloss'  && <Glossary />}
        </div>
      </section>
    </>
  );
}

function PageHeader({
  eyebrow, eyebrowIcon, title, kicker,
}: { eyebrow: string; eyebrowIcon: React.ReactNode; title: React.ReactNode; kicker: string }) {
  return (
    <section className="relative pt-12 pb-6">
      <div className="ck-container">
        <span className="ck-pill mb-4">
          {eyebrowIcon}
          <span className="ck-mono text-[11px] tracking-wider text-ink-2">{eyebrow.toUpperCase()}</span>
        </span>
        <h1 className="ck-display text-[56px] max-w-[900px]">{title}</h1>
        <p className="mt-4 text-[17px] text-ink-muted max-w-[640px] leading-relaxed">{kicker}</p>
      </div>
    </section>
  );
}

/* ─────────────────── Videos (real API) ─────────────────── */

function VideoGrid({ q }: { q: string }) {
  const [videos, setVideos] = useState<VideoT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<VideoT | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchVideos();
        if (!cancelled) setVideos(data.videos);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!q) return videos;
    const ql = q.toLowerCase();
    return videos.filter(
      (v) =>
        v.title.toLowerCase().includes(ql) ||
        v.description?.toLowerCase().includes(ql) ||
        v.category?.toLowerCase().includes(ql),
    );
  }, [videos, q]);

  if (loading) {
    return (
      <div className="ck-card text-center py-16 px-8">
        <Loader2 className="size-7 animate-spin mx-auto text-ink-muted" />
        <p className="mt-4 text-sm text-ink-muted">Cargando videos…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="ck-card text-center py-16 px-8">
        <h3 className="ck-display text-[20px]">No se pudieron cargar los videos</h3>
        <p className="mt-2 text-sm text-ink-muted">{error}</p>
      </div>
    );
  }
  if (filtered.length === 0) {
    return (
      <div className="ck-card text-center py-16 px-8">
        <div className="size-14 rounded-2xl bg-bg-inset text-ink-muted grid place-items-center mx-auto mb-4">
          <SearchIcon className="size-6" />
        </div>
        <h3 className="ck-display text-[20px]">Sin resultados</h3>
        <p className="mt-2 text-sm text-ink-muted">Prueba con otros términos de búsqueda.</p>
      </div>
    );
  }

  const [featured, ...rest] = filtered;

  return (
    <>
      <div className="grid grid-cols-[1.4fr_1fr] gap-8 mb-12">
        <div
          className="relative rounded-[14px] overflow-hidden border border-border-soft bg-ink aspect-video cursor-pointer"
          onClick={() => setActiveVideo(featured)}
        >
          <YouTubeFacade youtubeId={featured.youtube_id} title={featured.title} />
        </div>
        <div className="flex flex-col justify-center">
          <span className="ck-mono text-[11px] tracking-wider" style={{ color: 'var(--primary-ck)' }}>
            RECOMENDADO PARA TI
          </span>
          <h2 className="ck-display text-[36px] mt-2.5 mb-3.5 leading-[1.08]">{featured.title}</h2>
          <p className="text-[15px] text-ink-muted leading-relaxed mb-5">
            {featured.description}
          </p>
          <div className="flex items-center gap-3 mb-6">
            <span
              className="size-7 rounded-full grid place-items-center font-semibold text-[11px]"
              style={{ background: 'var(--primary-soft)', color: 'var(--primary-ink)' }}
            >
              {(featured.company || 'PL').slice(0, 2).toUpperCase()}
            </span>
            <div className="text-[13px]">
              <div className="font-medium text-ink">{featured.company || 'Plataforma IA'}</div>
              <div className="text-ink-muted text-xs">
                {featured.level} · {featured.duration ?? 'duración variable'}
              </div>
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              className="ck-btn ck-btn-primary"
              onClick={() => setActiveVideo(featured)}
            >
              <Play className="size-3.5 fill-current" /> Reproducir ahora
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-baseline justify-between mb-4">
        <h3 className="ck-display text-[20px]">Continúa aprendiendo</h3>
        <span className="text-[13px] text-ink-muted">{rest.length} videos</span>
      </div>
      <div className="grid grid-cols-3 gap-5">
        {rest.map((v) => (
          <VideoCard key={v.id} video={v} onPlay={() => setActiveVideo(v)} />
        ))}
      </div>

      {activeVideo && (
        <VideoModal video={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </>
  );
}

function VideoCard({ video, onPlay }: { video: VideoT; onPlay: () => void }) {
  return (
    <div className="ck-card overflow-hidden flex flex-col cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-pop" onClick={onPlay}>
      <div className="relative aspect-[16/10] bg-bg-inset">
        <YouTubeFacade youtubeId={video.youtube_id} title={video.title} />
        {video.duration && (
          <span
            className="absolute right-2.5 bottom-2.5 ck-mono text-[10.5px] text-bg-elev px-1.5 py-0.5 rounded"
            style={{ background: 'oklch(0.18 0.02 255 / 0.8)' }}
          >
            {video.duration}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex gap-1.5 mb-2.5">
          <span
            className="ck-mono text-[10px] px-1.5 py-0.5 rounded tracking-wider"
            style={{ background: 'var(--primary-soft)', color: 'var(--primary-ink)' }}
          >
            {(video.category || 'GENERAL').toUpperCase()}
          </span>
          <span className="ck-mono text-[10px] px-1.5 py-0.5 rounded tracking-wider bg-bg-inset text-ink-muted">
            {video.level.toUpperCase()}
          </span>
        </div>
        <div className="ck-display text-base leading-tight line-clamp-2">{video.title}</div>
        <div className="flex justify-between items-center mt-3.5 pt-3 border-t border-border-soft text-xs text-ink-muted">
          <span className="truncate max-w-[140px]">{video.company || 'Plataforma IA'}</span>
        </div>
      </div>
    </div>
  );
}

function VideoModal({ video, onClose }: { video: VideoT; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-8"
      style={{ background: 'oklch(0.18 0.02 255 / 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-bg-elev rounded-[16px] overflow-hidden w-full max-w-[960px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-border-soft flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-ink line-clamp-1">{video.title}</div>
            <div className="text-xs text-ink-muted">
              {video.category} · {video.level}
            </div>
          </div>
          <button onClick={onClose} className="ck-btn ck-btn-ghost !p-2">
            <X className="size-4" />
          </button>
        </div>
        <div className="aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${video.youtube_id}?autoplay=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>
        {video.description && (
          <div className="px-5 py-4 text-sm text-ink-2 leading-relaxed border-t border-border-soft">
            {video.description}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── Cursos / Best Practices / Glossary (estáticos) ─────────────────── */

function CoursesGrid() {
  const courses = [
    { title: 'Fundamentos de IA para no técnicos',   modules: 8,  hours: '4.5h', level: 'Básico',     progress: 60 },
    { title: 'Construye tu primer agente con RAG',   modules: 12, hours: '8h',   level: 'Intermedio', progress: 20 },
    { title: 'Gobernanza de IA en empresas grandes', modules: 6,  hours: '3h',   level: 'Avanzado',   progress: 0  },
    { title: 'Evaluación y monitoreo de agentes',    modules: 10, hours: '6h',   level: 'Avanzado',   progress: 0  },
  ];
  return (
    <div className="grid grid-cols-2 gap-5">
      {courses.map((c) => (
        <div key={c.title} className="ck-card p-6">
          <div className="flex justify-between items-start mb-4">
            <span className="size-11 rounded-[10px] grid place-items-center bg-ink text-bg-elev">
              <BookOpen className="size-5" />
            </span>
            <span className="ck-pill text-[11px]">{c.level}</span>
          </div>
          <h3 className="ck-display text-[20px]">{c.title}</h3>
          <div className="flex gap-4 mt-3 text-[12.5px] text-ink-muted">
            <span>{c.modules} módulos</span>
            <span>·</span>
            <span>{c.hours} estimadas</span>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-ink-muted mb-1.5">
              <span>Progreso</span>
              <span className="ck-mono text-ink-2">{c.progress}%</span>
            </div>
            <div className="h-1.5 bg-bg-inset rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${c.progress}%`, background: 'var(--primary-ck)' }} />
            </div>
          </div>
          <button className="ck-btn ck-btn-outline mt-4 w-full justify-center">
            {c.progress === 0 ? 'Empezar curso' : 'Continuar'}
          </button>
        </div>
      ))}
    </div>
  );
}

function BestPracticesGrid() {
  const items = [
    { num: '01', title: 'Diseña prompts con contexto',        desc: 'Estructura tus instrucciones con rol, formato y restricciones explícitas.' },
    { num: '02', title: 'Verifica fuentes en cada respuesta', desc: 'Habilita citas y revisión humana en cualquier flujo crítico.' },
    { num: '03', title: 'Mide costo por interacción',         desc: 'Define presupuestos por agente y configura alertas tempranas.' },
    { num: '04', title: 'Diseña fallbacks claros',            desc: 'Define qué hace el agente cuando no sabe — un buen error vale más.' },
    { num: '05', title: 'Evalúa antes de desplegar',          desc: 'Usa datasets golden y revisión por pares para validar cambios.' },
    { num: '06', title: 'Documenta cada decisión',            desc: 'Mantén una bitácora de prompts, modelos y resultados para auditoría.' },
  ];
  return (
    <div className="grid grid-cols-3 gap-5">
      {items.map((it) => (
        <div key={it.num} className="ck-card p-6">
          <span className="ck-mono text-xs tracking-wider" style={{ color: 'var(--primary-ck)' }}>{it.num}</span>
          <h3 className="ck-display text-[18px] mt-2.5 mb-2">{it.title}</h3>
          <p className="text-[13.5px] text-ink-muted leading-relaxed">{it.desc}</p>
        </div>
      ))}
    </div>
  );
}

function Glossary() {
  const items = [
    { term: 'Agent',         def: 'Sistema autónomo que percibe, decide y actúa para cumplir un objetivo, generalmente combinando LLMs con herramientas externas.' },
    { term: 'Embedding',     def: 'Representación numérica de un dato (texto, imagen) en un espacio vectorial — permite medir similitud semántica.' },
    { term: 'Fine-tuning',   def: 'Proceso de ajustar un modelo preentrenado con datos específicos del dominio para mejorar su desempeño en una tarea.' },
    { term: 'Hallucination', def: 'Cuando un modelo produce información plausible pero incorrecta o inventada — el principal riesgo a mitigar en producción.' },
    { term: 'LLM',           def: 'Large Language Model. Modelo entrenado con grandes corpus de texto para predecir y generar lenguaje natural.' },
    { term: 'RAG',           def: 'Retrieval-Augmented Generation. Técnica que enriquece las respuestas del modelo con información recuperada en tiempo real.' },
    { term: 'Token',         def: 'Unidad mínima en que un modelo procesa texto — aproximadamente 4 caracteres en español. El costo se factura por token.' },
    { term: 'Vector DB',     def: 'Base de datos optimizada para almacenar y buscar embeddings con búsqueda por similitud (pgvector, Pinecone, Weaviate).' },
  ];
  return (
    <div className="ck-card overflow-hidden">
      {items.map((it, i) => (
        <div
          key={it.term}
          className={`grid grid-cols-[200px_1fr] gap-6 px-6 py-5 ${i < items.length - 1 ? 'border-b border-border-soft' : ''}`}
        >
          <div>
            <span className="ck-mono text-[11px] text-ink-muted tracking-wider">TÉRMINO</span>
            <div className="ck-display text-[20px] mt-1">{it.term}</div>
          </div>
          <div className="text-sm text-ink-2 leading-relaxed pt-5">{it.def}</div>
        </div>
      ))}
    </div>
  );
}
