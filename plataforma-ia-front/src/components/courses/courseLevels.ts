import type { Node, Edge } from '@xyflow/react';
import type { BaseNodeData } from './types';

export interface CourseLevel {
    id: string;
    title: string;
    description: string;
    progress: number;
    validate: (nodes: Node<BaseNodeData>[], edges: Edge[]) => { success: boolean; message: string };
}

export const courseLevels: CourseLevel[] = [
    {
        id: '1',
        title: 'Lección 1: Hola Mundo de la IA',
        description: 'Conecta un Input Usuario a una Respuesta Final.',
        progress: 20,
        validate: (nodes, edges) => {
            const hasInput = nodes.some(n => n.data.type === 'data' && n.data.title.includes('Input'));
            const hasOutput = nodes.some(n => n.data.type === 'output');
            const hasConnection = edges.some(e => {
                const source = nodes.find(n => n.id === e.source);
                const target = nodes.find(n => n.id === e.target);
                return source?.data.type === 'data' && target?.data.type === 'output';
            });

            if (!hasInput || !hasOutput) return { success: false, message: 'Falta un nodo de Input o Output' };
            if (!hasConnection) return { success: false, message: 'Debes conectar el Input con el Output' };

            return { success: true, message: '¡Excelente! Has creado tu primer flujo básico.' };
        }
    },
    {
        id: '3',
        title: 'Lección 3: Conectando Herramientas',
        description: 'Arma un flujo donde un Agente Orquestador use Web Search y un LLM para procesar un Input.',
        progress: 60,
        validate: (nodes, _edges) => {
            const hasAgent = nodes.some(n => n.data.type === 'agent');
            const hasWebSearch = nodes.some(n => n.data.title.includes('Web Search'));
            if (!hasAgent) return { success: false, message: 'Falta un Agente Orquestador.' };
            if (!hasWebSearch) return { success: false, message: 'Debes agregar la herramienta Web Search.' };
            return { success: true, message: '¡Agente configurado con éxito!' };
        }
    }
];
