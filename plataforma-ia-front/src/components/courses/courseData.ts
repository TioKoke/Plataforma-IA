import type { Node, Edge } from '@xyflow/react';
import type { BaseNodeData, NodeType, ValidationResult } from './types';

const d = (n: Node) => n.data as BaseNodeData;

export type StepType = 'action' | 'theory';

export interface CourseStep {
    id: string;
    title: string;
    instruction: string;
    hint: string;
    type?: StepType; // default 'action'
    theoryContent?: string; // rich text for theory steps
    allowedNodeTypes: NodeType[];
    validate: (nodes: Node[], edges: Edge[]) => ValidationResult;
    suggestedTestPrompts?: string[];
    testObservation?: string;
}

export interface CourseLesson {
    id: string;
    title: string;
    description: string;
    icon: string;
    steps: CourseStep[];
    summary?: string[];
    nextLessonId?: string;
}

export interface Course {
    id: string;
    title: string;
    description: string;
    level: 'Básico' | 'Intermedio' | 'Avanzado';
    icon: string;
    estimatedMinutes: number;
    badgeColor: string;
    accentClass: string;
    lessons: CourseLesson[];
    prerequisiteCourseIds?: string[];
}

/* Helper: always-pass validator for theory steps */
const theoryValidate = (): ValidationResult => ({ success: true, message: '' });

