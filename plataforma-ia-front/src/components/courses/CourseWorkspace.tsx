import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { DragEvent } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    ReactFlowProvider,
    BackgroundVariant,
} from '@xyflow/react';
import type { Connection, Edge, Node, ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../diagrams/reactflow-custom.css';
import './course-workspace.css';

import { BaseNode } from './nodes/BaseNode';
import { CourseSelectScreen } from './CourseSelectScreen';
import { GuidedInstructionsPanel } from './GuidedInstructionsPanel';
import { ChatTestPanel } from './ChatTestPanel';
import type { ChatMsg } from './ChatTestPanel';
import type { Course, CourseLesson } from './courseData';
import { courses } from './courseData';
import type { NodeExecutionState } from './types';
import type { ValidationDetail } from './types';
import { useCourseProgress } from './useCourseProgress';
import * as Icons from 'lucide-react';

const nodeTypes = { customNode: BaseNode };

interface CourseNodeData {
    type: string;
    title: string;
    [key: string]: unknown;
}

let nodeIdCounter = 1;
const getNewId = () => `node_${nodeIdCounter++}`;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface GuidedState {
    course: Course;
    lesson: CourseLesson;
    lessonIndex: number;
    currentStepIndex: number;
    completedSteps: Set<string>;
    stepStatus: 'idle' | 'success' | 'error';
    stepMessage: string;
    stepDetails?: ValidationDetail[];
}

interface LogEntry {
    id: string;
    nodeTitle: string;
    status: 'info' | 'running' | 'done' | 'error';
    message: string;
}

/* ── Topological sort (Kahn) ── */
const getExecutionOrder = (nds: Node[], eds: Edge[]): string[] => {
    const inDegree: Record<string, number> = {};
    nds.forEach(n => { inDegree[n.id] = 0; });
    eds.forEach(e => { inDegree[e.target] = (inDegree[e.target] || 0) + 1; });

    const queue = nds.filter(n => inDegree[n.id] === 0).map(n => n.id);
    const result: string[] = [];
    while (queue.length > 0) {
        const id = queue.shift()!;
        result.push(id);
        eds.filter(e => e.source === id).forEach(e => {
            inDegree[e.target]--;
            if (inDegree[e.target] === 0) queue.push(e.target);
        });
    }
    return result;
};

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/* ════════════════════════════════════════════════════════════════════════ */

const CourseWorkspaceContent = () => {
    const { getIdToken } = useAuth();
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [guided, setGuided] = useState<GuidedState | null>(null);

    /* ── Progress persistence ── */
    const { markStepComplete, markLessonComplete, getLessonProgress, progress } = useCourseProgress();

    /* ── Chat state ── */
    const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);

    /* ── Execution state ── */
    const [isExecuting, setIsExecuting] = useState(false);
    const [execLog, setExecLog] = useState<LogEntry[]>([]);
    const [showLog, setShowLog] = useState(false);
    const logRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [execLog]);

    /* ── React Flow ── */
    const onConnect = useCallback(
        (params: Connection) =>
            setEdges(eds =>
                addEdge({ ...params, animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 } }, eds)
            ),
        [setEdges]
    );

    const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
            const nodeDataStr = event.dataTransfer.getData('application/reactflow');
            if (!nodeDataStr || !reactFlowInstance || !reactFlowBounds) return;

            const nodeData = JSON.parse(nodeDataStr);
            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX - reactFlowBounds.left,
                y: event.clientY - reactFlowBounds.top,
            });

            setNodes(nds => nds.concat({
                id: getNewId(),
                type: 'customNode',
                position,
                data: { ...nodeData, executionState: 'idle' },
            }));
        },
        [reactFlowInstance, setNodes]
    );

    /* ── Guided mode ── */
    const handleSelectLesson = (course: Course, lesson: CourseLesson, lessonIndex: number) => {
        setNodes([]);
        setEdges([]);
        setChatMessages([]);
        setExecLog([]);
        setShowLog(false);

        // Restore progress from localStorage
        const saved = getLessonProgress(lesson.id);
        const restoredSteps = new Set(saved.completedStepIds.filter(id => lesson.steps.some(s => s.id === id)));
        // Start at the first incomplete step
        let startIndex = 0;
        for (let i = 0; i < lesson.steps.length; i++) {
            if (restoredSteps.has(lesson.steps[i].id)) startIndex = i + 1;
            else break;
        }
        if (startIndex >= lesson.steps.length) startIndex = lesson.steps.length - 1;

        setGuided({ course, lesson, lessonIndex, currentStepIndex: startIndex, completedSteps: restoredSteps, stepStatus: 'idle', stepMessage: '' });
    };

    const handleVerify = () => {
        if (!guided) return;
        const step = guided.lesson.steps[guided.currentStepIndex];
        // Theory steps auto-complete
        if (step.type === 'theory') {
            const newCompleted = new Set(guided.completedSteps);
            newCompleted.add(step.id);
            markStepComplete(guided.lesson.id, step.id);
            const nextIndex = guided.currentStepIndex + 1;
            const allDone = nextIndex >= guided.lesson.steps.length;
            if (allDone) markLessonComplete(guided.lesson.id);
            setGuided(g => g ? { ...g, completedSteps: newCompleted, currentStepIndex: allDone ? g.currentStepIndex : nextIndex, stepStatus: 'idle', stepMessage: '', stepDetails: undefined } : null);
            return;
        }
        const result = step.validate(nodes, edges);
        setGuided(g => g ? { ...g, stepStatus: result.success ? 'success' : 'error', stepMessage: result.message, stepDetails: result.details } : null);
    };

    const handleNextStep = () => {
        if (!guided) return;
        const step = guided.lesson.steps[guided.currentStepIndex];
        const newCompleted = new Set(guided.completedSteps);
        newCompleted.add(step.id);

        // Persist to localStorage
        markStepComplete(guided.lesson.id, step.id);

        const nextIndex = guided.currentStepIndex + 1;
        const allDone = nextIndex >= guided.lesson.steps.length;
        if (allDone) markLessonComplete(guided.lesson.id);
        setGuided(g => g ? { ...g, completedSteps: newCompleted, currentStepIndex: allDone ? g.currentStepIndex : nextIndex, stepStatus: 'idle', stepMessage: '', stepDetails: undefined } : null);
    };

    /* ── Navigate directly to next lesson ── */
    const handleNextLesson = () => {
        if (!guided) return;
        const { course, lessonIndex } = guided;
        const nextIdx = lessonIndex + 1;
        if (nextIdx < course.lessons.length) {
            handleSelectLesson(course, course.lessons[nextIdx], nextIdx);
        } else {
            // Find next course
            const courseIdx = courses.findIndex(c => c.id === course.id);
            const nextCourse = courses[courseIdx + 1];
            if (nextCourse) {
                handleSelectLesson(nextCourse, nextCourse.lessons[0], 0);
            } else {
                handleExit();
            }
        }
    };

    const handleExit = () => {
        setNodes([]);
        setEdges([]);
        setChatMessages([]);
        setExecLog([]);
        setShowLog(false);
        setGuided(null);
    };

    /* ── Auto-advance: detect step completion when nodes/edges change ── */
    const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!guided || guided.stepStatus === 'success') return;
        const step = guided.lesson.steps[guided.currentStepIndex];
        if (!step || step.type === 'theory') return;

        if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
        // Debounce: 300ms for canvas actions, 600ms for prompt editing steps
        const debounceMs = step.allowedNodeTypes.length === 1 && step.allowedNodeTypes[0] === 'llm' ? 600 : 300;
        autoAdvanceTimer.current = setTimeout(() => {
            const result = step.validate(nodes, edges);
            if (result.success) {
                setGuided(g => g ? { ...g, stepStatus: 'success', stepMessage: result.message, stepDetails: result.details } : null);
            }
        }, debounceMs);

        return () => { if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, edges, guided?.currentStepIndex]);

    /* ════════════════════════════════════════════════════════════════════
       EXECUTION ENGINE — returns the AI response string
    ════════════════════════════════════════════════════════════════════ */

    const addLog = (entry: LogEntry) => setExecLog(prev => [...prev, entry]);

    const setNodeExecState = (nodeId: string, state: NodeExecutionState, output?: string) => {
        setNodes(nds => nds.map(n =>
            n.id === nodeId
                ? { ...n, data: { ...n.data, executionState: state, ...(output !== undefined ? { executionOutput: output } : {}) } }
                : n
        ));
    };

    const executeFlowCore = async (userMessage: string): Promise<string> => {
        setIsExecuting(true);
        setExecLog([]);
        setShowLog(true);

        /* Reset node states */
        setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, executionState: 'idle', executionOutput: undefined } })));
        await delay(50);

        const currentNodes = nodes;
        const currentEdges = edges;

        if (currentEdges.length === 0) {
            addLog({ id: 'sys', nodeTitle: 'Sistema', status: 'error', message: 'Conecta los nodos antes de ejecutar.' });
            setIsExecuting(false);
            return 'No hay conexiones entre los nodos del flujo.';
        }

        const order = getExecutionOrder(currentNodes, currentEdges);
        if (order.length === 0) {
            addLog({ id: 'sys', nodeTitle: 'Sistema', status: 'error', message: 'No se encontraron nodos para ejecutar.' });
            setIsExecuting(false);
            return 'No hay nodos en el flujo.';
        }

        addLog({ id: 'sys-start', nodeTitle: 'Sistema', status: 'info', message: `Iniciando ejecución — ${order.length} nodo(s)` });

        let apiResponse = '';
        const msgShort = `"${userMessage.slice(0, 45)}${userMessage.length > 45 ? '…' : ''}"`;

        for (const nodeId of order) {
            const node = currentNodes.find(n => n.id === nodeId);
            if (!node) continue;

            const nd        = node.data as CourseNodeData;
            const nodeType  = nd.type;
            const nodeTitle = nd.title;

            /* pending → running */
            setNodeExecState(nodeId, 'pending');
            await delay(280);
            setNodeExecState(nodeId, 'running');

            /* ─── Data / Input ─── */
            if (nodeType === 'data') {
                if (nodeTitle.includes('Input')) {
                    addLog({ id: nodeId, nodeTitle, status: 'running', message: 'Cargando mensaje del usuario...' });
                    await delay(450);
                    setNodeExecState(nodeId, 'done', msgShort);
                    addLog({ id: nodeId, nodeTitle, status: 'done', message: `Mensaje: ${msgShort}` });
                } else {
                    addLog({ id: nodeId, nodeTitle, status: 'running', message: 'Recuperando contexto semántico...' });
                    await delay(900);
                    setNodeExecState(nodeId, 'done', 'Contexto recuperado');
                    addLog({ id: nodeId, nodeTitle, status: 'done', message: 'Contexto recuperado desde base de conocimiento.' });
                }

            /* ─── LLM / Agent ─── */
            } else if (nodeType === 'llm' || nodeType === 'agent') {
                const model        = (nd.model        as string) || 'gpt-5.2-chat';
                const systemPrompt = (nd.systemPrompt as string || '').trim();
                const temperature  = nd.temperature   as number | undefined;

                addLog({ id: nodeId, nodeTitle, status: 'running', message: `Enviando a ${model} (temp=${temperature?.toFixed(1) ?? '?'})…` });

                let message = userMessage;
                if (systemPrompt) message = `${systemPrompt}\n\n---\n\n${userMessage}`;

                const t0 = Date.now();
                try {
                    const token = await getIdToken();
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (token) headers['Authorization'] = `Bearer ${token}`;
                    const resp = await fetch(`${API_URL}/chat/message`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ message }),
                    });
                    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
                    const data = await resp.json();
                    apiResponse = data.content || '';

                    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
                    setNodeExecState(nodeId, 'done', `Procesado en ${elapsed}s`);
                    addLog({ id: nodeId, nodeTitle, status: 'done', message: `Respuesta generada en ${elapsed}s (${apiResponse.length} chars)` });

                } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Error desconocido';
                    setNodeExecState(nodeId, 'error', `Error: ${msg}`);
                    addLog({ id: nodeId, nodeTitle, status: 'error', message: `Error: ${msg}` });
                    apiResponse = `Error al ejecutar el modelo: ${msg}`;
                }

            /* ─── Tool ─── */
            } else if (nodeType === 'tool') {
                addLog({ id: nodeId, nodeTitle, status: 'running', message: `Ejecutando "${nodeTitle}"…` });
                await delay(1100);
                setNodeExecState(nodeId, 'done', 'Ejecutada');
                addLog({ id: nodeId, nodeTitle, status: 'done', message: `"${nodeTitle}" ejecutada exitosamente.` });

            /* ─── Output ─── */
            } else if (nodeType === 'output') {
                addLog({ id: nodeId, nodeTitle, status: 'running', message: 'Enviando respuesta al chat...' });
                await delay(350);
                setNodeExecState(nodeId, 'done', '↗ Respuesta enviada al Chat de prueba');
                addLog({ id: nodeId, nodeTitle, status: 'done', message: 'Respuesta disponible en el Chat de prueba.' });
            }
        }

        if (!apiResponse) {
            apiResponse = 'El flujo se ejecutó correctamente pero no contiene un nodo LLM/Agente para generar respuesta.';
        }

        addLog({ id: 'sys-end', nodeTitle: 'Sistema', status: 'done', message: '✓ Ejecución completada.' });
        setIsExecuting(false);
        return apiResponse;
    };

    /* ─── Chat: send message → execute flow → show response ─── */
    const sendChatMessage = async (userMessage: string) => {
        if (isExecuting) return;

        const userId = `u-${Date.now()}`;
        const aiId   = `a-${Date.now() + 1}`;

        setChatMessages(prev => [
            ...prev,
            { id: userId, role: 'user',      content: userMessage },
            { id: aiId,   role: 'assistant', content: '', isLoading: true },
        ]);

        const response = await executeFlowCore(userMessage);

        setChatMessages(prev =>
            prev.map(m => m.id === aiId ? { ...m, content: response, isLoading: false } : m)
        );
    };

    const clearExecution = () => {
        setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, executionState: 'idle', executionOutput: undefined } })));
        setExecLog([]);
        setShowLog(false);
    };

    /* ── Derived state ── */
    const canExecute = nodes.length >= 1 && edges.length >= 1;
    const hasRun     = execLog.length > 0;

    const progressPct    = guided ? Math.round((guided.completedSteps.size / guided.lesson.steps.length) * 100) : 0;
    const currentStepNum = guided ? guided.completedSteps.size + 1 : 0;
    const totalSteps     = guided ? guided.lesson.steps.length : 0;

    /* ── Current step suggested prompts ── */
    const currentStep = guided ? guided.lesson.steps[guided.currentStepIndex] : null;
    const suggestedPrompts = currentStep?.suggestedTestPrompts;
    const testObservation = currentStep?.testObservation;

    /* ── Course selector ── */
    if (!guided) return <CourseSelectScreen onSelectLesson={handleSelectLesson} progress={progress} />;

    /* ════════════════════════════════════════════════════════════════════
       RENDER
    ════════════════════════════════════════════════════════════════════ */
    return (
        <div className="flex flex-col h-full w-full bg-transparent text-slate-700 font-sans overflow-hidden">

            {/* ── Top header ── */}
            <div className="h-14 bg-white/40 backdrop-blur-md border-b border-white/50 flex items-center justify-between px-4 shrink-0 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-plataforma-turquesa/10 text-plataforma-turquesa flex items-center justify-center shrink-0">
                        <Icons.Workflow size={18} />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-900 font-bold text-base">AgentFlow</span>
                        <span className="text-slate-300 hidden sm:block">·</span>
                        <span className="text-slate-500 text-sm truncate hidden sm:block">
                            {guided.course.title} → {guided.lesson.title}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Step progress */}
                    <div className="hidden md:flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                            Paso {Math.min(currentStepNum, totalSteps)}/{totalSteps}
                        </span>
                        <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-plataforma-turquesa rounded-full transition-all duration-500"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <span className="text-xs font-medium text-plataforma-turquesa w-8 text-right">{progressPct}%</span>
                    </div>

                    {/* Log toggle */}
                    {hasRun && (
                        <button
                            onClick={() => setShowLog(v => !v)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${showLog ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200'}`}
                            title={showLog ? 'Ocultar log' : 'Ver log de ejecución'}
                        >
                            <Icons.Terminal size={13} />
                            <span className="hidden sm:block">Log</span>
                        </button>
                    )}

                    {/* Reset */}
                    {hasRun && !isExecuting && (
                        <button
                            onClick={clearExecution}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200"
                            title="Limpiar estados de ejecución"
                        >
                            <Icons.RotateCcw size={14} />
                        </button>
                    )}

                    {/* Back */}
                    <button
                        onClick={handleExit}
                        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100 border border-slate-200"
                    >
                        <Icons.ChevronLeft size={14} />
                        <span className="hidden sm:block">Cursos</span>
                    </button>
                </div>
            </div>

            {/* ── Main area: Sidebar | Canvas | Chat ── */}
            <div className="flex flex-1 overflow-hidden">

                {/* Left: guided instructions */}
                <GuidedInstructionsPanel
                    course={guided.course}
                    lesson={guided.lesson}
                    lessonIndex={guided.lessonIndex}
                    currentStepIndex={guided.currentStepIndex}
                    completedSteps={guided.completedSteps}
                    stepStatus={guided.stepStatus}
                    stepMessage={guided.stepMessage}
                    stepDetails={guided.stepDetails}
                    onVerify={handleVerify}
                    onNextStep={handleNextStep}
                    onNextLesson={handleNextLesson}
                    onExit={handleExit}
                />

                {/* Center: Canvas + optional log panel */}
                <div className="flex flex-col flex-1 overflow-hidden">

                    {/* React Flow canvas */}
                    <div className="flex-1 relative overflow-hidden" ref={reactFlowWrapper}>
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onInit={setReactFlowInstance}
                            onDrop={onDrop}
                            onDragOver={onDragOver}
                            nodeTypes={nodeTypes}
                            className="bg-transparent"
                            fitView
                            deleteKeyCode="Delete"
                        >
                            <Background variant={BackgroundVariant.Dots} gap={24} size={2} color="#cbd5e1" />
                            <Controls
                                showInteractive={false}
                                className="bg-white border-none shadow-md [&>button]:border-slate-200 [&>button]:hover:bg-slate-50"
                            />
                            <MiniMap
                                className="bg-white border border-slate-200 rounded-lg shadow-md"
                                maskColor="#f8fafcb0"
                                nodeColor={(n: Node) => {
                                    const t = n.data?.type;
                                    if (t === 'agent')  return '#f97316';
                                    if (t === 'llm')    return '#06b6d4';
                                    if (t === 'tool')   return '#eab308';
                                    if (t === 'data')   return '#10b981';
                                    if (t === 'output') return '#ef4444';
                                    return '#94a3b8';
                                }}
                            />
                        </ReactFlow>

                        {/* Empty canvas hint */}
                        {nodes.length === 0 && (
                            <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-white/90 backdrop-blur border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm shadow-md pointer-events-none">
                                <Icons.MousePointerClick size={16} className="text-plataforma-turquesa shrink-0" />
                                Arrastra los nodos del panel izquierdo hacia aquí
                            </div>
                        )}

                        {/* Ready to chat hint */}
                        {canExecute && !hasRun && !isExecuting && (
                            <div className="absolute top-4 right-4 flex items-center gap-2 bg-plataforma-turquesa/10 border border-plataforma-turquesa/30 text-plataforma-turquesa px-3 py-1.5 rounded-lg text-xs pointer-events-none">
                                <Icons.MessageCircle size={13} />
                                Escribe en el Chat de prueba →
                            </div>
                        )}

                        {/* Delete hint */}
                        {nodes.length > 0 && (
                            <div className="absolute bottom-4 right-4 text-[11px] text-slate-400 bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5 pointer-events-none">
                                <kbd className="font-mono">Delete</kbd> para eliminar nodo seleccionado
                            </div>
                        )}
                    </div>

                    {/* ── Execution log panel (bottom) ── */}
                    {showLog && (
                        <div className="border-t border-slate-700 bg-slate-900 shrink-0 flex flex-col" style={{ height: 200 }}>
                            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/70 shrink-0">
                                <div className="flex items-center gap-2">
                                    <Icons.Terminal size={13} className="text-plataforma-turquesa" />
                                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Log de Ejecución</span>
                                    {isExecuting && <Icons.Loader2 size={11} className="animate-spin text-plataforma-turquesa" />}
                                    <span className="text-[10px] text-slate-500">({execLog.length} entradas)</span>
                                </div>
                                <button
                                    onClick={() => setShowLog(false)}
                                    className="p-0.5 rounded text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    <Icons.X size={13} />
                                </button>
                            </div>

                            <div
                                ref={logRef}
                                className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5 font-mono text-[11px] custom-scrollbar"
                            >
                                {execLog.map((entry, i) => (
                                    <div key={i} className="flex items-start gap-2.5 leading-relaxed">
                                        <span className="shrink-0 mt-0.5">
                                            {entry.status === 'running' && <Icons.Loader2     size={10} className="animate-spin text-plataforma-turquesa" />}
                                            {entry.status === 'done'    && <Icons.CheckCircle2 size={10} className="text-emerald-400" />}
                                            {entry.status === 'error'   && <Icons.XCircle      size={10} className="text-red-400" />}
                                            {entry.status === 'info'    && <Icons.Info          size={10} className="text-slate-500" />}
                                        </span>
                                        <span className={`shrink-0 ${
                                            entry.nodeTitle === 'Sistema' ? 'text-slate-500' :
                                            entry.status === 'error'      ? 'text-red-400' :
                                            entry.status === 'done'       ? 'text-emerald-400' :
                                                                            'text-plataforma-turquesa'
                                        }`}>[{entry.nodeTitle}]</span>
                                        <span className={entry.status === 'error' ? 'text-red-300' : entry.nodeTitle === 'Sistema' ? 'text-slate-500' : 'text-slate-300'}>
                                            {entry.message}
                                        </span>
                                    </div>
                                ))}
                                {isExecuting && (
                                    <div className="flex items-center gap-1 text-plataforma-turquesa">
                                        <span className="animate-pulse">▌</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Chat test panel */}
                <ChatTestPanel
                    messages={chatMessages}
                    isExecuting={isExecuting}
                    canExecute={canExecute}
                    onSend={sendChatMessage}
                    onClear={() => { setChatMessages([]); clearExecution(); }}
                    suggestedPrompts={suggestedPrompts}
                    testObservation={testObservation}
                />
            </div>
        </div>
    );
};

export const CourseWorkspace = () => (
    <ReactFlowProvider>
        <CourseWorkspaceContent />
    </ReactFlowProvider>
);
