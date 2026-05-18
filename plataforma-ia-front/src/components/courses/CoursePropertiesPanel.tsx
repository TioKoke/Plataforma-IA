import type { BaseNodeData, NodeType } from './types';
import * as Icons from 'lucide-react';

interface Props {
    node: { id: string; data: BaseNodeData } | null;
}

const getTypeColor = (type?: NodeType) => {
    switch (type) {
        case 'agent': return 'bg-plataforma-naranja/20 text-plataforma-naranja';
        case 'llm': return 'bg-plataforma-turquesa/20 text-plataforma-turquesa';
        case 'tool': return 'bg-plataforma-amarillo/20 text-plataforma-amarillo';
        case 'data': return 'bg-emerald-500/20 text-emerald-400';
        case 'output': return 'bg-plataforma-rojo/20 text-plataforma-rojo';
        default: return 'bg-slate-500/20 text-slate-400';
    }
};

export const CoursePropertiesPanel = ({ node }: Props) => {
    if (!node) {
        return (
            <aside className="w-80 bg-white border-l border-slate-200 flex flex-col items-center justify-center p-6 text-center text-slate-500 h-full">
                <Icons.MousePointerClick size={48} className="mb-4 opacity-20" />
                <p>Selecciona un nodo para ver su configuración</p>
            </aside>
        );
    }

    const { data } = node;
    const tagColor = getTypeColor(data.type);

    return (
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col h-full overflow-y-auto custom-scrollbar shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <h2 className="text-slate-800 font-semibold text-sm">Configuración del Nodo</h2>
                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                    <Icons.X size={16} />
                </button>
            </div>

            <div className="p-4 space-y-6">
                {/* Header Config */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className={`w-3 h-3 rounded-full ${tagColor.split(' ')[0].replace('/20', '')}`} />
                        <h3 className="text-slate-800 font-bold">{data.title}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase uppercase ml-auto ${tagColor}`}>
                            {data.type}
                        </span>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Descripción</label>
                        <div className="bg-slate-50 p-3 rounded-md border border-slate-200 text-sm text-slate-600">
                            {data.description || 'Configura las acciones que debe realizar este nodo.'}
                        </div>
                    </div>
                </div>

                {/* Dynamic Fields Based on Type */}
                {data.type === 'agent' && (
                    <>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Modelo LLM</label>
                            <select className="w-full bg-white border border-slate-300 rounded-md py-2 px-3 text-sm text-slate-700 focus:outline-none focus:border-plataforma-turquesa appearance-none focus:ring-1 focus:ring-plataforma-turquesa">
                                <option value="gpt-4o">GPT-4o</option>
                                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Temperatura</label>
                                <span className="text-xs font-mono text-plataforma-turquesa">0.7</span>
                            </div>
                            <input type="range" min="0" max="1" step="0.1" defaultValue="0.7" className="w-full accent-plataforma-turquesa h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">System Prompt</label>
                            <textarea
                                className="w-full bg-slate-50 border border-slate-300 rounded-md py-2 px-3 text-sm text-slate-700 font-mono focus:outline-none focus:border-plataforma-turquesa h-32 resize-none custom-scrollbar focus:ring-1 focus:ring-plataforma-turquesa"
                                defaultValue="Eres un agente orquestador. Tu rol es coordinar y delegar tareas a los agentes especializados según el contexto del curso."
                            />
                        </div>
                    </>
                )}

                {/* Connections Summary */}
                <div className="space-y-3 pt-4 border-t border-slate-200">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Conexiones</label>
                    <div className="bg-slate-50 rounded-md border border-slate-200 p-2 text-sm flex items-center justify-between text-slate-700">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Input</span>
                        </div>
                        <span className="text-slate-500 text-xs">1 conexión</span>
                    </div>
                    <div className="bg-slate-50 rounded-md border border-slate-200 p-2 text-sm flex items-center justify-between text-slate-700">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-plataforma-rojo" />
                            <span>Output</span>
                        </div>
                        <span className="text-slate-500 text-xs">2 conexiones</span>
                    </div>
                </div>

            </div>
        </aside>
    );
};
