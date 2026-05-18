import { useEffect, useRef, useState } from 'react';
import { Play, Clock, Copy, Check, X, GraduationCap, Search, SlidersHorizontal } from 'lucide-react';
import { fetchVideos } from '../services/videosApi';
import type { Video } from '../services/videosApi';
import SpotlightCard from '../components/reactbits/SpotlightCard';
import { CourseWorkspace } from '../components/courses/CourseWorkspace';
import YouTubeFacade from '../components/YouTubeFacade';

const LearnPage = () => {
  const [activeTab, setActiveTab] = useState('videos');
  const [selectedLevel, setSelectedLevel] = useState('Todos');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFiltersOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setIsFiltersOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFiltersOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isFiltersOpen]);

  useEffect(() => {
    let cancelled = false;
    fetchVideos()
      .then(data => {
        if (cancelled) return;
        setVideos(data.videos);
        setCategories(data.categories);
      })
      .catch(err => {
        console.error(err);
        if (!cancelled) setVideosError('No se pudieron cargar los videos.');
      })
      .finally(() => { if (!cancelled) setVideosLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const tabs = [
    { id: 'videos', label: 'Videos' },
    { id: 'cursos', label: 'Cursos Interactivos' },
    { id: 'practicas', label: 'Mejores Prácticas' },
    { id: 'glosario', label: 'Glosario' }
  ];

  const levels = ['Todos', 'Básico', 'Intermedio', 'Avanzado'];

  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      Básico: 'bg-green-500',
      Intermedio: 'bg-plataforma-amarillo',
      Avanzado: 'bg-plataforma-naranja'
    };
    return colors[level] || 'bg-gray-500';
  };

  const matchesFilters = (
    v: Video,
    level: string,
    category: string,
    query: string,
  ) => {
    if (level !== 'Todos' && v.level !== level) return false;
    if (category !== 'Todas' && v.category !== category) return false;
    if (query) {
      const q = query.toLowerCase();
      if (
        !v.title.toLowerCase().includes(q) &&
        !v.description.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  };

  const filteredVideos = videos.filter(v =>
    matchesFilters(v, selectedLevel, selectedCategory, searchQuery),
  );

  const countForLevel = (level: string) =>
    videos.filter(v => matchesFilters(v, level, selectedCategory, searchQuery)).length;

  const countForCategory = (category: string) =>
    videos.filter(v => matchesFilters(v, selectedLevel, category, searchQuery)).length;

  const activeFilterCount =
    (selectedLevel !== 'Todos' ? 1 : 0) +
    (selectedCategory !== 'Todas' ? 1 : 0) +
    (searchQuery ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = () => {
    setSelectedLevel('Todos');
    setSelectedCategory('Todas');
    setSearchQuery('');
  };

  const promptTemplates = [
    { title: 'Análisis de Producción', prompt: 'Analiza los datos de producción de la última semana en [División]. Identifica tendencias, anomalías y proporciona recomendaciones específicas para optimizar [proceso específico].', category: 'Operaciones' },
    { title: 'Reporte de Seguridad', prompt: 'Genera un reporte de seguridad para [área/equipo] basado en los incidentes del último mes. Incluye análisis de causas raíz, patrones recurrentes y plan de acción preventivo.', category: 'Seguridad' },
    { title: 'Optimización de Mantención', prompt: 'Evalúa el historial de mantención del equipo [nombre/ID] y predice la próxima falla probable. Sugiere un cronograma de mantención preventiva optimizado.', category: 'Mantención' }
  ];

  const bestPractices = {
    dos: [
      'Sé claro y específico: define el contexto, la tarea concreta y el formato esperado en cada prompt',
      'Estructura tus prompts en tres partes: contexto (background), instrucciones (qué hacer) y restricciones (formato, tono, límites)',
      'Define criterios de éxito antes de pedir: ¿cómo vas a juzgar si la respuesta sirve?',
      'Pide razonamiento paso a paso ("explica tu razonamiento") en tareas analíticas complejas',
      'Itera sobre el mismo prompt en lugar de repetir la pregunta — refina contexto y restricciones',
      'Sé conciso: prompts de 150–300 palabras suelen rendir mejor que monólogos largos',
      'Valida siempre los datos numéricos, fechas y referencias contra la fuente original',
      'Documenta los prompts que funcionan bien y compártelos con tu equipo'
    ],
    donts: [
      'No compartas información confidencial, datos operacionales sensibles o PII sin verificar permisos',
      'No tomes decisiones críticas (seguridad, paradas de planta, despachos) basándote solo en una respuesta de IA',
      'No confíes en cifras, citas o nombres específicos sin verificación — los modelos pueden alucinar',
      'No sobrecargues un prompt con varios objetivos a la vez: divide en consultas separadas',
      'No uses prompts vagos tipo "dame ideas" sin especificar audiencia, formato y profundidad',
      'No ignores las advertencias del modelo cuando indica que no está seguro o le falta información',
      'No reemplaces el juicio profesional ni el cumplimiento normativo (seguridad minera, medio ambiente) con IA',
      'No copies respuestas extensas sin entender la metodología detrás de la conclusión'
    ]
  };

  const handleCopyPrompt = (prompt: string, title: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(title);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  return (
    <div className="relative flex flex-col w-full min-h-screen bg-white">
      {/* Unified Background Effect from Home */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-white/50 to-transparent z-0 pointer-events-none"></div>
      <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none">
        <div className="absolute inset-0 gradient-mesh opacity-40"></div>
        <div className="absolute inset-0 gradient-orange opacity-5"></div>
        <div className="absolute top-[10%] right-0 w-[500px] h-[500px] bg-plataforma-amarillo/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[20%] left-0 w-[500px] h-[500px] bg-plataforma-naranja/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 w-full flex-1">
        {/* Header */}
        <div className="relative">
          <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-gray-200 mb-6 shadow-sm">
                <GraduationCap size={16} className="text-plataforma-naranja drop-shadow-sm" />
                <span className="text-xs font-bold text-plataforma-gris-oscuro tracking-wider uppercase">Portal de Conocimiento</span>
              </div>
              <h1 className="font-heading font-black text-plataforma-gris-oscuro text-4xl md:text-5xl lg:text-6xl mb-6 tracking-tight leading-tight">
                Centro de <span className="text-transparent bg-clip-text bg-gradient-to-r from-plataforma-naranja to-plataforma-amarillo">Aprendizaje</span>
              </h1>
              <p className="text-gray-600 text-lg md:text-xl font-light leading-relaxed max-w-2xl">
                Desarrolla tus habilidades y aplica las últimas innovaciones en <strong className="text-plataforma-gris-oscuro font-bold">inteligencia artificial</strong> para la minería.
              </p>
            </div>
          </div>
        </div>

      {/* Tabs Menu Flotante */}
      <div className="sticky top-20 z-30 flex justify-center px-4 sm:px-6 mb-10 pointer-events-none">
        <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-full p-1.5 flex space-x-1 sm:space-x-2 pointer-events-auto overflow-x-auto max-w-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 sm:px-6 py-2.5 font-medium text-sm rounded-full transition-all duration-300 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-plataforma-naranja shadow-sm ring-1 ring-black/5 scale-100'
                  : 'text-gray-600 hover:text-plataforma-naranja hover:bg-white/50 scale-95 hover:scale-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={`${activeTab === 'cursos' ? 'w-full h-[calc(100vh-130px)]' : 'max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <div>
            {/* Toolbar: search + filters button */}
            <div className="mb-6 flex items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar videos por título o descripción..."
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-200 bg-white/80 backdrop-blur-sm text-sm text-plataforma-gris-oscuro placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-plataforma-naranja/30 focus:border-plataforma-naranja transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-plataforma-gris-oscuro hover:bg-gray-100 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Filters button + popover */}
              <div ref={filtersRef} className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFiltersOpen(prev => !prev)}
                  aria-expanded={isFiltersOpen}
                  aria-haspopup="dialog"
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    isFiltersOpen || activeFilterCount > 0
                      ? 'bg-plataforma-gris-oscuro border-plataforma-gris-oscuro text-white'
                      : 'bg-white/80 backdrop-blur-sm border-gray-200 text-plataforma-gris-oscuro hover:bg-white hover:border-gray-300'
                  }`}
                >
                  <SlidersHorizontal size={16} />
                  <span>Filtros</span>
                  {activeFilterCount > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
                      isFiltersOpen ? 'bg-white text-plataforma-gris-oscuro' : 'bg-plataforma-naranja text-white'
                    }`}>
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {isFiltersOpen && (
                  <div
                    role="dialog"
                    aria-label="Filtrar videos"
                    className="absolute right-0 top-full mt-2 z-40 w-[min(420px,calc(100vw-2rem))] bg-white rounded-xl shadow-xl border border-gray-200 p-5 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-heading font-bold text-plataforma-gris-oscuro text-sm">Filtrar videos</h3>
                      <button
                        type="button"
                        onClick={() => setIsFiltersOpen(false)}
                        aria-label="Cerrar filtros"
                        className="p-1 rounded text-gray-400 hover:text-plataforma-gris-oscuro hover:bg-gray-100 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Nivel */}
                    <div className="mb-5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Nivel</p>
                      <div className="flex flex-wrap gap-1.5">
                        {levels.map((level) => {
                          const count = countForLevel(level);
                          const isActive = selectedLevel === level;
                          const isEmpty = count === 0 && !isActive;
                          return (
                            <button
                              key={level}
                              onClick={() => setSelectedLevel(level)}
                              disabled={isEmpty}
                              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${isActive
                                ? 'bg-plataforma-gris-oscuro text-white'
                                : isEmpty
                                  ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                  : 'bg-gray-100 text-plataforma-gris-oscuro hover:bg-gray-200'
                                }`}
                            >
                              {level} <span className={`ml-0.5 ${isActive ? 'text-white/70' : 'text-gray-500'}`}>({count})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Categoría */}
                    <div className="mb-5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Categoría</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(() => {
                          const allCount = countForCategory('Todas');
                          const isActive = selectedCategory === 'Todas';
                          return (
                            <button
                              onClick={() => setSelectedCategory('Todas')}
                              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${isActive
                                ? 'bg-plataforma-gris-oscuro text-white'
                                : 'bg-gray-100 text-plataforma-gris-oscuro hover:bg-gray-200'
                                }`}
                            >
                              Todas <span className={`ml-0.5 ${isActive ? 'text-white/70' : 'text-gray-500'}`}>({allCount})</span>
                            </button>
                          );
                        })()}
                        {categories.map((cat) => {
                          const count = countForCategory(cat);
                          const isActive = selectedCategory === cat;
                          const isEmpty = count === 0 && !isActive;
                          return (
                            <button
                              key={cat}
                              onClick={() => setSelectedCategory(cat)}
                              disabled={isEmpty}
                              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${isActive
                                ? 'bg-plataforma-gris-oscuro text-white'
                                : isEmpty
                                  ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                  : 'bg-gray-100 text-plataforma-gris-oscuro hover:bg-gray-200'
                                }`}
                            >
                              {cat} <span className={`ml-0.5 ${isActive ? 'text-white/70' : 'text-gray-500'}`}>({count})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer: results + clear */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
                      <span className="text-gray-600">
                        <span className="font-bold text-plataforma-gris-oscuro">{filteredVideos.length}</span>{' '}
                        resultado{filteredVideos.length !== 1 ? 's' : ''}
                      </span>
                      {hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="inline-flex items-center gap-1 text-plataforma-naranja hover:text-plataforma-rojo font-medium transition-colors"
                        >
                          <X size={12} />
                          Limpiar todo
                        </button>
                      ) : (
                        <span className="text-gray-400">Sin filtros activos</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {videosLoading ? (
              <div className="py-16 text-center text-gray-500">Cargando videos...</div>
            ) : videosError ? (
              <div className="py-16 text-center text-plataforma-rojo">{videosError}</div>
            ) : filteredVideos.length === 0 ? (
              <div className="py-16 text-center text-gray-500">No hay videos que coincidan con los filtros.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVideos.map((video, index) => (
                  <SpotlightCard
                    key={video.id}
                    spotlightColor="rgba(0, 152, 170, 0.1)"
                    className="group bg-white rounded-2xl border border-gray-200 hover:border-plataforma-turquesa/30 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col animate-fadeIn"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="relative h-52 overflow-hidden bg-gray-900">
                      <YouTubeFacade youtubeId={video.youtube_id} title={video.title} />
                      <div className="absolute top-3 left-3 z-30 pointer-events-none">
                        <span className={`px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-md ${getLevelColor(video.level)}`}>
                          {video.level}
                        </span>
                      </div>
                      {video.duration && (
                        <div className="absolute top-3 right-3 z-30 flex items-center bg-black/80 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-lg font-medium shadow-md pointer-events-none">
                          <Clock size={14} className="mr-1.5 text-plataforma-amarillo" />
                          {video.duration}
                        </div>
                      )}
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-plataforma-turquesa text-xs font-bold uppercase tracking-wider bg-plataforma-turquesa/10 px-2.5 py-1 rounded-md">{video.category}</span>
                        <span className="text-gray-500 text-xs font-medium bg-gray-100 px-2.5 py-1 rounded-md">{video.company}</span>
                      </div>
                      <h3 className="font-heading font-bold text-plataforma-gris-oscuro text-lg mb-3 leading-tight min-h-[54px] group-hover:text-plataforma-naranja transition-colors">
                        {video.title}
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed mb-6 line-clamp-2 flex-1">
                        {video.description}
                      </p>
                      <a
                        href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-plataforma-turquesa text-white py-3 rounded-xl font-bold text-sm hover:bg-teal-600 hover:shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 mt-auto"
                      >
                        <Play size={16} fill="currentColor" />
                        Ver en YouTube
                      </a>
                    </div>
                  </SpotlightCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cursos Interactivos Tab */}
        {activeTab === 'cursos' && (
          <div className="w-full h-full relative overflow-hidden bg-transparent">
            <CourseWorkspace />
          </div>
        )}

        {/* Mejores Prácticas Tab */}
        {activeTab === 'practicas' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h3 className="font-heading font-semibold text-green-600 text-xl mb-4 flex items-center gap-2">
                  <Check size={24} /> DO's - Haz esto
                </h3>
                <ul className="space-y-3">
                  {bestPractices.dos.map((practice, index) => (
                    <li key={index} className="bg-green-50 border-l-4 border-green-500 p-3 rounded-r-lg text-sm text-gray-700">
                      {practice}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h3 className="font-heading font-semibold text-plataforma-rojo text-xl mb-4 flex items-center gap-2">
                  <X size={24} className="text-plataforma-rojo" /> DON'Ts - Evita esto
                </h3>
                <ul className="space-y-3">
                  {bestPractices.donts.map((practice, index) => (
                    <li key={index} className="bg-red-50 border-l-4 border-plataforma-rojo p-3 rounded-r-lg text-sm text-gray-700">
                      {practice}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="font-heading font-semibold text-plataforma-gris-oscuro text-xl mb-6">Templates de Prompts</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {promptTemplates.map((template) => (
                  <div key={template.title} className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-plataforma-naranja/30 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-heading font-medium text-plataforma-gris-oscuro text-sm">{template.title}</h4>
                      <button onClick={() => handleCopyPrompt(template.prompt, template.title)} className="text-plataforma-naranja hover:text-plataforma-rojo transition-colors">
                        {copiedPrompt === template.title ? <Check size={18} /> : <Copy size={18} />}
                      </button>
                    </div>
                    <p className="font-mono text-xs text-gray-700 mb-3 leading-relaxed">{template.prompt}</p>
                    <span className="inline-block px-2 py-1 bg-plataforma-turquesa text-white text-xs rounded">{template.category}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Glosario Tab */}
        {activeTab === 'glosario' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
            <h3 className="font-heading font-semibold text-plataforma-gris-oscuro text-xl mb-6">Glosario de IA en Minería</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { term: 'Machine Learning (ML)', definition: 'Aprendizaje automático: algoritmos que mejoran con la experiencia y los datos sin ser reprogramados explícitamente para cada tarea' },
                { term: 'Deep Learning', definition: 'Rama del ML que usa redes neuronales profundas para aprender representaciones complejas de los datos (imágenes, voz, texto)' },
                { term: 'LLM (Large Language Model)', definition: 'Modelo de lenguaje entrenado con grandes volúmenes de texto, capaz de comprender y generar lenguaje natural. Ej: GPT-5, Claude' },
                { term: 'NLP (Natural Language Processing)', definition: 'Procesamiento de lenguaje natural: conjunto de técnicas que permiten a las máquinas entender, interpretar y producir texto y voz humana' },
                { term: 'Prompt', definition: 'La instrucción o pregunta que se le entrega al modelo. La calidad del prompt determina en gran medida la calidad de la respuesta' },
                { term: 'Prompt Engineering', definition: 'Disciplina de diseñar prompts efectivos: contexto + instrucción + restricciones, para obtener resultados precisos y reproducibles' },
                { term: 'Token', definition: 'Unidad mínima de texto que procesa un LLM. Aproximadamente equivale a ¾ de una palabra en inglés. Los modelos cobran y limitan por tokens' },
                { term: 'Context Window', definition: 'Cantidad máxima de tokens (entrada + salida) que el modelo puede procesar en una conversación. Más allá del límite, pierde memoria del inicio' },
                { term: 'Temperature', definition: 'Parámetro que controla la aleatoriedad de las respuestas. Bajo (0–0.3) = determinístico y conservador; alto (0.7–1.0) = creativo y variado' },
                { term: 'Hallucination (alucinación)', definition: 'Cuando el modelo genera información plausible pero falsa: nombres, fechas, citas o referencias inventadas. Riesgo principal en uso empresarial' },
                { term: 'RAG (Retrieval Augmented Generation)', definition: 'Técnica que recupera información de documentos confiables y la inyecta al prompt antes de responder, reduciendo alucinaciones' },
                { term: 'Grounding', definition: 'Anclar las respuestas del modelo a fuentes verificadas y datos reales. RAG es una forma de grounding' },
                { term: 'Embedding', definition: 'Representación numérica (vector) de un texto que captura su significado. Permite buscar por similitud semántica, no por palabras exactas' },
                { term: 'Fine-tuning', definition: 'Ajuste de un modelo pre-entrenado con datos específicos del dominio para que rinda mejor en tareas especializadas' },
                { term: 'System Prompt', definition: 'Instrucción inicial oculta al usuario que define la personalidad, alcance y restricciones del asistente para toda la conversación' },
                { term: 'Chain of Thought (CoT)', definition: 'Técnica de prompting donde se pide al modelo que muestre su razonamiento paso a paso. Mejora resultados en tareas analíticas complejas' },
                { term: 'Agente / AI Agent', definition: 'LLM que va más allá de chatear: usa herramientas (web, código, bases de datos), ejecuta acciones y planifica varios pasos para cumplir un objetivo' },
                { term: 'MCP (Model Context Protocol)', definition: 'Protocolo abierto que permite a los modelos conectarse de forma estandarizada a herramientas, datos y sistemas externos' },
                { term: 'Computer Vision', definition: 'Capacidad de los sistemas de interpretar imágenes y video. En minería: detección de personas en zonas restringidas, inspección de palas, lectura de patentes' },
                { term: 'Mantención Predictiva', definition: 'Uso de datos de sensores y modelos de IA para anticipar fallas de equipos antes de que ocurran, programando intervenciones óptimas' },
                { term: 'Digital Twin (gemelo digital)', definition: 'Réplica virtual de un activo físico (planta, camión, chancador) que se alimenta con datos en tiempo real para simular y optimizar operaciones' },
                { term: 'Aprendizaje Supervisado', definition: 'Tipo de ML donde el modelo aprende a partir de datos etiquetados (input → output conocido). Usado en clasificación y predicción' },
                { term: 'Aprendizaje No Supervisado', definition: 'Tipo de ML que descubre patrones ocultos en datos sin etiquetas. Usado para segmentación, detección de anomalías y clustering' },
                { term: 'Aprendizaje por Refuerzo', definition: 'Tipo de ML donde el agente aprende por ensayo y error mediante recompensas. Aplicable a optimización de rutas y control de procesos' },
                { term: 'Responsible AI', definition: 'Conjunto de principios para desarrollar y usar IA de forma ética: privacidad, transparencia, equidad, supervisión humana y seguridad' },
                { term: 'PII (Personally Identifiable Information)', definition: 'Información que identifica a una persona (RUT, correo, dirección). No debe enviarse a modelos públicos sin anonimización ni autorización' }
              ].map((item, index) => (
                <div key={index} className="border-l-4 border-plataforma-turquesa bg-gray-50 p-4 rounded-r-lg">
                  <h4 className="font-heading font-semibold text-plataforma-gris-oscuro mb-1">{item.term}</h4>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.definition}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default LearnPage;
