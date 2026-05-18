import { useState } from 'react';
import type { DragEvent } from 'react';
import * as Icons from 'lucide-react';
import { type LucideIcon } from 'lucide-react';
import type { Course, CourseLesson } from './courseData';
import type { BaseNodeData, NodeType, ValidationDetail } from './types';

interface Props {
    course: Course;
    lesson: CourseLesson;
    lessonIndex: number;
    currentStepIndex: number;
    completedSteps: Set<string>;
    stepStatus: 'idle' | 'success' | 'error';
    stepMessage: string;
    stepDetails?: ValidationDetail[];
    onVerify: () => void;
    onNextStep: () => void;
    onNextLesson?: () => void;
    onExit: () => void;
}

// All available nodes for the palette
const NODE_CATALOG: { category: string; type: NodeType; items: BaseNodeData[] }[] = [
    {
        category: 'Agentes',
        type: 'agent',
        items: [
            {
                title: 'Agent Orquestador',
                description: 'Coordina y delega tareas',
                type: 'agent',
                icon: 'BrainCircuit',
                model: 'gpt-5.2-chat',
                temperature: 0.7,
                maxTokens: 4096,
                systemPrompt: 'Eres un agente orquestador de Plataforma IA. Tu rol es coordinar tareas complejas de forma autónoma, analizar la solicitud del usuario y proporcionar una respuesta detallada y estructurada.',
            },
            {
                title: 'Agent Ejecutor',
                description: 'Realiza acciones concretas',
                type: 'agent',
                icon: 'Bot',
                model: 'gpt-5.2-chat',
                temperature: 0.3,
                maxTokens: 2048,
                systemPrompt: 'Eres un agente ejecutor especializado en realizar acciones específicas y concretas. Responde de manera precisa y directa.',
            },
        ],
    },
    {
        category: 'Modelos LLM',
        type: 'llm',
        items: [
            {
                title: 'GPT 5 Chat',
                description: 'Modelo principal Plataforma IA',
                type: 'llm',
                icon: 'Sparkles',
                model: 'gpt-5.2-chat',
                temperature: 0.7,
                maxTokens: 4096,
                systemPrompt: 'Eres un asistente experto de Plataforma IA que ayuda a los trabajadores con sus consultas técnicas y operacionales de minería.',
            },
            {
                title: 'GPT 4.1',
                description: 'Alta capacidad analítica',
                type: 'llm',
                icon: 'MessageSquare',
                model: 'gpt-4.1',
                temperature: 0.5,
                maxTokens: 4096,
                systemPrompt: 'Eres un analista de datos especializado en minería y procesos industriales. Proporciona análisis detallados y fundamentos técnicos.',
            },
        ],
    },
    {
        category: 'Herramientas',
        type: 'tool',
        items: [
            { title: 'Web Search',     description: 'Búsqueda en internet',  type: 'tool', icon: 'Search'   },
            { title: 'API Call',       description: 'Peticiones REST',        type: 'tool', icon: 'Globe'    },
            { title: 'Code Executor',  description: 'Ejecuta Python/JS',      type: 'tool', icon: 'Terminal' },
        ],
    },
    {
        category: 'Datos',
        type: 'data',
        items: [
            { title: 'Input Usuario',    description: 'Entrada del usuario',  type: 'data', icon: 'User'     },
            { title: 'Base Conocimiento', description: 'Búsqueda semántica', type: 'data', icon: 'Database' },
        ],
    },
    {
        category: 'Salidas',
        type: 'output',
        items: [
            { title: 'Respuesta Final', description: 'Salida al usuario',     type: 'output', icon: 'MessageCircle' },
            { title: 'Logger',          description: 'Registro de eventos',   type: 'output', icon: 'FileText'      },
        ],
    },
];

const TYPE_COLORS: Record<NodeType, string> = {
    agent: 'border-orange-300 text-orange-600 bg-orange-50 hover:border-orange-400',
    llm: 'border-plataforma-turquesa/40 text-plataforma-turquesa bg-plataforma-turquesa/5 hover:border-plataforma-turquesa/70',
    tool: 'border-yellow-300 text-yellow-600 bg-yellow-50 hover:border-yellow-400',
    data: 'border-emerald-300 text-emerald-600 bg-emerald-50 hover:border-emerald-400',
    output: 'border-red-300 text-red-500 bg-red-50 hover:border-red-400',
};

