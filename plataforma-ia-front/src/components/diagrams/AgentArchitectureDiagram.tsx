import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
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

// Diagrama de arquitectura de un agente
const initialNodes: Node<AgentNodeData>[] = [
  {
    id: 'user',
    type: 'agentNode',
    position: { x: 250, y: 0 },
    data: {
      title: 'Usuario',
      description: 'Interacción humana',
      icon: '👤',
      category: 'start',
    },
  },
  {
    id: 'interface',
    type: 'agentNode',
    position: { x: 250, y: 120 },
    data: {
      title: 'Interfaz',
      description: 'Chat / API / WebSocket',
      icon: '💬',
      category: 'process',
    },
  },
  {
    id: 'agent',
    type: 'agentNode',
    position: { x: 250, y: 240 },
    data: {
      title: 'Agente IA',
      description: 'Orquestador central con LLM',
      icon: '🤖',
      category: 'decision',
    },
  },
  {
    id: 'tools',
    type: 'agentNode',
    position: { x: 50, y: 380 },
    data: {
      title: 'Herramientas',
      description: 'Excel, PDF, APIs',
      icon: '🔧',
      category: 'process',
    },
  },
  {
    id: 'memory',
    type: 'agentNode',
    position: { x: 250, y: 380 },
    data: {
      title: 'Memoria',
      description: 'Historial y contexto',
      icon: '💾',
      category: 'process',
    },
  },
  {
    id: 'knowledge',
    type: 'agentNode',
    position: { x: 450, y: 380 },
    data: {
      title: 'Base de Conocimiento',
      description: 'RAG / Vectores / Docs',
      icon: '📚',
      category: 'process',
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'user', target: 'interface', animated: true },
  { id: 'e2', source: 'interface', target: 'agent', animated: true },
  { id: 'e3', source: 'agent', target: 'tools', animated: false },
  { id: 'e4', source: 'agent', target: 'memory', animated: false },
  { id: 'e5', source: 'agent', target: 'knowledge', animated: false },
  { id: 'e6', source: 'tools', target: 'agent', animated: true, type: 'smoothstep' },
  { id: 'e7', source: 'memory', target: 'agent', animated: true, type: 'smoothstep' },
  { id: 'e8', source: 'knowledge', target: 'agent', animated: true, type: 'smoothstep' },
  { id: 'e9', source: 'agent', target: 'interface', animated: true, type: 'smoothstep' },
];

const AgentArchitectureDiagram = () => {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  return (
    <div className="w-full h-[600px] bg-white rounded-lg shadow-sm border border-gray-200">
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
        <Background variant={BackgroundVariant.Lines} gap={20} size={1} color="#e5e7eb" />
        <Controls className="bg-white shadow-sm rounded-lg border border-gray-200" />
      </ReactFlow>
    </div>
  );
};

export default AgentArchitectureDiagram;
