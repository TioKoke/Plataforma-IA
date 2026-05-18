import type { DragEvent } from 'react';
import type { BaseNodeData, NodeType } from './types';
import * as Icons from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

const availableNodes: { category: string; items: BaseNodeData[] }[] = [
    {
        category: 'Agentes',
        items: [
            {
                title: 'Agent Orquestador',
                description: 'Coordina y delega tareas',
                type: 'agent',
                icon: 'BrainCircuit',
                model: 'gpt-5.2-chat',
                temperature: 0.7,
                maxTokens: 4096,
                systemPrompt: 'Eres un agente orquestador que coordina tareas complejas de forma autónoma.',
            },
            {
                title: 'Agent Ejecutor',
                description: 'Realiza acciones concretas',
                type: 'agent',
                icon: 'Bot',
                model: 'gpt-5.2-chat',
                temperature: 0.3,
                maxTokens: 2048,
                systemPrompt: 'Eres un agente ejecutor especializado en realizar acciones específicas.',
            },
        ]
    },
    {
        category: 'Modelos LLM',
        items: [
            { title: 'GPT 5 Chat', description: 'Modelo principal Plataforma IA', type: 'llm', icon: 'Sparkles', model: 'gpt-5.2-chat', temperature: 0.7, maxTokens: 4096 },
            { title: 'GPT 4.1', description: 'Alta capacidad analítica', type: 'llm', icon: 'MessageSquare', model: 'gpt-4.1', temperature: 0.5, maxTokens: 4096 }
        ]
    },
    {
        category: 'Herramientas',
        items: [
            { title: 'Web Search', description: 'Búsqueda en internet', type: 'tool', icon: 'Search' },
            { title: 'API Call', description: 'Peticiones REST', type: 'tool', icon: 'Globe' },
            { title: 'Code Executor', description: 'Ejecuta Python/JS', type: 'tool', icon: 'Terminal' }
        ]
    },
    {
        category: 'Datos',
        items: [
            { title: 'Input Usuario', description: 'Entrada de datos', type: 'data', icon: 'User' },
            { title: 'Base Conocimiento', description: 'Búsqueda semántica', type: 'data', icon: 'Database' }
        ]
    },
    {
        category: 'Salidas',
        items: [
            { title: 'Respuesta Final', description: 'Salida al usuario', type: 'output', icon: 'MessageCircle' },
            { title: 'Logger', description: 'Registro de eventos', type: 'output', icon: 'FileText' }
        ]
    }
];

const getTypeColors = (type: NodeType) => {
    switch (type) {
        case 'agent': return 'border-plataforma-naranja/50 text-plataforma-naranja bg-plataforma-naranja/10 hover:border-plataforma-naranja shadow-[0_0_10px_rgba(229,83,2,0)] hover:shadow-[0_0_10px_rgba(229,83,2,0.3)]';
        case 'llm': return 'border-plataforma-turquesa/50 text-plataforma-turquesa bg-plataforma-turquesa/10 hover:border-plataforma-turquesa shadow-[0_0_10px_rgba(0,152,170,0)] hover:shadow-[0_0_10px_rgba(0,152,170,0.3)]';
        case 'tool': return 'border-plataforma-amarillo/50 text-plataforma-amarillo bg-plataforma-amarillo/10 hover:border-plataforma-amarillo shadow-[0_0_10px_rgba(244,170,0,0)] hover:shadow-[0_0_10px_rgba(244,170,0,0.3)]';
        case 'data': return 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10 hover:border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0)] hover:shadow-[0_0_10px_rgba(16,185,129,0.3)]';
        case 'output': return 'border-plataforma-rojo/50 text-plataforma-rojo bg-plataforma-rojo/10 hover:border-plataforma-rojo shadow-[0_0_10px_rgba(193,56,50,0)] hover:shadow-[0_0_10px_rgba(193,56,50,0.3)]';
        default: return 'border-slate-500/50 text-slate-400 bg-slate-500/10 hover:border-slate-500';
    }
};

export const CourseSidebar = () => {
    const onDragStart = (event: DragEvent<HTMLDivElement>, nodeData: BaseNodeData) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto custom-scrollbar">
            <div className="p-4 sticky top-0 bg-white z-10 border-b border-slate-100">
                <div className="relative">
                    <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar nodos..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-md py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-plataforma-turquesa focus:ring-1 focus:ring-plataforma-turquesa transition-all"
                    />
                </div>
            </div>

            <div className="flex-1 px-4 py-4 space-y-6">
                {availableNodes.map((section) => (
                    <div key={section.category}>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                            {section.category}
                        </h3>
                        <div className="space-y-2">
                            {section.items.map((node) => {
                                const Icon = (Icons as unknown as Record<string, LucideIcon>)[node.icon] || Icons.Box;
                                const colors = getTypeColors(node.type);
                                return (
                                    <div
                                        key={node.title}
                                        className={`flex items-center gap-3 p-2.5 rounded-md border text-sm cursor-grab active:cursor-grabbing transition-all duration-200 bg-white ${colors}`}
                                        draggable
                                        onDragStart={(e) => onDragStart(e, node)}
                                    >
                                        <Icon size={16} />
                                        <span className="font-medium text-slate-700">{node.title}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    );
};
