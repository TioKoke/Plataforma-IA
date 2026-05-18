// ─── Infographic Types ───────────────────────────────────────────────────────

export type InfographicType = 'flowchart' | 'orgchart' | 'timeline';
export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';
export type NodeCategory = 'start' | 'process' | 'decision' | 'end' | 'info' | 'warning';

export interface InfographicNodeSpec {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  category?: NodeCategory;
  color?: string;
}

export interface InfographicEdgeSpec {
  id: string;
  source: string;
  target: string;
  label?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface InfographicSpec {
  id: string;
  type: InfographicType;
  title: string;
  description?: string;
  direction?: LayoutDirection;
  nodes: InfographicNodeSpec[];
  edges: InfographicEdgeSpec[];
}
