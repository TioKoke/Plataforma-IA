import { useState, useMemo } from 'react';
import { Bot, Search, X, ExternalLink, User, Building2, Loader2, Lightbulb, CheckCircle2, Clock } from 'lucide-react';
import { useAgents } from '../hooks/useAgents';
import type { Agent } from '../services/agentsApi';
import SpotlightCard from '../components/reactbits/SpotlightCard';
import { isValidUrl } from '../utils/urlValidation';
import { Tooltip } from '../components/ui/tooltip';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function resolveIconUrl(icon_url: string): string {
  // API-relative path → prepend backend URL
  if (icon_url.startsWith('/agents/')) return `${API_URL}${icon_url}`;
  // Static public asset or absolute URL → use as-is
  return icon_url;
}

function AgentIcon({ icon_url, size = 32 }: { icon_url?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (icon_url && !failed) {
    return (
      <img
        src={resolveIconUrl(icon_url)}
        onError={() => setFailed(true)}
        className="w-full h-full object-cover rounded-2xl"
        alt="agent icon"
      />
    );
  }
  return <Bot size={size} />;
}

const AgentsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const filters = useMemo(() => ({
    ...(selectedCategoria ? { categoria: selectedCategoria } : {}),
  }), [selectedCategoria]);

  const { agents, total, categorias, loading, error } = useAgents(filters);

  const filteredAgents = useMemo(() => {
    if (!searchTerm) return agents;
    const q = searchTerm.toLowerCase();
    return agents.filter(a =>
      a.nombre.toLowerCase().includes(q) || a.descripcion.toLowerCase().includes(q)
    );
  }, [agents, searchTerm]);

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
                <Bot size={16} className="text-plataforma-naranja drop-shadow-sm" />
                <span className="text-xs font-bold text-plataforma-gris-oscuro tracking-wider uppercase">Directorio Corporativo</span>
              </div>
              <h1 className="font-heading font-black text-plataforma-gris-oscuro text-4xl md:text-5xl lg:text-6xl mb-6 tracking-tight leading-tight">
                Catálogo de <span className="text-transparent bg-clip-text bg-gradient-to-r from-plataforma-naranja to-plataforma-amarillo">Agentes IA</span>
              </h1>
              <p className="text-gray-600 text-lg md:text-xl font-light leading-relaxed max-w-2xl">
                Explora y utiliza nuestros <strong className="text-plataforma-gris-oscuro font-bold">{total} agentes especializados</strong> diseñados para potenciar la eficiencia, seguridad e innovación en Plataforma IA.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-20">
          {/* Filters */}
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200 p-6 mb-10 shadow-[0_4px_20px_rgb(0,0,0,0.03)] -mt-16 relative z-30 transition-all">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Search */}
              <div className="md:col-span-3 relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-plataforma-naranja transition-colors">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Buscar agentes por nombre, rol o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/50 hover:bg-white/80 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-plataforma-naranja focus:border-plataforma-naranja focus:bg-white/90 transition-all placeholder-gray-400 text-gray-800"
                />
              </div>

              {/* Category Filter */}
              <div className="relative">
                <select
                  value={selectedCategoria}
                  onChange={(e) => setSelectedCategoria(e.target.value)}
                  className="w-full px-4 py-3 bg-white/50 hover:bg-white/80 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-plataforma-naranja focus:border-plataforma-naranja focus:bg-white/90 transition-all cursor-pointer appearance-none text-gray-700"
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map((cat) => (
                    <option key={cat} value={cat} className="font-medium">{cat}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Active Filters */}
            {(searchTerm || selectedCategoria) && (
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                <span className="text-sm font-medium text-gray-500">Filtros:</span>
                {searchTerm && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-plataforma-gris-oscuro rounded-lg text-sm border border-gray-200">
                    "{searchTerm}"
                    <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </span>
                )}
                {selectedCategoria && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-plataforma-gris-oscuro rounded-lg text-sm border border-gray-200">
                    {selectedCategoria}
                    <button onClick={() => setSelectedCategoria('')} className="text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </span>
                )}
              </div>
            )}

            <div className="mt-3 text-sm text-gray-500">
              Mostrando <span className="text-plataforma-naranja font-semibold">{filteredAgents.length}</span> de {total} agentes
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-plataforma-naranja mr-3" size={28} />
              <span className="text-gray-600">Cargando agentes...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-center py-16 bg-red-50 rounded-lg border border-red-200">
              <p className="text-red-600 font-medium mb-1">Error al cargar agentes</p>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Agents Grid */}
          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAgents.map((agent) => (
                <SpotlightCard
                  key={agent.id}
                  spotlightColor="rgba(229, 83, 2, 0.08)"
                  className="group bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200 hover:border-plataforma-naranja/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full relative"
                >
                  {/* Accent line on top */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-gray-200 to-gray-200 group-hover:from-plataforma-naranja group-hover:to-plataforma-amarillo transition-all duration-500" />
                  <div className="p-6 md:p-8 flex flex-col h-full bg-transparent relative z-10">
                    {/* Division Badge (Corner) */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[9px] text-plataforma-naranja font-bold tracking-widest uppercase bg-plataforma-naranja/10 px-2.5 py-1 rounded-full border border-plataforma-naranja/20 shadow-sm backdrop-blur-sm z-20">
                      <Building2 size={10} />
                      <span>{agent.division}</span>
                    </div>

                    {/* Icon */}
                    <div className="flex justify-center mb-4 relative mt-2">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-200 flex items-center justify-center text-plataforma-gris-oscuro group-hover:text-plataforma-naranja shadow-sm relative z-10 transition-all duration-300">
                        <AgentIcon icon_url={agent.icon_url} size={32} />
                      </div>
                    </div>

                    {/* Name */}
                    <h3 className="font-heading font-black text-plataforma-gris-oscuro text-xl text-center mb-3 leading-tight group-hover:text-plataforma-naranja transition-colors duration-200 line-clamp-2 min-h-[56px] flex items-center justify-center">
                      {agent.nombre}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-600 text-sm mb-6 text-center leading-relaxed line-clamp-4 font-medium">
                      {agent.descripcion}
                    </p>

                    {/* Buttons */}
                    <div className="flex flex-row gap-2 mt-auto pt-5 border-t border-gray-100/50">
                      <button
                        onClick={() => setSelectedAgent(agent)}
                        className="flex-[1] w-full bg-white/50 border border-gray-200 text-gray-600 py-2.5 rounded-xl font-bold text-xs hover:border-plataforma-gris-oscuro hover:text-plataforma-gris-oscuro transition-colors flex items-center justify-center backdrop-blur-sm shadow-sm active:scale-95"
                      >
                        Detalles
                      </button>
                      {isValidUrl(agent.enlace) ? (
                        <a
                          href={agent.enlace}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-[1] w-full bg-plataforma-naranja text-white py-2.5 rounded-xl font-bold text-xs hover:bg-[#c24600] hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                        >
                          Abrir
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        <Tooltip content="Este agente estará disponible pronto" className="flex-[1] w-full">
                          <span
                            className="w-full bg-gray-200 text-gray-400 py-2.5 rounded-xl font-bold text-xs cursor-not-allowed flex items-center justify-center gap-1.5 shadow-sm"
                            aria-disabled="true"
                          >
                            Próximamente
                            <Clock size={14} />
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          )}

          {/* No Results */}
          {!loading && !error && filteredAgents.length === 0 && (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <Bot className="mx-auto mb-4 text-gray-400" size={48} />
              <p className="text-gray-600 font-medium mb-4">
                No se encontraron agentes con los filtros seleccionados
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategoria('');
                }}
                className="bg-plataforma-naranja text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-plataforma-naranja/90 transition-colors"
              >
                Limpiar Filtros
              </button>
            </div>
          )}
        </div>

        {/* Modal */}
        {selectedAgent && (
          <div className="fixed inset-0 bg-plataforma-gris-oscuro/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white/80 backdrop-blur-2xl rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in border border-white/40">
              <div className="p-8 md:p-10">
                <div className="flex justify-between items-start mb-8 relative">
                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl flex items-center justify-center border border-gray-200 shadow-sm mt-1 text-plataforma-naranja">
                      <AgentIcon icon_url={selectedAgent.icon_url} size={32} />
                    </div>
                    <div>
                      <h2 className="font-heading font-black text-plataforma-gris-oscuro text-3xl mb-3">
                        {selectedAgent.nombre}
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-plataforma-turquesa/10 text-plataforma-turquesa border border-plataforma-turquesa/20">
                          {selectedAgent.modelo}
                        </span>
                        <span className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {selectedAgent.estado}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAgent(null)}
                    className="text-gray-400 hover:text-plataforma-naranja p-2 -mr-2 -mt-2 rounded-xl hover:bg-orange-50 transition-colors active:scale-95"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-6 pb-6 border-b border-gray-100">
                    <div className="flex-1 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                        Responsable
                      </h3>
                      <p className="text-plataforma-gris-oscuro font-semibold text-sm flex items-center gap-2">
                        <User size={14} className="text-plataforma-naranja" />
                        {selectedAgent.creador}
                      </p>
                    </div>

                    <div className="flex-1 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                        División / Área
                      </h3>
                      <p className="text-plataforma-gris-oscuro font-semibold text-sm flex items-center gap-2">
                        <Building2 size={14} className="text-plataforma-turquesa" />
                        {selectedAgent.division}
                      </p>
                    </div>
                  </div>

                  <div className="bg-orange-50/30 p-5 rounded-2xl border border-orange-100/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-plataforma-naranja/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                    <h3 className="text-xs font-bold text-plataforma-naranja uppercase tracking-widest mb-3 relative z-10 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-plataforma-naranja inline-block"></span>
                      Descripción Integral
                    </h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line font-medium text-[15px] relative z-10">
                      {selectedAgent.descripcion}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6 border-y border-gray-100">
                    {selectedAgent.casos_uso.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-plataforma-gris-oscuro inline-block"></span>
                          Casos de Uso Principales
                        </h3>
                        <ul className="space-y-3">
                          {selectedAgent.casos_uso.map((caso, i) => (
                            <li key={i} className="flex items-start gap-3 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm hover:border-plataforma-naranja/30 transition-colors">
                              <Lightbulb size={18} className="text-plataforma-naranja flex-shrink-0 mt-0.5" />
                              <span className="text-gray-700 text-sm font-medium leading-snug">{caso}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedAgent.beneficios.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-plataforma-gris-oscuro inline-block"></span>
                          Beneficios Clave
                        </h3>
                        <ul className="space-y-3">
                          {selectedAgent.beneficios.map((beneficio, i) => (
                            <li key={i} className="flex items-start gap-3 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm hover:border-plataforma-turquesa/30 transition-colors">
                              <CheckCircle2 size={18} className="text-plataforma-turquesa flex-shrink-0 mt-0.5" />
                              <span className="text-gray-700 text-sm font-medium leading-snug">{beneficio}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                    <div className="flex justify-between w-full sm:w-auto items-center">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest sm:hidden mr-2">Tipo:</span>
                      <span className="px-3 py-1.5 bg-gray-100 text-gray-700 border border-gray-200 text-xs font-bold tracking-wider uppercase rounded-lg shadow-sm">{selectedAgent.tipo}</span>
                    </div>

                    <div className="flex gap-3 w-full sm:w-auto">
                      <button
                        onClick={() => setSelectedAgent(null)}
                        className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-100 transition-colors border-2 border-gray-200 active:scale-95"
                      >
                        Cerrar
                      </button>
                      {isValidUrl(selectedAgent.enlace) ? (
                        <a
                          href={selectedAgent.enlace}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-[2] sm:flex-none bg-plataforma-naranja text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-[#c24600] hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          Abrir Agente
                          <ExternalLink size={18} />
                        </a>
                      ) : (
                        <Tooltip content="Este agente estará disponible pronto" className="flex-[2] sm:flex-none">
                          <span
                            className="w-full bg-gray-200 text-gray-400 px-8 py-3 rounded-xl font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2"
                            aria-disabled="true"
                          >
                            Próximamente
                            <Clock size={18} />
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentsPage;
