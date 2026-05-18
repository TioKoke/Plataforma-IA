import { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { BaseNodeData, NodeType, NodeExecutionState } from '../types';
import * as Icons from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

interface Props {
    id: string;
    data: BaseNodeData;
    isConnectable: boolean;
    selected?: boolean;
}

const TYPE_BORDER: Record<NodeType, string> = {
    agent:  'border-plataforma-naranja',
    llm:    'border-plataforma-turquesa',
    tool:   'border-plataforma-amarillo',
    data:   'border-emerald-500',
    output: 'border-plataforma-rojo',
};

const TYPE_ICON_BG: Record<NodeType, string> = {
    agent:  'bg-plataforma-naranja/15 text-plataforma-naranja',
    llm:    'bg-plataforma-turquesa/15 text-plataforma-turquesa',
    tool:   'bg-plataforma-amarillo/15 text-plataforma-amarillo',
    data:   'bg-emerald-500/15 text-emerald-500',
    output: 'bg-plataforma-rojo/15 text-plataforma-rojo',
};

const TYPE_BADGE: Record<NodeType, string> = {
    agent:  'bg-plataforma-naranja/10 text-plataforma-naranja',
    llm:    'bg-plataforma-turquesa/10 text-plataforma-turquesa',
    tool:   'bg-plataforma-amarillo/10 text-plataforma-amarillo',
    data:   'bg-emerald-500/10 text-emerald-500',
    output: 'bg-plataforma-rojo/10 text-plataforma-rojo',
};

const getExecRing = (state: NodeExecutionState | undefined): string => {
    switch (state) {
        case 'running':  return 'ring-2 ring-plataforma-turquesa/70 shadow-[0_0_18px_rgba(6,182,212,0.45)]';
        case 'done':     return 'ring-2 ring-emerald-400/70 shadow-[0_0_14px_rgba(16,185,129,0.35)]';
        case 'error':    return 'ring-2 ring-red-400/70 shadow-[0_0_14px_rgba(239,68,68,0.35)]';
        case 'pending':  return 'opacity-70';
        default:         return '';
    }
};

const TYPE_LABELS: Record<NodeType, string> = {
    agent: 'Agente', llm: 'LLM', tool: 'Tool', data: 'Datos', output: 'Salida',
};

export const BaseNode = ({ id, data, isConnectable, selected }: Props) => {
    const [configOpen, setConfigOpen] = useState(false);
    const { updateNodeData } = useReactFlow();

    const Icon = (Icons as unknown as Record<string, LucideIcon>)[data.icon as string] || Icons.HelpCircle;
    const border    = TYPE_BORDER[data.type];
    const iconStyle = TYPE_ICON_BG[data.type];
    const badge     = TYPE_BADGE[data.type];
    const execState = data.executionState as NodeExecutionState | undefined;
    const execRing  = getExecRing(execState);
    const isRunning = execState === 'running';
    const isDone    = execState === 'done';
    const isPending = execState === 'pending';
    const isError   = execState === 'error';
    const hasOutput = !!data.executionOutput && execState !== 'idle';

    const update = (field: string, value: unknown) => updateNodeData(id, { [field]: value });

    /* ─── Handle shared classes ─── */
    // Instead of a tiny dot, the handle spans the entire edge to allow connecting from anywhere on the side without a fixed visual anchor.
    const handleClsTarget = "!w-6 !h-full !opacity-0 !top-0 !left-[-12px] !transform-none !rounded-none !border-0 !bg-transparent !cursor-crosshair";
    const handleClsSource = "!w-6 !h-full !opacity-0 !top-0 !right-[-12px] !left-auto !transform-none !rounded-none !border-0 !bg-transparent !cursor-crosshair";

    return (
        <div className="relative" style={{ minWidth: 240, maxWidth: 300 }}>

            {/* ── Input handle — outside overflow-hidden wrapper ── */}
            {data.type !== 'data' && (
                <Handle
                    type="target"
                    position={Position.Left}
                    isConnectable={isConnectable}
                    className={handleClsTarget}
                />
            )}

        <div
            className={`flex flex-col rounded-xl border-2 bg-white transition-all duration-300 shadow-sm overflow-hidden
                ${border} ${execRing}
                ${selected && !execState ? 'shadow-[0_0_12px_rgba(100,116,139,0.3)]' : ''}
            `}
        >

            {/* ── Header row ── */}
            <div className="flex items-center gap-2.5 px-3 py-2.5">
                {/* Icon / exec indicator */}
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${iconStyle}`}>
                    {isRunning  ? <Icons.Loader2    size={17} className="animate-spin" /> :
                     isDone     ? <Icons.CheckCircle2 size={17} className="!text-emerald-500" /> :
                     isPending  ? <Icons.Clock       size={17} className="opacity-60" /> :
                     isError    ? <Icons.XCircle     size={17} className="!text-red-500" /> :
                                  <Icon              size={17} strokeWidth={2.5} />}
                </div>

                {/* Title + description */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-800 font-semibold text-sm leading-tight">{data.title as string}</span>
                        <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${badge}`}>
                            {TYPE_LABELS[data.type]}
                        </span>
                    </div>
                    <span className="text-slate-500 text-xs leading-tight">{data.description as string}</span>
                </div>

                {/* Config toggle */}
                <button
                    className={`nodrag p-1.5 rounded-lg transition-colors shrink-0
                        ${configOpen ? `${iconStyle}` : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                    onClick={e => { e.stopPropagation(); setConfigOpen(o => !o); }}
                    title={configOpen ? 'Cerrar configuración' : 'Configurar nodo'}
                >
                    <Icons.Settings2 size={13} />
                </button>
            </div>

            {/* ── Config strip (collapsed) ── */}
            {!configOpen && (data.model || data.temperature !== undefined) && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-slate-100 bg-slate-50 flex-wrap">
                    {data.model && (
                        <span className="flex items-center gap-1 text-[10px] font-mono bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                            <Icons.Cpu size={9} className="shrink-0" />
                            {data.model as string}
                        </span>
                    )}
                    {data.temperature !== undefined && (
                        <span className="flex items-center gap-1 text-[10px] font-mono bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
                            <Icons.Thermometer size={9} className="shrink-0" />
                            {(data.temperature as number).toFixed(1)}
                        </span>
                    )}
                    {data.maxTokens !== undefined && (
                        <span className="flex items-center gap-1 text-[10px] font-mono bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
                            <Icons.Hash size={9} className="shrink-0" />
                            {data.maxTokens as number}
                        </span>
                    )}
                </div>
            )}

            {/* ── Expandable config panel ── */}
            {configOpen && (
                <div className="border-t border-slate-200 bg-slate-50 p-3 space-y-3 nodrag">

                    {/* DATA — Input node: chat integration info */}
                    {data.type === 'data' && (data.title as string).includes('Input') && (
                        <div className="bg-plataforma-turquesa/5 border border-plataforma-turquesa/20 rounded-lg p-2.5">
                            <div className="flex items-center gap-1.5 text-plataforma-turquesa font-semibold text-[11px] mb-1.5">
                                <Icons.MessageCircle size={12} />
                                Mensaje del Chat de prueba
                            </div>
                            <p className="text-[11px] text-slate-500 leading-snug">
                                El mensaje ingresado en el <strong className="text-slate-600">Chat de prueba →</strong> se recibe aquí y fluye por el pipeline.
                            </p>
                            {data.executionOutput && (
                                <div className="mt-2 bg-white border border-plataforma-turquesa/20 rounded px-2 py-1.5 font-mono text-[10px] text-slate-600 break-words">
                                    {data.executionOutput as string}
                                </div>
                            )}
                        </div>
                    )}

                    {/* DATA — Knowledge Base node */}
                    {data.type === 'data' && !(data.title as string).includes('Input') && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-800">
                            <div className="flex items-center gap-1.5 font-semibold mb-1">
                                <Icons.Database size={12} />
                                Base de Conocimiento
                            </div>
                            Provee contexto semántico desde los documentos de Plataforma IA al modelo LLM conectado.
                        </div>
                    )}

                    {/* LLM / AGENT */}
                    {(data.type === 'llm' || data.type === 'agent') && (
                        <>
                            {/* Model display */}
                            {data.model && (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Modelo</label>
                                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                                        <Icons.Cpu size={12} className="text-plataforma-turquesa shrink-0" />
                                        <span className="text-xs font-mono text-slate-700 flex-1">{data.model as string}</span>
                                        <span className="text-[9px] bg-plataforma-turquesa/10 text-plataforma-turquesa px-1.5 py-0.5 rounded font-bold">ACTIVO</span>
                                    </div>
                                </div>
                            )}

                            {/* Temperature */}
                            {data.temperature !== undefined && (
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Temperatura</label>
                                        <span className="text-[10px] font-mono font-bold text-plataforma-turquesa">
                                            {(data.temperature as number).toFixed(1)}
                                        </span>
                                    </div>
                                    <input
                                        type="range" min="0" max="1" step="0.1"
                                        value={data.temperature as number}
                                        onChange={e => update('temperature', parseFloat(e.target.value))}
                                        className="nodrag w-full accent-plataforma-turquesa cursor-pointer h-1.5"
                                        onClick={e => e.stopPropagation()}
                                    />
                                    <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                                        <span>0.0 · Preciso</span>
                                        <span>Creativo · 1.0</span>
                                    </div>
                                </div>
                            )}

                            {/* Max tokens */}
                            {data.maxTokens !== undefined && (
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Max Tokens</label>
                                        <span className="text-[10px] font-mono text-slate-500">{data.maxTokens as number}</span>
                                    </div>
                                    <input
                                        type="range" min="256" max="8192" step="256"
                                        value={data.maxTokens as number}
                                        onChange={e => update('maxTokens', parseInt(e.target.value))}
                                        className="nodrag w-full accent-plataforma-naranja cursor-pointer h-1.5"
                                        onClick={e => e.stopPropagation()}
                                    />
                                    <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                                        <span>256</span>
                                        <span>8 192</span>
                                    </div>
                                </div>
                            )}

                            {/* System Prompt */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">System Prompt</label>
                                <textarea
                                    className="nodrag nowheel w-full bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 p-2 resize-none h-28 focus:outline-none focus:border-plataforma-turquesa focus:ring-1 focus:ring-plataforma-turquesa/30 placeholder:text-slate-400 leading-relaxed"
                                    value={(data.systemPrompt as string) || ''}
                                    onChange={e => update('systemPrompt', e.target.value)}
                                    placeholder="Define el comportamiento y rol del modelo..."
                                    onClick={e => e.stopPropagation()}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Modifica el prompt y re-ejecuta para ver el impacto en la respuesta.
                                </p>
                            </div>
                        </>
                    )}

                    {/* TOOL */}
                    {data.type === 'tool' && (
                        <div className="space-y-2">
                            <p className="text-xs text-slate-600 leading-relaxed">{data.description as string}</p>
                            <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 leading-snug">
                                <Icons.Zap size={11} className="shrink-0 mt-0.5" />
                                El agente invoca esta herramienta automáticamente cuando lo necesita durante la ejecución del flujo.
                            </div>
                        </div>
                    )}

                    {/* OUTPUT */}
                    {data.type === 'output' && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-800">
                            <div className="flex items-center gap-1.5 font-semibold mb-1">
                                <Icons.MessageCircle size={12} />
                                Salida del flujo
                            </div>
                            La respuesta generada por el pipeline se envía al{' '}
                            <strong>Chat de prueba →</strong> donde puedes leerla como burbuja de conversación.
                        </div>
                    )}
                </div>
            )}

            {/* ── Execution: running indicator ── */}
            {isRunning && (
                <div className="border-t border-plataforma-turquesa/30 bg-plataforma-turquesa/5 px-3 py-1.5 flex items-center gap-2">
                    <Icons.Loader2 size={11} className="animate-spin text-plataforma-turquesa shrink-0" />
                    <span className="text-[11px] text-plataforma-turquesa font-medium">
                        {(data.type === 'llm' || data.type === 'agent')
                            ? `Consultando ${data.model as string || 'modelo'}...`
                            : data.type === 'tool'
                            ? 'Ejecutando herramienta...'
                            : 'Procesando...'}
                    </span>
                </div>
            )}

            {/* ── Execution output ── */}
            {hasOutput && !isRunning && (
                <div className={`border-t px-3 py-2 ${isError ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                    <div className="flex items-center gap-1.5">
                        {isError
                            ? <Icons.XCircle    size={11} className="text-red-600 shrink-0" />
                            : <Icons.CheckCircle2 size={11} className="text-emerald-600 shrink-0" />}
                        <span className={`text-[11px] font-medium ${isError ? 'text-red-700' : 'text-emerald-700'}`}>
                            {data.type === 'output'
                                ? isError ? 'Error en la salida' : '↗ Respuesta enviada al Chat'
                                : isError ? 'Error' : data.executionOutput as string}
                        </span>
                    </div>
                    {/* Only show full text for non-output nodes on error */}
                    {isError && data.type !== 'output' && (
                        <p className="mt-1 text-[10px] text-red-600 leading-relaxed">
                            {data.executionOutput as string}
                        </p>
                    )}
                </div>
            )}

        </div>

            {/* ── Output handle — outside overflow-hidden wrapper ── */}
            {data.type !== 'output' && (
                <Handle
                    type="source"
                    position={Position.Right}
                    isConnectable={isConnectable}
                    className={handleClsSource}
                />
            )}
        </div>
    );
};

export default BaseNode;