export const GuidedInstructionsPanel = ({
    course,
    lesson,
    lessonIndex,
    currentStepIndex,
    completedSteps,
    stepStatus,
    stepMessage,
    stepDetails,
    onVerify,
    onNextStep,
    onNextLesson,
    onExit,
}: Props) => {
    const [hintOpen, setHintOpen] = useState(false);
    const [prevStepIndex, setPrevStepIndex] = useState(currentStepIndex);

    // Reset hint during render when step changes (avoids setState-in-effect)
    if (prevStepIndex !== currentStepIndex) {
        setPrevStepIndex(currentStepIndex);
        setHintOpen(false);
    }

    const currentStep = lesson.steps[currentStepIndex];
    const isTheoryStep = currentStep?.type === 'theory';
    const isLastStep = currentStepIndex === lesson.steps.length - 1;
    const allDone = completedSteps.size === lesson.steps.length;

    // Filter node palette to only show types relevant to the current step
    const allowedTypes = currentStep?.allowedNodeTypes ?? [];
    const filteredCatalog = NODE_CATALOG.filter(section => allowedTypes.includes(section.type));

    const onDragStart = (event: DragEvent<HTMLDivElement>, nodeData: BaseNodeData) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
        event.dataTransfer.effectAllowed = 'move';
    };

    // Find next lesson info for the completion screen
    const hasNextLesson = lesson.nextLessonId && onNextLesson;
    const nextLessonIdx = lessonIndex + 1;
    const nextLessonTitle = nextLessonIdx < course.lessons.length
        ? course.lessons[nextLessonIdx].title
        : null;

    return (
        <aside className="w-[340px] bg-bg-elev border-r border-border-soft flex flex-col h-full overflow-hidden shrink-0">

            {/* Panel header — course + lesson breadcrumb */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">{course.title}</span>
                        <Icons.ChevronRight size={12} className="text-slate-300 shrink-0" />
                        <span className="text-xs text-slate-500 truncate">Lec. {lessonIndex + 1}</span>
                    </div>
                    <button
                        onClick={onExit}
                        title="Volver a cursos"
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                    >
                        <Icons.X size={14} />
                    </button>
                </div>

                <h2 className="text-slate-800 font-bold text-sm leading-tight mb-3">{lesson.title}</h2>

                {/* Step progress dots */}
                <div className="flex items-center gap-1.5">
                    {lesson.steps.map((step, idx) => {
                        const isDone = completedSteps.has(step.id);
                        const isCurrent = idx === currentStepIndex && !allDone;
                        const isTheory = step.type === 'theory';
                        return (
                            <div
                                key={step.id}
                                title={`${step.title}${isTheory ? ' (teoría)' : ''}`}
                                className={`rounded-full transition-all duration-300 ${
                                    isDone
                                        ? 'h-2 w-5 bg-plataforma-turquesa'
                                        : isCurrent
                                        ? isTheory ? 'h-2 w-5 bg-blue-500' : 'h-2 w-5 bg-plataforma-naranja'
                                        : 'h-2 w-2 bg-slate-200'
                                }`}
                            />
                        );
                    })}
                    <span className="text-[11px] text-slate-400 font-medium ml-1">
                        {completedSteps.size}/{lesson.steps.length}
                    </span>
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">

                {/* === LESSON COMPLETE STATE === */}
                {allDone ? (
                    <div className="p-5 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-plataforma-turquesa/10 text-plataforma-turquesa flex items-center justify-center mb-4 mt-4">
                            <Icons.PartyPopper size={30} />
                        </div>
                        <h3 className="text-slate-800 font-bold text-lg mb-2">¡Lección Completa!</h3>
                        <p className="text-slate-500 text-sm leading-relaxed mb-4">
                            Completaste <span className="font-semibold text-slate-700">"{lesson.title}"</span> con éxito.
                        </p>

                        {/* Learning summary */}
                        {lesson.summary && lesson.summary.length > 0 && (
                            <div className="w-full text-left bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                                <div className="flex items-center gap-2 mb-2.5">
                                    <Icons.BookOpen size={14} className="text-emerald-600" />
                                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Lo que aprendiste</span>
                                </div>
                                <ul className="space-y-2">
                                    {lesson.summary.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs text-emerald-800 leading-relaxed">
                                            <Icons.CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Next lesson button */}
                        {hasNextLesson && nextLessonTitle && (
                            <button
                                onClick={onNextLesson}
                                className="w-full bg-plataforma-turquesa hover:bg-teal-600 text-white font-bold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 mb-2"
                            >
                                <Icons.ArrowRight size={15} />
                                Siguiente: {nextLessonTitle}
                            </button>
                        )}

                        <button
                            onClick={onExit}
                            className={`w-full font-bold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 ${
                                hasNextLesson && nextLessonTitle
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                                    : 'bg-plataforma-turquesa hover:bg-teal-600 text-white'
                            }`}
                        >
                            <Icons.ArrowLeft size={15} />
                            Volver a Cursos
                        </button>
                    </div>

                ) : (
                    /* === ACTIVE STEP STATE === */
                    <>
                        <div className="p-4 space-y-3">

                            {/* === THEORY STEP === */}
                            {isTheoryStep ? (
                                <div className="rounded-xl border-2 border-blue-200 bg-blue-50 overflow-hidden">
                                    {/* Theory header */}
                                    <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
                                        <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs shrink-0">
                                            <Icons.BookOpen size={12} />
                                        </div>
                                        <h3 className="text-blue-800 font-bold text-sm leading-tight">
                                            {currentStep.title}
                                        </h3>
                                    </div>

                                    {/* Theory content */}
                                    <div className="px-4 pb-4 text-slate-700 text-sm leading-relaxed space-y-2">
                                        {(currentStep.theoryContent ?? currentStep.instruction).split('\n\n').map((paragraph, i) => {
                                            // Simple bold parsing: **text** → <strong>
                                            const parts = paragraph.split(/\*\*(.+?)\*\*/g);
                                            return (
                                                <p key={i}>
                                                    {parts.map((part, j) =>
                                                        j % 2 === 1
                                                            ? <strong key={j} className="text-blue-800 font-semibold">{part}</strong>
                                                            : <span key={j}>{part}</span>
                                                    )}
                                                </p>
                                            );
                                        })}
                                    </div>

                                    {/* Theory action */}
                                    <div className="border-t border-blue-200 px-4 py-3">
                                        <button
                                            onClick={onVerify}
                                            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                                        >
                                            <Icons.CheckCircle2 size={15} />
                                            Entendido, continuar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* === ACTION STEP === */
                                <>
                                    {/* Step instruction card */}
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                                        {/* Step header */}
                                        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
                                            <div className="w-6 h-6 rounded-full bg-plataforma-naranja text-white flex items-center justify-center text-xs font-bold shrink-0">
                                                {currentStepIndex + 1}
                                            </div>
                                            <h3 className="text-slate-800 font-bold text-sm leading-tight">
                                                {currentStep.title}
                                            </h3>
                                        </div>

                                        {/* Instruction */}
                                        <p className="px-4 pb-4 text-slate-600 text-sm leading-relaxed">
                                            {currentStep.instruction}
                                        </p>

                                        {/* Hint toggle */}
                                        <div className="border-t border-slate-200 px-4 py-2.5">
                                            <button
                                                onClick={() => setHintOpen(h => !h)}
                                                className="flex items-center gap-2 text-xs font-semibold text-plataforma-turquesa hover:text-teal-600 transition-colors w-full"
                                            >
                                                <Icons.Lightbulb size={13} />
                                                <span>{hintOpen ? 'Ocultar pista' : 'Ver pista'}</span>
                                                <Icons.ChevronDown
                                                    size={12}
                                                    className={`ml-auto transition-transform duration-200 ${hintOpen ? 'rotate-180' : ''}`}
                                                />
                                            </button>
                                            {hintOpen && (
                                                <p className="mt-2.5 text-xs text-slate-600 leading-relaxed bg-blue-50 border border-blue-100 rounded-lg p-3 whitespace-pre-line">
                                                    {currentStep.hint}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Completed steps (checkmarks) */}
                            {completedSteps.size > 0 && !isTheoryStep && (
                                <div className="space-y-1.5 px-1">
                                    {lesson.steps.slice(0, currentStepIndex).map((step) => (
                                        <div key={step.id} className="flex items-center gap-2 text-xs text-slate-400">
                                            {step.type === 'theory' ? (
                                                <Icons.BookOpen size={13} className="text-blue-400 shrink-0" />
                                            ) : (
                                                <Icons.CheckCircle2 size={13} className="text-plataforma-turquesa shrink-0" />
                                            )}
                                            <span className="line-through truncate">{step.title}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Validation details checklist */}
                            {!isTheoryStep && stepDetails && stepDetails.length > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requisitos</span>
                                    {stepDetails.map((detail, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                            {detail.done ? (
                                                <Icons.CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                                            ) : (
                                                <Icons.Circle size={13} className="text-slate-300 shrink-0" />
                                            )}
                                            <span className={detail.done ? 'text-emerald-700' : 'text-slate-500'}>
                                                {detail.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Status message */}
                            {!isTheoryStep && stepStatus !== 'idle' && (
                                <div
                                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm leading-relaxed ${
                                        stepStatus === 'success'
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                            : 'bg-red-50 border-red-200 text-red-700'
                                    }`}
                                >
                                    {stepStatus === 'success' ? (
                                        <Icons.CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                                    ) : (
                                        <Icons.AlertCircle size={16} className="shrink-0 mt-0.5" />
                                    )}
                                    <span>{stepMessage}</span>
                                </div>
                            )}

                            {/* Action buttons (only for action steps) */}
                            {!isTheoryStep && (
                                stepStatus !== 'success' ? (
                                    <button
                                        onClick={onVerify}
                                        className="w-full bg-plataforma-naranja hover:bg-plataforma-naranja/90 text-white font-bold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                                    >
                                        <Icons.PlayCircle size={15} />
                                        Verificar
                                    </button>
                                ) : (
                                    <button
                                        onClick={onNextStep}
                                        className="w-full bg-plataforma-turquesa hover:bg-teal-600 text-white font-bold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                                    >
                                        {isLastStep ? (
                                            <><Icons.Trophy size={15} /> Completar Lección</>
                                        ) : (
                                            <><Icons.ArrowRight size={15} /> Siguiente Paso</>
                                        )}
                                    </button>
                                )
                            )}
                        </div>

                        {/* Execute tip (only for action steps) */}
                        {!isTheoryStep && (
                            <div className="px-4 pb-1">
                                <div className="flex items-start gap-2 bg-plataforma-turquesa/5 border border-plataforma-turquesa/20 rounded-lg px-3 py-2">
                                    <Icons.Zap size={13} className="text-plataforma-turquesa shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-slate-600 leading-snug">
                                        Usa <strong className="text-plataforma-turquesa">⚙</strong> en cada nodo para configurar y el botón{' '}
                                        <strong className="text-plataforma-turquesa">Ejecutar</strong> para probar el flujo con el modelo real.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Divider — node palette section (only for action steps with allowed nodes) */}
                        {!isTheoryStep && filteredCatalog.length > 0 && (
                            <>
                                <div className="px-4 pb-1">
                                    <div className="flex items-center gap-2">
                                        <div className="h-px flex-1 bg-slate-200" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                            Nodos disponibles
                                        </span>
                                        <div className="h-px flex-1 bg-slate-200" />
                                    </div>
                                </div>

                                {/* Filtered node palette */}
                                <div className="px-4 pb-6 space-y-4">
                                    {filteredCatalog.map((section) => (
                                        <div key={section.category}>
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                {section.category}
                                            </h4>
                                            <div className="space-y-1.5">
                                                {section.items.map((node) => {
                                                    const Icon = (Icons as unknown as Record<string, LucideIcon>)[node.icon] || Icons.Box;
                                                    const colors = TYPE_COLORS[node.type];
                                                    return (
                                                        <div
                                                            key={node.title}
                                                            draggable
                                                            onDragStart={(e) => onDragStart(e, node)}
                                                            className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-grab active:cursor-grabbing transition-all bg-white select-none ${colors}`}
                                                        >
                                                            <Icon size={14} className="shrink-0" />
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-slate-700 truncate">{node.title}</div>
                                                                <div className="text-slate-400 text-[10px] truncate">{node.description}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </aside>
    );
};
