import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
} from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './reactflow-custom.css';

import AgentNode from './AgentNode';
import type { AgentNodeData } from './AgentNode';

const nodeTypes = {
  agentNode: AgentNode,
};

// Definir nodos iniciales para el flujo de creación de agentes
const initialNodes: Node<AgentNodeData>[] = [
  {
    id: '1',
    type: 'agentNode',
    position: { x: 250, y: 0 },
    data: {
      title: 'Inicio',
      description: 'Identificar necesidad del negocio',
      icon: '🎯',
      category: 'start',
    },
  },
  {
    id: '2',
    type: 'agentNode',
    position: { x: 250, y: 150 },
    data: {
      title: 'Definir Objetivo',
      description: 'Especificar qué tarea debe realizar el agente',
      icon: '📋',
      category: 'process',
    },
  },
  {
    id: '3',
    type: 'agentNode',
    position: { x: 250, y: 300 },
    data: {
      title: 'Seleccionar Modelo',
      description: 'Elegir LLM apropiado (Claude, GPT, etc.)',
      icon: '🤖',
      category: 'process',
    },
  },
  {
    id: '4',
    type: 'agentNode',
    position: { x: 50, y: 450 },
    data: {
      title: 'Definir Herramientas',
      description: 'Configurar Tool Calling (Excel, APIs, DB)',
      icon: '🔧',
      category: 'process',
    },
  },
  {
    id: '5',
    type: 'agentNode',
    position: { x: 450, y: 450 },
    data: {
      title: 'System Prompt',
      description: 'Crear instrucciones y contexto del agente',
      icon: '✍️',
      category: 'process',
    },
  },
  {
    id: '6',
    type: 'agentNode',
    position: { x: 250, y: 600 },
    data: {
      title: 'Pruebas',
      description: 'Validar respuestas y comportamiento',
      icon: '🧪',
      category: 'decision',
    },
  },
  {
    id: '7',
    type: 'agentNode',
    position: { x: 50, y: 750 },
    data: {
      title: 'Ajustar',
      description: 'Refinar prompts y configuración',
      icon: '⚙️',
      category: 'process',
    },
  },
  {
    id: '8',
    type: 'agentNode',
    position: { x: 450, y: 750 },
    data: {
      title: 'Desplegar',
      description: 'Publicar agente en producción',
      icon: '🚀',
      category: 'end',
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3', animated: true },
  { id: 'e3-4', source: '3', target: '4', animated: true },
  { id: 'e3-5', source: '3', target: '5', animated: true },
  { id: 'e4-6', source: '4', target: '6', animated: true },
  { id: 'e5-6', source: '5', target: '6', animated: true },
  { id: 'e6-7', source: '6', target: '7', label: '❌ Falla', animated: true },
  { id: 'e6-8', source: '6', target: '8', label: '✅ OK', animated: true },
  { id: 'e7-3', source: '7', target: '3', label: 'Iterar', animated: true, type: 'smoothstep' },
];

const AgentFlowDiagram = () => {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  return (
    <div className="w-full h-[800px] bg-white rounded-lg shadow-sm border border-gray-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-50"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d1d5db" />
        <Controls className="bg-white shadow-sm rounded-lg border border-gray-200" />
        <MiniMap
          className="bg-white border border-gray-200 rounded-lg shadow-sm"
          nodeColor={(node) => {
            switch (node.data.category) {
              case 'start':
                return '#36424A';
              case 'process':
                return '#0098AA';
              case 'decision':
                return '#F4AA00';
              case 'end':
                return '#D52B1E';
              default:
                return '#6b7280';
            }
          }}
        />
      </ReactFlow>
    </div>
  );
};

export default AgentFlowDiagram;