export const courses: Course[] = [
    /* ══════════════════════════════════════════════════════════════
       COURSE 1: Fundamentos de IA (Básico)
    ══════════════════════════════════════════════════════════════ */
    {
        id: 'course-1',
        title: 'Fundamentos de IA',
        description: 'Aprende los conceptos básicos de flujos de IA conectando nodos simples paso a paso.',
        level: 'Básico',
        icon: 'Lightbulb',
        estimatedMinutes: 20,
        badgeColor: 'bg-emerald-500 text-white',
        accentClass: 'border-emerald-400 bg-emerald-50 text-emerald-700',
        lessons: [
            {
                id: 'l1-1',
                title: 'Tu Primer Flujo',
                description: 'Crea el flujo más simple posible: una entrada conectada a una salida.',
                icon: 'Workflow',
                nextLessonId: 'l1-2',
                summary: [
                    'Los flujos de IA se construyen conectando nodos que representan componentes del sistema',
                    'Un nodo de "Input" recibe la consulta del usuario y un nodo de "Salida" entrega la respuesta',
                    'Las conexiones definen el camino que sigue la información dentro del flujo',
                ],
                steps: [
                    {
                        id: 's1-1-0',
                        type: 'theory',
                        title: '¿Qué es un flujo de IA?',
                        instruction: 'Antes de construir, entendamos el concepto.',
                        theoryContent: 'Un **flujo de IA** es un pipeline visual donde cada componente (nodo) cumple una función específica: recibir datos, procesarlos con un modelo de lenguaje, ejecutar herramientas, o entregar la respuesta final.\n\nEn Plataforma IA, los flujos permiten que los agentes de IA procesen consultas de los trabajadores de forma estructurada y predecible. Piensa en cada nodo como una estación en una línea de producción minera — cada uno hace su parte del trabajo.',
                        hint: '',
                        allowedNodeTypes: [],
                        validate: theoryValidate,
                    },
                    {
                        id: 's1-1-1',
                        title: 'Agrega un Input',
                        instruction: 'Arrastra el nodo "Input Usuario" desde el panel de nodos hacia el canvas.',
                        hint: 'Busca "Input Usuario" en la sección "Datos" del panel de abajo. Haz clic y arrastra hacia el área del canvas.',
                        allowedNodeTypes: ['data'],
                        validate: (nodes) => {
                            const hasInput = nodes.some(n => d(n).type === 'data' && d(n).title.includes('Input'));
                            return {
                                success: hasInput,
                                message: hasInput ? '¡Perfecto! Nodo Input agregado al canvas.' : 'Necesitas agregar el nodo "Input Usuario" al canvas.',
                                details: [
                                    { label: 'Input Usuario en el canvas', done: hasInput },
                                ],
                            };
                        },
                    },
                    {
                        id: 's1-1-2',
                        title: 'Agrega una Salida',
                        instruction: 'Ahora arrastra el nodo "Respuesta Final" al canvas. Este será el punto de salida del flujo.',
                        hint: 'El nodo "Respuesta Final" aparece en la sección "Salidas" del panel de abajo.',
                        allowedNodeTypes: ['data', 'output'],
                        validate: (nodes) => {
                            const hasOutput = nodes.some(n => d(n).type === 'output');
                            return {
                                success: hasOutput,
                                message: hasOutput ? '¡Bien! Salida definida.' : 'Agrega el nodo "Respuesta Final" al canvas.',
                                details: [
                                    { label: 'Respuesta Final en el canvas', done: hasOutput },
                                ],
                            };
                        },
                    },
                    {
                        id: 's1-1-3',
                        title: 'Conecta los Nodos',
                        instruction: 'Pasa el cursor sobre el borde derecho del nodo Input hasta que aparezca un círculo. Arrastra desde ahí hasta el nodo Respuesta Final.',
                        hint: 'El punto de conexión aparece al pasar el cursor sobre el borde derecho del nodo. Arrastra y suelta sobre el nodo de destino.',
                        allowedNodeTypes: ['data', 'output'],
                        validate: (nodes, edges) => {
                            const input = nodes.find(n => d(n).type === 'data');
                            const output = nodes.find(n => d(n).type === 'output');
                            const hasInput = !!input;
                            const hasOutput = !!output;
                            const connected = hasInput && hasOutput && edges.some(e => e.source === input!.id && e.target === output!.id);
                            return {
                                success: connected,
                                message: connected ? '¡Excelente! Has creado tu primer flujo de IA.' : 'Conecta el nodo Input con la Respuesta Final.',
                                details: [
                                    { label: 'Input Usuario en canvas', done: hasInput },
                                    { label: 'Respuesta Final en canvas', done: hasOutput },
                                    { label: 'Input → Respuesta Final conectados', done: connected },
                                ],
                            };
                        },
                        suggestedTestPrompts: ['Hola, ¿qué puedes hacer?', '¿Cuál es la producción diaria de cobre?'],
                        testObservation: 'Nota que sin un modelo LLM en el flujo, la respuesta es un eco del mensaje. En la siguiente lección agregaremos inteligencia.',
                    },
                ],
            },
            {
                id: 'l1-2',
                title: 'Introduciendo un LLM',
                description: 'Agrega inteligencia al flujo incorporando GPT 5 Chat (gpt-5.2-chat) — el modelo implementado en Plataforma IA — entre entrada y salida.',
                icon: 'BrainCircuit',
                nextLessonId: 'l2-1',
                summary: [
                    'Un LLM (Large Language Model) es el "cerebro" del flujo que procesa y genera texto',
                    'El pipeline Input → LLM → Output es el patrón fundamental de cualquier sistema de IA conversacional',
                    'GPT 5 Chat (gpt-5.2-chat) es el modelo desplegado en la infraestructura de Plataforma IA',
                ],
                steps: [
                    {
                        id: 's1-2-0',
                        type: 'theory',
                        title: '¿Qué es un LLM?',
                        instruction: 'Entendamos qué hace un modelo de lenguaje en el flujo.',
                        theoryContent: 'Un **LLM (Large Language Model)** es un modelo de inteligencia artificial entrenado con grandes volúmenes de texto. Puede entender preguntas, generar respuestas, resumir documentos y razonar sobre problemas complejos.\n\nEn Plataforma IA usamos **GPT 5 Chat (gpt-5.2-chat)** desplegado en Azure AI Foundry. Cada nodo LLM tiene parámetros configurables:\n- **Temperatura**: controla la creatividad (0 = preciso, 1 = creativo)\n- **Max Tokens**: límite de longitud de la respuesta\n- **System Prompt**: instrucciones que definen el comportamiento del modelo',
                        hint: '',
                        allowedNodeTypes: [],
                        validate: theoryValidate,
                    },
                    {
                        id: 's1-2-1',
                        title: 'Input y Modelo LLM',
                        instruction: 'Arrastra al canvas: "Input Usuario" y "GPT 5 Chat". Son los primeros dos bloques del pipeline. Observa que el nodo LLM ya trae su configuración de ejecución: modelo gpt-5.2-chat, temperatura y tokens.',
                        hint: '"Input Usuario" está en Datos. "GPT 5 Chat" está en Modelos LLM — es el modelo principal de Plataforma IA.',
                        allowedNodeTypes: ['data', 'llm'],
                        validate: (nodes) => {
                            const hasData = nodes.some(n => d(n).type === 'data');
                            const hasLLM = nodes.some(n => d(n).type === 'llm');
                            return {
                                success: hasData && hasLLM,
                                message: hasData && hasLLM ? '¡Ambos nodos agregados! Nota la config de ejecución en el nodo LLM.' : 'Agrega ambos nodos al canvas.',
                                details: [
                                    { label: 'Input Usuario en canvas', done: hasData },
                                    { label: 'GPT 5 Chat en canvas', done: hasLLM },
                                ],
                            };
                        },
                    },
                    {
                        id: 's1-2-2',
                        title: 'Agrega la Salida',
                        instruction: 'Agrega el nodo "Respuesta Final" para completar los tres componentes del pipeline.',
                        hint: '"Respuesta Final" está en la sección Salidas del panel.',
                        allowedNodeTypes: ['data', 'llm', 'output'],
                        validate: (nodes) => {
                            const hasOutput = nodes.some(n => d(n).type === 'output');
                            return {
                                success: hasOutput,
                                message: hasOutput ? '¡Los tres nodos están listos!' : 'Agrega el nodo "Respuesta Final".',
                                details: [
                                    { label: 'Respuesta Final en canvas', done: hasOutput },
                                ],
                            };
                        },
                    },
                    {
                        id: 's1-2-3',
                        title: 'Conecta el Pipeline',
                        instruction: 'Conecta: Input → GPT 5 Chat → Respuesta Final. El modelo gpt-5.2-chat procesa el input y genera la respuesta.',
                        hint: 'Haz las conexiones en orden: primero Input → LLM, luego LLM → Respuesta Final.',
                        allowedNodeTypes: ['data', 'llm', 'output'],
                        validate: (nodes, edges) => {
                            const input = nodes.find(n => d(n).type === 'data');
                            const llm = nodes.find(n => d(n).type === 'llm');
                            const output = nodes.find(n => d(n).type === 'output');
                            const inputToLLM = !!input && !!llm && edges.some(e => e.source === input.id && e.target === llm.id);
                            const llmToOutput = !!llm && !!output && edges.some(e => e.source === llm.id && e.target === output.id);
                            return {
                                success: inputToLLM && llmToOutput,
                                message: inputToLLM && llmToOutput ? '¡Pipeline con LLM completo! Así funciona una IA con gpt-5.2-chat.' : 'Conecta los nodos en orden.',
                                details: [
                                    { label: 'Input → GPT 5 Chat', done: inputToLLM },
                                    { label: 'GPT 5 Chat → Respuesta Final', done: llmToOutput },
                                ],
                            };
                        },
                        suggestedTestPrompts: [
                            '¿Qué es la lixiviación en minería?',
                            'Explica las medidas de seguridad en una mina subterránea',
                        ],
                        testObservation: 'Ahora la respuesta viene del modelo GPT 5 Chat. Nota la diferencia vs el flujo sin LLM de la lección anterior.',
                    },
                ],
            },
        ],
    },

    /* ══════════════════════════════════════════════════════════════
       COURSE 2: Agentes Autónomos (Intermedio)
    ══════════════════════════════════════════════════════════════ */
    {
        id: 'course-2',
        title: 'Agentes Autónomos',
        description: 'Diseña sistemas multi-agente con herramientas externas y orquestación avanzada.',
        level: 'Intermedio',
        icon: 'Bot',
        estimatedMinutes: 35,
        badgeColor: 'bg-orange-500 text-white',
        accentClass: 'border-orange-400 bg-orange-50 text-orange-700',
        prerequisiteCourseIds: ['course-1'],
        lessons: [
            {
                id: 'l2-1',
                title: 'El Agente Orquestador',
                description: 'Aprende el rol del agente coordinador: recibe tareas y las ejecuta de forma autónoma.',
                icon: 'Network',
                nextLessonId: 'l2-2',
                summary: [
                    'Un agente orquestador recibe tareas complejas y las ejecuta de forma autónoma',
                    'A diferencia de un LLM simple, un agente puede tomar decisiones y ejecutar acciones',
                    'El patrón Input → Agente → Output es la base de los 24 agentes de Plataforma IA',
                ],
                steps: [
                    {
                        id: 's2-1-0',
                        type: 'theory',
                        title: '¿Qué es un agente de IA?',
                        instruction: 'Entendamos la diferencia entre un LLM y un agente.',
                        theoryContent: 'Un **agente de IA** es un sistema que va más allá de solo generar texto. Puede:\n- **Razonar** sobre qué acciones tomar\n- **Ejecutar herramientas** (buscar en internet, consultar bases de datos, crear archivos)\n- **Iterar** hasta completar una tarea compleja\n\nEn Plataforma IA tenemos 24 agentes especializados por área: legal, RRHH, abastecimiento, seguridad, etc. Cada uno tiene un **agente orquestador** que coordina el trabajo y decide qué herramientas usar.',
                        hint: '',
                        allowedNodeTypes: [],
                        validate: theoryValidate,
                    },
                    {
                        id: 's2-1-1',
                        title: 'Input y Agente',
                        instruction: 'Agrega "Input Usuario" y "Agent Orquestador" al canvas.',
                        hint: '"Agent Orquestador" está en la sección Agentes del panel de nodos.',
                        allowedNodeTypes: ['data', 'agent'],
                        validate: (nodes) => {
                            const hasData = nodes.some(n => d(n).type === 'data');
                            const hasAgent = nodes.some(n => d(n).type === 'agent');
                            return {
                                success: hasData && hasAgent,
                                message: hasData && hasAgent ? '¡Nodos listos!' : 'Agrega ambos nodos.',
                                details: [
                                    { label: 'Input Usuario en canvas', done: hasData },
                                    { label: 'Agent Orquestador en canvas', done: hasAgent },
                                ],
                            };
                        },
                    },
                    {
                        id: 's2-1-2',
                        title: 'Conecta Input → Agente',
                        instruction: 'Conecta el Input al Agente Orquestador. Así el agente recibe las instrucciones del usuario.',
                        hint: 'Arrastra desde el borde derecho del Input hasta el borde izquierdo del Agente.',
                        allowedNodeTypes: ['data', 'agent'],
                        validate: (nodes, edges) => {
                            const input = nodes.find(n => d(n).type === 'data');
                            const agent = nodes.find(n => d(n).type === 'agent');
                            const connected = !!input && !!agent && edges.some(e => e.source === input.id && e.target === agent.id);
                            return {
                                success: connected,
                                message: connected ? '¡Agente conectado al input!' : 'Conecta Input → Agent Orquestador.',
                                details: [
                                    { label: 'Input → Agent Orquestador', done: connected },
                                ],
                            };
                        },
                    },
                    {
                        id: 's2-1-3',
                        title: 'Completa con la Salida',
                        instruction: 'Agrega "Respuesta Final" y conecta el Agente con ella para completar el flujo.',
                        hint: 'Agrega el nodo Respuesta Final y conecta Agente → Respuesta Final.',
                        allowedNodeTypes: ['data', 'agent', 'output'],
                        validate: (nodes, edges) => {
                            const agent = nodes.find(n => d(n).type === 'agent');
                            const output = nodes.find(n => d(n).type === 'output');
                            const hasOutput = !!output;
                            const connected = !!agent && hasOutput && edges.some(e => e.source === agent.id && e.target === output!.id);
                            return {
                                success: connected,
                                message: connected ? '¡Agente orquestador configurado exitosamente!' : 'Completa el flujo.',
                                details: [
                                    { label: 'Respuesta Final en canvas', done: hasOutput },
                                    { label: 'Agente → Respuesta Final', done: connected },
                                ],
                            };
                        },
                        suggestedTestPrompts: [
                            'Genera un resumen de seguridad para la mina El Teniente',
                            'Crea un plan de mantención preventiva para los chancadores',
                        ],
                        testObservation: 'El agente orquestador procesa la tarea completa de forma autónoma. En la siguiente lección le daremos herramientas.',
                    },
                ],
            },
            {
                id: 'l2-2',
                title: 'Herramientas del Agente',
                description: 'Dota al agente de herramientas como búsqueda web para actuar en el mundo real.',
                icon: 'Wrench',
                nextLessonId: 'l4-1',
                summary: [
                    'Las herramientas (tools) permiten que los agentes interactúen con sistemas externos',
                    'El agente decide cuándo y cómo usar cada herramienta basándose en la tarea',
                    'El patrón Input → Agente → Tool → Output es como operan los agentes en producción',
                ],
                steps: [
                    {
                        id: 's2-2-1',
                        title: 'Pipeline Base',
                        instruction: 'Construye el pipeline base: Input → Agent Orquestador conectados entre sí.',
                        hint: 'Arrastra ambos nodos y conéctalos antes de agregar herramientas.',
                        allowedNodeTypes: ['data', 'agent'],
                        validate: (nodes, edges) => {
                            const input = nodes.find(n => d(n).type === 'data');
                            const agent = nodes.find(n => d(n).type === 'agent');
                            const hasInput = !!input;
                            const hasAgent = !!agent;
                            const connected = hasInput && hasAgent && edges.some(e => e.source === input!.id && e.target === agent!.id);
                            return {
                                success: connected,
                                message: connected ? '¡Pipeline base listo!' : 'Construye el pipeline base.',
                                details: [
                                    { label: 'Input Usuario en canvas', done: hasInput },
                                    { label: 'Agent Orquestador en canvas', done: hasAgent },
                                    { label: 'Input → Agente conectados', done: connected },
                                ],
                            };
                        },
                    },
                    {
                        id: 's2-2-2',
                        title: 'Agrega Web Search',
                        instruction: 'Agrega la herramienta "Web Search" y conéctala al Agente: Agente → Web Search.',
                        hint: '"Web Search" está en Herramientas. El agente invoca la herramienta, por eso la conexión va de Agente → Tool.',
                        allowedNodeTypes: ['data', 'agent', 'tool'],
                        validate: (nodes, edges) => {
                            const agent = nodes.find(n => d(n).type === 'agent');
                            const tool = nodes.find(n => d(n).type === 'tool' && d(n).title.includes('Web'));
                            const hasTool = !!tool;
                            const connected = !!agent && hasTool && edges.some(e => e.source === agent!.id && e.target === tool!.id);
                            return {
                                success: connected,
                                message: connected ? '¡Herramienta de búsqueda conectada!' : 'Agrega y conecta Web Search.',
                                details: [
                                    { label: 'Web Search en canvas', done: hasTool },
                                    { label: 'Agente → Web Search', done: connected },
                                ],
                            };
                        },
                    },
                    {
                        id: 's2-2-3',
                        title: 'Cierra el Flujo',
                        instruction: 'Agrega "Respuesta Final" y conecta Web Search → Respuesta Final para completar el pipeline.',
                        hint: 'La herramienta devuelve resultados al flujo, que terminan en la salida final para el usuario.',
                        allowedNodeTypes: ['data', 'agent', 'tool', 'output'],
                        validate: (nodes, edges) => {
                            const tool = nodes.find(n => d(n).type === 'tool');
                            const output = nodes.find(n => d(n).type === 'output');
                            const hasOutput = !!output;
                            const connected = !!tool && hasOutput && edges.some(e => e.source === tool!.id && e.target === output!.id);
                            return {
                                success: connected,
                                message: connected ? '¡Agente con herramientas completo! Así operan los agentes de Plataforma IA.' : 'Completa el flujo.',
                                details: [
                                    { label: 'Respuesta Final en canvas', done: hasOutput },
                                    { label: 'Web Search → Respuesta Final', done: connected },
                                ],
                            };
                        },
                        suggestedTestPrompts: [
                            '¿Cuáles son las últimas normativas de seguridad minera en Chile?',
                            'Busca información sobre eficiencia energética en plantas concentradoras',
                        ],
                        testObservation: 'El agente usa Web Search para buscar información antes de responder. Así operan los agentes reales de Plataforma IA.',
                    },
                ],
            },
        ],
    },

    /* ══════════════════════════════════════════════════════════════
       COURSE 4: Prompt Engineering (Intermedio)
    ══════════════════════════════════════════════════════════════ */
    {
        id: 'course-4',
        title: 'Prompt Engineering',
        description: 'Domina los patrones que usan los mejores sistemas de IA: Few-Shot, ReAct, Chain of Thought y Persona.',
        level: 'Intermedio',
        icon: 'FileCode2',
        estimatedMinutes: 30,
        badgeColor: 'bg-violet-500 text-white',
        accentClass: 'border-violet-400 bg-violet-50 text-violet-700',
        prerequisiteCourseIds: ['course-1'],
        lessons: [
            {
                id: 'l4-1',
                title: 'Few-Shot Prompting',
                description: 'Enseña al modelo con ejemplos directamente en el prompt para guiar el formato y estilo de respuesta.',
                icon: 'ListOrdered',
                nextLessonId: 'l4-2',
                summary: [
                    'Few-Shot Prompting consiste en incluir 2+ ejemplos en el prompt para guiar el formato de salida',
                    'Es la técnica más rápida para estandarizar respuestas sin re-entrenar el modelo',
                    'En Plataforma IA se usa para clasificación de incidentes, categorización de reportes y formateo de datos',
                ],
                steps: [
                    {
                        id: 's4-1-0',
                        type: 'theory',
                        title: '¿Qué es Few-Shot Prompting?',
                        instruction: 'Entendamos esta técnica fundamental de prompt engineering.',
                        theoryContent: '**Few-Shot Prompting** es una técnica donde incluyes 2 o más ejemplos (input/output) directamente en el prompt para que el modelo aprenda el patrón deseado.\n\n**¿Por qué funciona?** El modelo detecta el formato de los ejemplos y lo replica en nuevas entradas. Es como mostrarle a un trabajador nuevo cómo llenar un formulario dándole 2-3 formularios ya completados.\n\n**Ejemplo en Plataforma IA:**\n- Input: "La producción aumentó un 15%" → Output: POSITIVO\n- Input: "El equipo presentó fallas" → Output: NEGATIVO\n\nCon estos ejemplos, el modelo clasifica automáticamente cualquier texto nuevo usando el mismo formato.',
                        hint: '',
                        allowedNodeTypes: [],
                        validate: theoryValidate,
                    },
                    {
                        id: 's4-1-1',
                        title: 'Prepara el canvas',
                        instruction: 'Arrastra al canvas los nodos "GPT 5 Chat" (de Modelos LLM) y "Respuesta Final" (de Salidas). Son los dos nodos que necesitas para este ejercicio de prompting.',
                        hint: '"GPT 5 Chat" está en la sección Modelos LLM. "Respuesta Final" en Salidas. No necesitas Input Usuario — el mensaje vendrá directo del Chat de prueba.',
                        allowedNodeTypes: ['llm', 'output'],
                        validate: (nodes) => {
                            const hasLLM = nodes.some(n => d(n).type === 'llm');
                            const hasOut = nodes.some(n => d(n).type === 'output');
                            return {
                                success: hasLLM && hasOut,
                                message: hasLLM && hasOut ? '¡Canvas listo! Ahora configura el System Prompt.' : 'Agrega ambos nodos.',
                                details: [
                                    { label: 'GPT 5 Chat en canvas', done: hasLLM },
                                    { label: 'Respuesta Final en canvas', done: hasOut },
                                ],
                            };
                        },
                    },
                    {
                        id: 's4-1-2',
                        title: 'Escribe el prompt Few-Shot',
                        instruction: 'Abre la configuración del nodo LLM (⚙) y escribe en System Prompt el siguiente esquema con al menos 2 "Ejemplo:" para guiar al modelo con casos reales antes de la consulta.',
                        hint: 'Pega esto en el System Prompt:\n\nClasifica el sentimiento como POSITIVO, NEGATIVO o NEUTRO.\n\nEjemplo 1:\nInput: "La producción aumentó un 15%"\nOutput: POSITIVO\n\nEjemplo 2:\nInput: "El equipo presentó fallas"\nOutput: NEGATIVO\n\nAhora clasifica el texto recibido.',
                        allowedNodeTypes: ['llm'],
                        validate: (nodes) => {
                            const llm = nodes.find(n => d(n).type === 'llm' || d(n).type === 'agent');
                            if (!llm) return { success: false, message: 'Necesitas el nodo LLM en el canvas.', details: [{ label: 'Nodo LLM en canvas', done: false }] };
                            const sp = ((d(llm).systemPrompt as string) || '').toLowerCase();
                            const ejemploCount = (sp.match(/ejemplo/g) || []).length;
                            const hasEnough = ejemploCount >= 2;
                            return {
                                success: hasEnough,
                                message: hasEnough ? '¡Few-Shot configurado! El modelo ahora aprende del patrón de tus ejemplos.' : `El prompt tiene ${ejemploCount} "Ejemplo". Few-Shot requiere al menos 2 ejemplos.`,
                                details: [
                                    { label: 'Nodo LLM en canvas', done: true },
                                    { label: `Al menos 2 "Ejemplo" en prompt (actual: ${ejemploCount})`, done: hasEnough },
                                ],
                            };
                        },
                    },
                    {
                        id: 's4-1-3',
                        title: 'Conecta y prueba',
                        instruction: 'Conecta GPT 5 Chat → Respuesta Final. Luego ve al Chat de prueba y escribe algo como: "El nivel de cobre cayó un 8% este trimestre". Observa cómo el modelo clasifica usando tu patrón.',
                        hint: 'Arrastra desde el borde derecho del nodo LLM hasta el borde izquierdo de Respuesta Final. Prueba con distintas oraciones para ver la consistencia del Few-Shot.',
                        allowedNodeTypes: ['llm', 'output'],
                        validate: (nodes, edges) => {
                            const llm = nodes.find(n => d(n).type === 'llm' || d(n).type === 'agent');
                            const out = nodes.find(n => d(n).type === 'output');
                            const connected = !!llm && !!out && edges.some(e => e.source === llm!.id && e.target === out!.id);
                            return {
                                success: connected,
                                message: connected ? '¡Flujo Few-Shot operativo! Los ejemplos guían al modelo sin re-entrenarlo.' : 'Conecta GPT 5 Chat → Respuesta Final.',
                                details: [
                                    { label: 'GPT 5 Chat → Respuesta Final', done: connected },
                                ],
                            };
                        },
                        suggestedTestPrompts: [
                            'El nivel de cobre cayó un 8% este trimestre',
                            'La producción aumentó un 15% respecto al mes anterior',
                            'El equipo de chancado presentó fallas críticas',
                            'Se mantuvieron los niveles operacionales estándar',
                        ],
                        testObservation: 'Observa cómo el modelo clasifica usando exactamente el formato POSITIVO/NEGATIVO/NEUTRO que definiste en los ejemplos. Esa consistencia es el poder del Few-Shot.',
                    },
                ],
            },
            {
                id: 'l4-2',
                title: 'ReAct (Reason + Act)',
                description: 'Haz que el modelo razone explícitamente antes de actuar, siguiendo el ciclo Thought → Action → Observation → Answer.',
                icon: 'Repeat2',
                nextLessonId: 'l4-3',
                summary: [
                    'ReAct combina razonamiento explícito (Thought) con acciones concretas (Action)',
                    'El ciclo Thought → Action → Observation → Answer fuerza transparencia en las decisiones del modelo',
                    'Es el patrón base de los agentes autónomos que usan herramientas en Plataforma IA',
                ],
                steps: [
                    {
                        id: 's4-2-0',
                        type: 'theory',
                        title: '¿Qué es el patrón ReAct?',
                        instruction: 'Entendamos cómo ReAct mejora la calidad de los agentes.',
                        theoryContent: '**ReAct (Reason + Act)** es un patrón donde el modelo expone su razonamiento antes de tomar acciones:\n\n1. **Thought**: "Necesito buscar datos de producción del Q3"\n2. **Action**: Ejecuta búsqueda en base de datos\n3. **Observation**: "Encontré que la producción fue 45,000 ton"\n4. **Answer**: Genera respuesta final con los datos\n\n**¿Por qué importa?** En operaciones mineras, es crítico entender POR QUÉ el modelo toma una decisión. ReAct hace visible el razonamiento, lo que permite auditar y corregir errores antes de que lleguen al usuario.',
                        hint: '',
                        allowedNodeTypes: [],
                        validate: theoryValidate,
                    },
                    {
                        id: 's4-2-1',
                        title: 'Prepara el canvas',
                        instruction: 'Arrastra "GPT 5 Chat" y "Respuesta Final" al canvas. Para ReAct también puedes agregar un nodo de herramienta (ej. Web Search) para simular las "Actions" del agente.',
                        hint: 'El nodo de herramienta es opcional pero ilustrativo: en ReAct el modelo decide qué acción ejecutar. Si lo agregas, conéctalo después.',
                        allowedNodeTypes: ['llm', 'tool', 'output'],
                        validate: (nodes) => {
                            const hasLLM = nodes.some(n => d(n).type === 'llm' || d(n).type === 'agent');
                            const hasOut = nodes.some(n => d(n).type === 'output');
                            return {
                                success: hasLLM && hasOut,
                                message: hasLLM && hasOut ? '¡Listo! Ahora define el prompt ReAct.' : 'Agrega los nodos requeridos.',
                                details: [
                                    { label: 'GPT 5 Chat en canvas', done: hasLLM },
                                    { label: 'Respuesta Final en canvas', done: hasOut },
                                ],
                            };
                        },
                    },
                    {
                        id: 's4-2-2',
                        title: 'Escribe el prompt ReAct',
                        instruction: 'En el System Prompt del nodo LLM define el ciclo ReAct. El prompt debe contener las palabras "Thought", "Action" y "Observation" para estructurar el razonamiento del modelo.',
                        hint: 'Pega esto:\n\nResponde siguiendo el patrón ReAct:\n\nThought: [razona qué necesitas saber]\nAction: [acción que tomarías]\nObservation: [resultado de la acción]\n... (repite si es necesario)\nAnswer: [respuesta final]\n\nSiempre muestra tu razonamiento antes de responder.',
                        allowedNodeTypes: ['llm'],
                        validate: (nodes) => {
                            const llm = nodes.find(n => d(n).type === 'llm' || d(n).type === 'agent');
                            if (!llm) return { success: false, message: 'Necesitas el nodo LLM.', details: [{ label: 'Nodo LLM en canvas', done: false }] };
                            const sp = (d(llm).systemPrompt as string) || '';
                            const hasThought = /thought/i.test(sp);
                            const hasAction = /action/i.test(sp);
                            const hasObs = /observation/i.test(sp);
                            const allDone = hasThought && hasAction && hasObs;
                            return {
                                success: allDone,
                                message: allDone ? '¡Prompt ReAct correcto! El modelo razonará en voz alta antes de actuar.' : 'El prompt necesita los 3 elementos de ReAct.',
                                details: [
                                    { label: '"Thought" en el prompt', done: hasThought },
                                    { label: '"Action" en el prompt', done: hasAction },
                                    { label: '"Observation" en el prompt', done: hasObs },
                                ],
                            };
                        },
                    },
                    {
                        id: 's4-2-3',
                        title: 'Conecta y observa el razonamiento',
                        instruction: 'Conecta LLM → Respuesta Final. Escribe en el chat una pregunta compleja y observa el ciclo Thought/Action/Observation.',
                        hint: 'Con ReAct verás que el modelo expone su razonamiento paso a paso. Compara la calidad de respuesta vs un prompt simple para entender el valor del patrón.',
                        allowedNodeTypes: ['llm', 'tool', 'output'],
                        validate: (nodes, edges) => {
                            const llm = nodes.find(n => d(n).type === 'llm' || d(n).type === 'agent');
                            const out = nodes.find(n => d(n).type === 'output');
                            const connected = !!llm && !!out && edges.some(e => e.source === llm!.id && e.target === out!.id);
                            return {
                                success: connected,
                                message: connected ? '¡Flujo ReAct listo! Observa cómo el modelo piensa antes de responder.' : 'Conecta GPT 5 Chat → Respuesta Final.',
                                details: [
                                    { label: 'GPT 5 Chat → Respuesta Final', done: connected },
                                ],
                            };
                        },
                        suggestedTestPrompts: [
                            '¿Cómo afecta la humedad ambiental a la eficiencia de los chancadores?',
                            '¿Qué medidas tomar si se detecta un aumento de arsénico en el concentrado?',
                        ],
                        testObservation: 'Nota cómo el modelo estructura su respuesta en Thought/Action/Observation antes de dar la respuesta final. Eso es ReAct en acción.',
                    },
                ],
            },
            {
                id: 'l4-3',
                title: 'Chain of Thought',
                description: 'Fuerza al modelo a razonar paso a paso antes de dar su respuesta final, reduciendo errores en problemas complejos.',
                icon: 'GitCommitHorizontal',
                nextLessonId: 'l4-4',
                summary: [
                    'Chain of Thought (CoT) fuerza al modelo a descomponer problemas complejos en pasos',
                    'La frase "paso a paso" activa un razonamiento más estructurado y preciso',
                    'CoT reduce errores en cálculos, problemas lógicos y análisis técnicos de minería',
                ],
                steps: [
                    {
                        id: 's4-3-0',
                        type: 'theory',
                        title: '¿Qué es Chain of Thought?',
                        instruction: 'Entendamos cómo el razonamiento paso a paso mejora la precisión.',
                        theoryContent: '**Chain of Thought (CoT)** es una técnica donde instruyes al modelo a "pensar paso a paso" antes de dar su respuesta final.\n\n**Sin CoT:** "¿Cuánto mineral movemos?" → "45,000 toneladas" (puede estar mal)\n**Con CoT:** "Paso 1: 3 palas × 300 ton = 900 ton por ciclo. Paso 2: 12h × 60min ÷ 8min = 90 ciclos. Paso 3: 900 × 90 = 81,000 ton" → Respuesta verificable\n\n**¿Por qué importa en minería?** Los cálculos de producción, seguridad y costos no admiten errores. CoT fuerza al modelo a mostrar su trabajo, como un ingeniero que documenta cada paso de su análisis.',
                        hint: '',
                        allowedNodeTypes: [],
                        validate: theoryValidate,
                    },
                    {
                        id: 's4-3-1',
                        title: 'Prepara el canvas',
                        instruction: 'Arrastra "GPT 5 Chat" y "Respuesta Final" al canvas. Chain of Thought es una técnica de prompt puro — no necesita herramientas externas.',
                        hint: 'La magia de CoT está completamente en el System Prompt. Con la frase correcta el modelo mejora drásticamente su razonamiento.',
                        allowedNodeTypes: ['llm', 'output'],
                        validate: (nodes) => {
                            const hasLLM = nodes.some(n => d(n).type === 'llm' || d(n).type === 'agent');
                            const hasOut = nodes.some(n => d(n).type === 'output');
                            return {
                                success: hasLLM && hasOut,
                                message: hasLLM && hasOut ? '¡Canvas listo! Ahora escribe el prompt CoT.' : 'Agrega los nodos requeridos.',
                                details: [
                                    { label: 'GPT 5 Chat en canvas', done: hasLLM },
                                    { label: 'Respuesta Final en canvas', done: hasOut },
                                ],
                            };
                        },
                    },
                    {
                        id: 's4-3-2',
                        title: 'Escribe el prompt Chain of Thought',
                        instruction: 'Configura el System Prompt con la instrucción de razonar paso a paso. El prompt debe incluir la frase "paso a paso" o "step by step" para activar el comportamiento CoT.',
                        hint: 'Pega esto:\n\nEres un experto en operaciones mineras de Plataforma IA.\n\nAntes de responder cualquier consulta técnica:\n1. Identifica los conceptos clave del problema\n2. Razona paso a paso cada factor relevante\n3. Aplica el conocimiento técnico apropiado\n4. Verifica tu razonamiento antes de concluir\n5. Da la respuesta final con su justificación\n\nPiensa paso a paso siempre.',
                        allowedNodeTypes: ['llm'],
                        validate: (nodes) => {
                            const llm = nodes.find(n => d(n).type === 'llm' || d(n).type === 'agent');
                            if (!llm) return { success: false, message: 'Necesitas el nodo LLM.', details: [{ label: 'Nodo LLM en canvas', done: false }] };
                            const sp = ((d(llm).systemPrompt as string) || '').toLowerCase();
                            const hasCoT = sp.includes('paso a paso') || sp.includes('step by step') || sp.includes('step-by-step');
                            return {
                                success: hasCoT,
                                message: hasCoT ? '¡Prompt CoT activado! El modelo desglosará su razonamiento antes de responder.' : 'Incluye "paso a paso" o "step by step" en el prompt para activar CoT.',
                                details: [
                                    { label: 'Nodo LLM en canvas', done: true },
                                    { label: '"paso a paso" o "step by step" en prompt', done: hasCoT },
                                ],
                            };
                        },
                    },
                    {
                        id: 's4-3-3',
                        title: 'Conecta y desafía al modelo',
                        instruction: 'Conecta LLM → Respuesta Final. Prueba con un problema técnico y observa el razonamiento paso a paso.',
                        hint: 'CoT brilla en preguntas que requieren múltiples pasos de cálculo o lógica. Sin CoT el modelo podría dar la respuesta incorrecta directamente; con CoT se auto-corrige.',
                        allowedNodeTypes: ['llm', 'output'],
                        validate: (nodes, edges) => {
                            const llm = nodes.find(n => d(n).type === 'llm' || d(n).type === 'agent');
                            const out = nodes.find(n => d(n).type === 'output');
                            const connected = !!llm && !!out && edges.some(e => e.source === llm!.id && e.target === out!.id);
                            return {
                                success: connected,
                                message: connected ? '¡Flujo CoT completo! Compara la respuesta con y sin el prompt para ver la diferencia.' : 'Conecta GPT 5 Chat → Respuesta Final.',
                                details: [
                                    { label: 'GPT 5 Chat → Respuesta Final', done: connected },
                                ],
                            };
                        },
                        suggestedTestPrompts: [
                            'Si tenemos 3 palas cargando camiones de 300 ton cada 8 minutos, ¿cuánto mineral movemos en un turno de 12 horas?',
                            '¿Cuál es el costo por tonelada si el total operativo es $2.5M y la producción mensual es 35,000 ton?',
                        ],
                        testObservation: 'Nota cómo el modelo descompone el problema en pasos numerados. Cada paso es verificable — eso es el valor de Chain of Thought.',
                    },
                ],
            },
            {
                id: 'l4-4',
                title: 'Persona & Role',
                description: 'Asigna una identidad específica al modelo para obtener respuestas con el tono, expertise y perspectiva exactos que necesitas.',
                icon: 'UserCircle2',
                nextLessonId: 'l3-1',
                summary: [
                    'El patrón Persona define quién es el modelo: rol, expertise, tono y restricciones',
                    'Una persona bien definida produce respuestas consistentes y predecibles',
                    'Es el patrón más usado en producción — cada agente de Plataforma IA tiene una persona definida',
                ],
                steps: [
                    {
                        id: 's4-4-0',
                        type: 'theory',
                        title: '¿Qué es el patrón Persona?',
                        instruction: 'Entendamos cómo darle identidad al modelo.',
                        theoryContent: '**Persona & Role** es la técnica de asignarle una identidad específica al modelo mediante el System Prompt. Una buena persona define:\n\n- **Quién es**: "Sebastián, ingeniero de procesos con 15 años en Plataforma IA"\n- **Su expertise**: "Especialista en conminución y chancado"\n- **Su tono**: "Técnico pero accesible, siempre priorizando seguridad"\n- **Sus restricciones**: "No da consejos médicos, refiere a prevención de riesgos"\n\n**¿Por qué importa?** Cada uno de los 24 agentes de Plataforma IA tiene una persona cuidadosamente definida. Eso garantiza que el agente de RRHH no responda como el de legal, y viceversa.',
                        hint: '',
                        allowedNodeTypes: [],
                        validate: theoryValidate,
                    },
                    {
                        id: 's4-4-1',
                        title: 'Prepara el canvas',
                        instruction: 'Arrastra "GPT 5 Chat" y "Respuesta Final" al canvas. El patrón Persona es el más usado en producción — define quién es el modelo antes de que procese cualquier consulta.',
                        hint: 'Una buena persona incluye: nombre/rol, años de experiencia, área de especialización, tono de comunicación y restricciones.',
                        allowedNodeTypes: ['llm', 'output'],
                        validate: (nodes) => {
                            const hasLLM = nodes.some(n => d(n).type === 'llm' || d(n).type === 'agent');
                            const hasOut = nodes.some(n => d(n).type === 'output');
                            return {
                                success: hasLLM && hasOut,
                                message: hasLLM && hasOut ? '¡Canvas listo! Ahora dale una identidad al modelo.' : 'Agrega los nodos requeridos.',
                                details: [
                                    { label: 'GPT 5 Chat en canvas', done: hasLLM },
                                    { label: 'Respuesta Final en canvas', done: hasOut },
                                ],
                            };
                        },
                    },
                    {
                        id: 's4-4-2',
                        title: 'Define la Persona',
                        instruction: 'Abre la configuración del LLM y escribe un System Prompt que defina claramente quién es el modelo. Debe comenzar con "Eres" y describir un rol específico con al menos 80 caracteres.',
                        hint: 'Pega esto:\n\nEres Sebastián, ingeniero de procesos con 15 años en División Plataforma IA Norte.\n\nTu forma de comunicarte:\n- Preciso técnicamente, accesible en el lenguaje\n- Citas normativas de seguridad cuando corresponde\n- Das ejemplos concretos de la operación minera\n- Priorizas siempre la seguridad operacional\n- Terminas con una recomendación accionable\n\nResponde como Sebastián respondería a un colega en terreno.',
                        allowedNodeTypes: ['llm'],
                        validate: (nodes) => {
                            const llm = nodes.find(n => d(n).type === 'llm' || d(n).type === 'agent');
                            if (!llm) return { success: false, message: 'Necesitas el nodo LLM.', details: [{ label: 'Nodo LLM en canvas', done: false }] };
                            const sp = (d(llm).systemPrompt as string) || '';
                            const hasLength = sp.length >= 80;
                            const hasEres = /^eres\s/i.test(sp.trim());
                            const allDone = hasLength && hasEres;
                            return {
                                success: allDone,
                                message: allDone ? '¡Persona definida! El modelo adoptará este rol en cada respuesta.' : 'El prompt necesita mejoras.',
                                details: [
                                    { label: 'Nodo LLM en canvas', done: true },
                                    { label: `Comienza con "Eres [rol]..."`, done: hasEres },
                                    { label: `Al menos 80 caracteres (actual: ${sp.length})`, done: hasLength },
                                ],
                            };
                        },
                    },
                    {
                        id: 's4-4-3',
                        title: 'Conecta y comprueba el rol',
                        instruction: 'Conecta LLM → Respuesta Final. Prueba con una consulta técnica y observa cómo el modelo responde desde el rol que definiste.',
                        hint: 'Prueba la misma pregunta en dos conversaciones: una con el prompt Persona y otra sin él. La diferencia en tono, precisión y estructura será evidente.',
                        allowedNodeTypes: ['llm', 'output'],
                        validate: (nodes, edges) => {
                            const llm = nodes.find(n => d(n).type === 'llm' || d(n).type === 'agent');
                            const out = nodes.find(n => d(n).type === 'output');
                            const connected = !!llm && !!out && edges.some(e => e.source === llm!.id && e.target === out!.id);
                            return {
                                success: connected,
                                message: connected ? '¡Flujo con Persona completo! Ahora el modelo tiene identidad, expertise y estilo definidos.' : 'Conecta GPT 5 Chat → Respuesta Final.',
                                details: [
                                    { label: 'GPT 5 Chat → Respuesta Final', done: connected },
                                ],
                            };
                        },
                        suggestedTestPrompts: [
                            '¿Cómo debo actuar si detecto una fuga en la línea de pulpa?',
                            '¿Cuáles son los riesgos principales del polvo en suspensión en chancado?',
                        ],
                        testObservation: 'Nota cómo el modelo responde con el tono y expertise de la persona que definiste. Compara con una respuesta sin persona para ver la diferencia.',
                    },
                ],
            },
        ],
    },

    /* ══════════════════════════════════════════════════════════════
       COURSE 3: RAG para Minería (Avanzado)
    ══════════════════════════════════════════════════════════════ */
    {
        id: 'course-3',
        title: 'RAG para Minería',
        description: 'Implementa Retrieval-Augmented Generation para consultas inteligentes sobre datos de Plataforma IA.',
        level: 'Avanzado',
        icon: 'DatabaseZap',
        estimatedMinutes: 45,
        badgeColor: 'bg-violet-600 text-white',
        accentClass: 'border-violet-400 bg-violet-50 text-violet-700',
        prerequisiteCourseIds: ['course-1', 'course-4'],
        lessons: [
            {
                id: 'l3-1',
                title: 'Pipeline RAG Completo',
                description: 'Construye un sistema que combina base de conocimiento, LLM y recuperación para respuestas precisas.',
                icon: 'Layers',
                summary: [
                    'RAG combina búsqueda en bases de datos con generación de texto por IA',
                    'El LLM recibe 2 entradas: la pregunta del usuario y el contexto recuperado de la base de conocimiento',
                    'Este patrón evita "alucinaciones" anclando las respuestas en datos reales de Plataforma IA',
                ],
                steps: [
                    {
                        id: 's3-1-0',
                        type: 'theory',
                        title: '¿Qué es RAG?',
                        instruction: 'Entendamos la técnica más avanzada del curso.',
                        theoryContent: '**RAG (Retrieval-Augmented Generation)** combina dos capacidades:\n1. **Retrieval**: Busca información relevante en una base de datos o documentos\n2. **Generation**: Un LLM genera una respuesta usando esa información como contexto\n\n**¿Por qué RAG en Plataforma IA?** Los modelos de IA no conocen los datos internos de la compañía (producción, normativas, procedimientos). RAG le permite al modelo consultar esos datos en tiempo real y generar respuestas precisas y actualizadas.\n\n**Ejemplo**: Un trabajador pregunta "¿Cuál fue la producción de cobre en El Teniente en Q3?" → RAG busca en la base de datos interna → El LLM genera una respuesta con los datos reales.',
                        hint: '',
                        allowedNodeTypes: [],
                        validate: theoryValidate,
                    },
                    {
                        id: 's3-1-1',
                        title: 'Fuentes de Datos',
                        instruction: 'Agrega dos nodos de datos: "Input Usuario" (la pregunta del minero) y "Base Conocimiento" (los datos de Plataforma IA).',
                        hint: 'Ambos están en la sección "Datos". En RAG, el LLM usa ambas fuentes para generar respuestas contextualizadas con información real.',
                        allowedNodeTypes: ['data'],
                        validate: (nodes) => {
                            const dataNodes = nodes.filter(n => d(n).type === 'data');
                            const hasInput = dataNodes.some(n => d(n).title.includes('Input'));
                            const hasKB = dataNodes.some(n => d(n).title.includes('Base') || d(n).title.includes('Conocimiento'));
                            return {
                                success: hasInput && hasKB,
                                message: hasInput && hasKB ? '¡Ambas fuentes de datos agregadas!' : 'Agrega ambos nodos de datos.',
                                details: [
                                    { label: 'Input Usuario en canvas', done: hasInput },
                                    { label: 'Base Conocimiento en canvas', done: hasKB },
                                ],
                            };
                        },
                    },
                    {
                        id: 's3-1-2',
                        title: 'Motor LLM',
                        instruction: 'Agrega un modelo LLM. En RAG, el LLM sintetiza la pregunta del usuario con el contexto recuperado de la base de datos.',
                        hint: 'Usa "GPT 5 Chat" — el modelo gpt-5.2-chat implementado en Plataforma IA. Tiene excelente capacidad de síntesis y comprensión de contexto largo.',
                        allowedNodeTypes: ['data', 'llm'],
                        validate: (nodes) => {
                            const hasLLM = nodes.some(n => d(n).type === 'llm');
                            return {
                                success: hasLLM,
                                message: hasLLM ? '¡LLM listo para sintetizar!' : 'Agrega un modelo LLM.',
                                details: [
                                    { label: 'GPT 5 Chat en canvas', done: hasLLM },
                                ],
                            };
                        },
                    },
                    {
                        id: 's3-1-3',
                        title: 'Conecta el Pipeline RAG',
                        instruction: 'Conecta: Base Conocimiento → LLM, Input Usuario → LLM, y LLM → Respuesta Final. El LLM recibe DOS entradas.',
                        hint: 'El LLM recibe tanto la pregunta como el contexto. Necesitas DOS flechas llegando al LLM desde los dos nodos de datos.',
                        allowedNodeTypes: ['data', 'llm', 'output'],
                        validate: (nodes, edges) => {
                            const llm = nodes.find(n => d(n).type === 'llm');
                            const output = nodes.find(n => d(n).type === 'output');
                            const hasLLM = !!llm;
                            const hasOutput = !!output;
                            const llmInputs = hasLLM ? edges.filter(e => e.target === llm!.id).length : 0;
                            const has2Inputs = llmInputs >= 2;
                            const llmToOut = hasLLM && hasOutput && edges.some(e => e.source === llm!.id && e.target === output!.id);
                            return {
                                success: has2Inputs && llmToOut,
                                message: has2Inputs && llmToOut ? '¡Pipeline RAG completo! Esta es la base de los sistemas IA avanzados de Plataforma IA.' : 'Completa las conexiones.',
                                details: [
                                    { label: 'Respuesta Final en canvas', done: hasOutput },
                                    { label: `2 entradas al LLM (actual: ${llmInputs})`, done: has2Inputs },
                                    { label: 'LLM → Respuesta Final', done: !!llmToOut },
                                ],
                            };
                        },
                        suggestedTestPrompts: [
                            '¿Cuáles son los procedimientos de emergencia ante un derrumbe?',
                            '¿Qué normativas aplican para el manejo de relaves en División Radomiro Tomic?',
                        ],
                        testObservation: 'En un RAG real, la Base de Conocimiento buscaría documentos internos de Plataforma IA. Aquí se simula con contexto genérico, pero la arquitectura es idéntica.',
                    },
                ],
            },
        ],
    },
];
