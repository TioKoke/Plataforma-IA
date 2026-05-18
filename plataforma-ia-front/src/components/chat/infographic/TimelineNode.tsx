import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeCategory } from './types';
import { resolveIcon } from '../kpi/KPIIconResolver';

const BRAND_COLOR_MAP: Record<string, string> = {
  naranja: '#E55302',
  amarillo: '#F4AA00',
  turquesa: '#0098AA',
  rojo: '#C13832',
  'verde-oscuro': '#106470',
  azul: '#0072B1',
};

function resolveColor(color?: string): string {
  if (!color) return '#0072B1';
  return BRAND_COLOR_MAP[color] ?? (color.startsWith('#') ? color : '#0072B1');
}

function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${Math.round(r + (255 - r) * amount).toString(16).padStart(2, '0')}${Math.round(g + (255 - g) * amount).toString(16).padStart(2, '0')}${Math.round(b + (255 - b) * amount).toString(16).padStart(2, '0')}`;
}

interface TimelineNodeData {
  label: string;
  description?: string;
  icon?: string;
  category?: NodeCategory;
  color?: string;
  index?: number;
  [key: string]: unknown;
}

function TimelineNodeInner({ data }: { data: TimelineNodeData }) {
  const color = resolveColor(data.color);
  const Icon = resolveIcon(data.icon);

  // Handles invisibles para que dagre/ReactFlow conecte sin mostrar puntos
  // (las edges entre nodos del timeline ya cuentan la historia visual).
  const handleStyle = {
    background: 'transparent',
    width: 1,
    height: 1,
    border: 'none',
    opacity: 0,
  };

  return (
    <div
      className="relative px-4 py-3 rounded-xl border shadow-sm hover:shadow-md transition-shadow min-w-[180px] max-w-[260px]"
      style={{
        borderColor: lighten(color, 0.55),
        backgroundColor: lighten(color, 0.96),
        borderLeftWidth: 4,
        borderLeftColor: color,
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />

      <div className="flex items-start gap-2.5">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
          style={{ backgroundColor: lighten(color, 0.82) }}
        >
          <Icon size={16} style={{ color }} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-slate-800 leading-snug">{data.label}</p>
          {data.description && (
            <p className="text-[11px] text-slate-500 leading-snug mt-1">{data.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export const TimelineNode = memo(TimelineNodeInner);
