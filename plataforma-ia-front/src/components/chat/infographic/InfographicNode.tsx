import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeCategory } from './types';
import { resolveIcon } from '../kpi/KPIIconResolver';

// ─── Color mapping ───────────────────────────────────────────────────────────

const BRAND_COLOR_MAP: Record<string, string> = {
  naranja: '#E55302',
  amarillo: '#F4AA00',
  turquesa: '#0098AA',
  rojo: '#C13832',
  'rojo-oscuro': '#7A2531',
  'gris-oscuro': '#36424A',
  beige: '#C4C1A0',
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
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

// ─── Node data type ──────────────────────────────────────────────────────────

interface InfographicNodeData {
  label: string;
  description?: string;
  icon?: string;
  category?: NodeCategory;
  color?: string;
  infographicType?: string;
  [key: string]: unknown;
}

// ─── Handle base style ───────────────────────────────────────────────────────

const HANDLE_BASE = {
  width: 8,
  height: 8,
  border: '2px solid white',
  opacity: 0,
};

// ─── Decision node (diamond shape via clip-path) ─────────────────────────────

function DecisionNode({ data, color }: { data: InfographicNodeData; color: string }) {
  const Icon = resolveIcon(data.icon);
  const bg = lighten(color, 0.88);
  const borderClr = color;

  return (
    <div className="relative" style={{ width: '100%', height: '100%' }}>
      {/* Handles on the diamond tips */}
      <Handle type="target" position={Position.Top} style={{ ...HANDLE_BASE, background: color, top: 0, left: '50%' }} />
      <Handle type="source" position={Position.Bottom} style={{ ...HANDLE_BASE, background: color, bottom: 0, left: '50%' }} />
      <Handle type="target" position={Position.Left} style={{ ...HANDLE_BASE, background: color, left: 0, top: '50%' }} />
      <Handle type="source" position={Position.Right} style={{ ...HANDLE_BASE, background: color, right: 0, top: '50%' }} />

      {/* Diamond background with clip-path */}
      <div
        className="absolute inset-[3px]"
        style={{
          clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          backgroundColor: bg,
        }}
      />
      {/* Diamond border via slightly larger clip-path underneath */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          backgroundColor: borderClr,
          zIndex: -1,
        }}
      />

      {/* Content centered */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-4 py-2 text-center">
        <div
          className="flex items-center justify-center w-6 h-6 rounded-full mb-1"
          style={{ backgroundColor: lighten(color, 0.75) }}
        >
          <Icon size={13} style={{ color }} />
        </div>
        <p className="text-[11px] font-bold text-slate-800 leading-tight">{data.label}</p>
      </div>
    </div>
  );
}

// ─── Standard node (process, info, warning) ──────────────────────────────────

function StandardNode({ data, color, category }: { data: InfographicNodeData; color: string; category?: NodeCategory }) {
  const Icon = resolveIcon(data.icon);

  const isStart = category === 'start';
  const isEnd = category === 'end';
  const borderRadius = (isStart || isEnd) ? '9999px' : '14px';
  const borderWidth = isEnd ? '3px' : '2px';

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 shadow-sm hover:shadow-md transition-shadow cursor-default"
      style={{
        width: '100%',
        height: '100%',
        borderRadius,
        borderWidth,
        borderStyle: 'solid',
        borderColor: color,
        backgroundColor: lighten(color, 0.93),
      }}
    >
      <Handle type="target" position={Position.Top} style={{ ...HANDLE_BASE, background: color }} />
      <Handle type="target" position={Position.Left} style={{ ...HANDLE_BASE, background: color }} />
      <Handle type="source" position={Position.Bottom} style={{ ...HANDLE_BASE, background: color }} />
      <Handle type="source" position={Position.Right} style={{ ...HANDLE_BASE, background: color }} />

      <div
        className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg"
        style={{ backgroundColor: lighten(color, 0.82) }}
      >
        <Icon size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-slate-800 leading-snug">{data.label}</p>
        {data.description && (
          <p className="text-[10px] text-slate-500 leading-snug mt-0.5">{data.description}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

function InfographicNodeInner({ data }: { data: InfographicNodeData }) {
  const color = resolveColor(data.color);

  if (data.category === 'decision') {
    return <DecisionNode data={data} color={color} />;
  }

  return <StandardNode data={data} color={color} category={data.category} />;
}

export const InfographicNode = memo(InfographicNodeInner);
