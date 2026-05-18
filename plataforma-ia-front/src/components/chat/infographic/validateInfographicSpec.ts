import type {
  InfographicSpec, InfographicType, LayoutDirection,
  InfographicNodeSpec, InfographicEdgeSpec, NodeCategory,
} from './types';

const VALID_TYPES = new Set<InfographicType>(['flowchart', 'orgchart', 'timeline']);
const VALID_DIRECTIONS = new Set<LayoutDirection>(['TB', 'LR', 'BT', 'RL']);
const VALID_CATEGORIES = new Set<NodeCategory>(['start', 'process', 'decision', 'end', 'info', 'warning']);
const VALID_EDGE_STYLES = new Set(['solid', 'dashed', 'dotted']);

const DEFAULT_DIRECTIONS: Record<InfographicType, LayoutDirection> = {
  flowchart: 'TB',
  orgchart: 'TB',
  timeline: 'LR',
};

const CATEGORY_COLORS: Record<NodeCategory, string> = {
  start: 'turquesa',
  process: 'azul',
  decision: 'amarillo',
  end: 'verde-oscuro',
  info: 'turquesa',
  warning: 'naranja',
};

function normalizeNode(raw: Record<string, unknown>, index: number): InfographicNodeSpec | null {
  const id = (typeof raw.id === 'string' && raw.id) ? raw.id : `n${index + 1}`;
  const label = typeof raw.label === 'string' ? raw.label : '';
  if (!label) return null;

  const node: InfographicNodeSpec = { id, label };

  if (typeof raw.description === 'string') node.description = raw.description;
  if (typeof raw.icon === 'string') node.icon = raw.icon;

  if (VALID_CATEGORIES.has(raw.category as NodeCategory)) {
    node.category = raw.category as NodeCategory;
  } else {
    node.category = 'process';
  }

  if (typeof raw.color === 'string') {
    node.color = raw.color;
  } else {
    node.color = CATEGORY_COLORS[node.category] ?? 'azul';
  }

  return node;
}

function normalizeEdge(raw: Record<string, unknown>, index: number, nodeIds: Set<string>): InfographicEdgeSpec | null {
  const source = typeof raw.source === 'string' ? raw.source : '';
  const target = typeof raw.target === 'string' ? raw.target : '';
  if (!source || !target) return null;
  if (!nodeIds.has(source) || !nodeIds.has(target)) return null;

  const id = (typeof raw.id === 'string' && raw.id) ? raw.id : `e${index + 1}`;
  const edge: InfographicEdgeSpec = { id, source, target };

  if (typeof raw.label === 'string') edge.label = raw.label;
  edge.style = VALID_EDGE_STYLES.has(raw.style as string) ? (raw.style as 'solid' | 'dashed' | 'dotted') : 'solid';

  return edge;
}

export function validateInfographicSpec(raw: unknown): InfographicSpec | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.nodes) || obj.nodes.length === 0) return null;

  const id = (typeof obj.id === 'string' && obj.id) ? obj.id : `info_${Date.now()}`;
  const title = typeof obj.title === 'string' ? obj.title : '';

  let type: InfographicType = 'flowchart';
  if (VALID_TYPES.has(obj.type as InfographicType)) {
    type = obj.type as InfographicType;
  }

  let direction: LayoutDirection = DEFAULT_DIRECTIONS[type];
  if (VALID_DIRECTIONS.has(obj.direction as LayoutDirection)) {
    direction = obj.direction as LayoutDirection;
  }

  const description = typeof obj.description === 'string' ? obj.description : undefined;

  // Normalize nodes
  const nodes: InfographicNodeSpec[] = [];
  for (let i = 0; i < (obj.nodes as unknown[]).length; i++) {
    const rawNode = (obj.nodes as unknown[])[i];
    if (rawNode && typeof rawNode === 'object') {
      const node = normalizeNode(rawNode as Record<string, unknown>, i);
      if (node) nodes.push(node);
    }
  }
  if (nodes.length === 0) return null;

  // Normalize edges
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges: InfographicEdgeSpec[] = [];
  if (Array.isArray(obj.edges)) {
    for (let i = 0; i < (obj.edges as unknown[]).length; i++) {
      const rawEdge = (obj.edges as unknown[])[i];
      if (rawEdge && typeof rawEdge === 'object') {
        const edge = normalizeEdge(rawEdge as Record<string, unknown>, i, nodeIds);
        if (edge) edges.push(edge);
      }
    }
  }

  return { id, type, title, description, direction, nodes, edges };
}
