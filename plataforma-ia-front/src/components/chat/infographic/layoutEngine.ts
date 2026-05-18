import dagre from '@dagrejs/dagre';
import { MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import type { InfographicSpec, InfographicNodeSpec } from './types';

// ─── Plataforma IA edge palette ────────────────────────────────────────────────────

const EDGE_COLOR = '#94a3b8';
const EDGE_COLOR_LIGHT = '#cbd5e1';

// ─── Node dimension estimation ───────────────────────────────────────────────

function estimateNodeSize(node: InfographicNodeSpec, type: string): { width: number; height: number } {
  const labelLen = node.label.length;
  const descLen = node.description?.length ?? 0;
  const hasDesc = !!node.description;

  if (type === 'timeline') {
    const w = Math.max(160, Math.min(240, Math.max(labelLen, descLen) * 8 + 60));
    return { width: w, height: hasDesc ? 90 : 64 };
  }

  if (node.category === 'decision') {
    // Diamond needs more space — square aspect, sized to label
    const side = Math.max(110, Math.min(160, labelLen * 7 + 50));
    return { width: side, height: side };
  }

  // Standard nodes — wider to avoid truncation
  const textWidth = Math.max(labelLen, descLen * 0.85) * 7.5 + 60;
  const w = Math.max(180, Math.min(320, textWidth));
  const h = hasDesc ? 68 : 50;

  return { width: w, height: h };
}

// ─── Build edge props ────────────────────────────────────────────────────────

function buildEdge(
  edge: InfographicSpec['edges'][number],
  specType: string,
): Edge {
  const isDashed = edge.style === 'dashed';
  const isDotted = edge.style === 'dotted';

  const strokeColor = (isDashed || isDotted) ? EDGE_COLOR_LIGHT : EDGE_COLOR;
  const strokeWidth = 2;
  void specType;

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'smoothstep',
    animated: isDashed,
    style: {
      stroke: strokeColor,
      strokeWidth,
      strokeDasharray: isDashed ? '8 4' : isDotted ? '3 3' : undefined,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: strokeColor,
    },
    labelStyle: {
      fontSize: 11,
      fontWeight: 600,
      fill: '#475569',
      fontFamily: 'system-ui, sans-serif',
    },
    labelBgStyle: {
      fill: '#ffffff',
      fillOpacity: 0.95,
      stroke: '#e2e8f0',
      strokeWidth: 1,
      rx: 6,
      ry: 6,
    },
    labelBgPadding: [8, 4] as [number, number],
    labelBgBorderRadius: 6,
  };
}

// ─── Dagre layout ────────────────────────────────────────────────────────────

function dagreLayout(spec: InfographicSpec): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  const rankdir = spec.direction ?? 'TB';

  // More generous spacing
  const spacingConfig: Record<string, { nodesep: number; ranksep: number }> = {
    orgchart: { nodesep: 30, ranksep: 90 },
    flowchart: { nodesep: 50, ranksep: 90 },
  };
  const { nodesep, ranksep } = spacingConfig[spec.type] ?? { nodesep: 45, ranksep: 85 };

  g.setGraph({ rankdir, nodesep, ranksep, marginx: 30, marginy: 30 });

  for (const node of spec.nodes) {
    const { width, height } = estimateNodeSize(node, spec.type);
    g.setNode(node.id, { width, height });
  }

  for (const edge of spec.edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const rfNodes: Node[] = spec.nodes.map((node) => {
    const dagNode = g.node(node.id);
    const { width, height } = estimateNodeSize(node, spec.type);
    return {
      id: node.id,
      type: 'infographic',
      position: { x: dagNode.x - width / 2, y: dagNode.y - height / 2 },
      data: { ...node, infographicType: spec.type },
      style: { width, height },
    };
  });

  const rfEdges: Edge[] = spec.edges.map((edge) => buildEdge(edge, spec.type));

  return { nodes: rfNodes, edges: rfEdges };
}

// ─── Timeline layout ─────────────────────────────────────────────────────────

function timelineLayout(spec: InfographicSpec): { nodes: Node[]; edges: Edge[] } {
  const isHorizontal = spec.direction === 'LR' || spec.direction === 'RL';
  const spacing = isHorizontal ? 240 : 160;

  const rfNodes: Node[] = spec.nodes.map((node, i) => {
    const { width, height } = estimateNodeSize(node, 'timeline');
    const position = isHorizontal
      ? { x: i * spacing, y: (i % 2 === 0 ? 0 : 110) }
      : { x: (i % 2 === 0 ? 0 : 220), y: i * spacing * 0.65 };

    return {
      id: node.id,
      type: 'timeline',
      position,
      data: { ...node, index: i, total: spec.nodes.length, infographicType: 'timeline' },
      style: { width, height },
    };
  });

  const rfEdges: Edge[] = spec.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'smoothstep',
    style: { stroke: '#94a3b8', strokeWidth: 2.5, strokeDasharray: '8 4' },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color: '#94a3b8',
    },
    labelStyle: { fontSize: 10, fontWeight: 600, fill: '#64748b' },
    labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95 },
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 4,
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function computeLayout(spec: InfographicSpec): { nodes: Node[]; edges: Edge[] } {
  if (spec.type === 'timeline') {
    return timelineLayout(spec);
  }
  return dagreLayout(spec);
}
