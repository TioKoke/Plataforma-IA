import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import type { InfographicSpec } from './infographic/types';
import { computeLayout } from './infographic/layoutEngine';
import { InfographicNode } from './infographic/InfographicNode';
import { TimelineNode } from './infographic/TimelineNode';
import { ExpandableChartWrapper } from './ChartActions';

// ─── Node types registry ─────────────────────────────────────────────────────

const nodeTypes = {
  infographic: InfographicNode,
  timeline: TimelineNode,
};

// ─── Type label mapping ──────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  flowchart: 'Diagrama de Flujo',
  orgchart: 'Organigrama',
  timeline: 'Línea de Tiempo',
};

const TYPE_ICONS: Record<string, string> = {
  flowchart: '🔀',
  orgchart: '🏛️',
  timeline: '📅',
};

// ─── Component ───────────────────────────────────────────────────────────────

function InfographicComponent({ spec, fillParent }: { spec: InfographicSpec; fillParent?: boolean }) {
  const { nodes, edges } = useMemo(() => computeLayout(spec), [spec]);

  const showMiniMap = spec.nodes.length > 8;
  // En modal expand (`fillParent`), el container toma toda la altura disponible
  // mediante `flex-1` — no se fija un alto numérico; sino el padre flex resuelve.
  const containerHeight = spec.nodes.length < 6 ? 380 : 520;

  return (
    <motion.div
      className={fillParent ? 'h-full max-w-full flex flex-col' : 'my-4 max-w-full'}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' as const }}
    >
      {/* Header */}
      {(spec.title || spec.description) && (
        <div className={fillParent ? 'mb-3 shrink-0' : 'mb-3'}>
          <div className="flex items-center gap-2">
            {spec.title && (
              <h3 className="text-base font-bold text-slate-800">{spec.title}</h3>
            )}
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-full flex items-center gap-1">
              <span>{TYPE_ICONS[spec.type] ?? ''}</span>
              {TYPE_LABELS[spec.type] ?? spec.type}
            </span>
          </div>
          {spec.description && (
            <p className="text-xs text-slate-500 mt-1">{spec.description}</p>
          )}
        </div>
      )}

      {/* React Flow Canvas */}
      <div
        className={
          fillParent
            ? 'rounded-xl border border-slate-200 overflow-hidden bg-gradient-to-br from-white to-slate-50 shadow-sm flex-1 min-h-0'
            : 'rounded-xl border border-slate-200 overflow-hidden bg-gradient-to-br from-white to-slate-50 shadow-sm'
        }
        style={fillParent ? undefined : { height: containerHeight }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll
          panOnScroll={false}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.2}
            color="#e2e8f0"
          />
          <Controls
            showInteractive={false}
            position="bottom-right"
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: 2,
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          />
          {showMiniMap && (
            <MiniMap
              nodeColor="#94a3b8"
              maskColor="rgba(255, 255, 255, 0.7)"
              position="bottom-left"
              pannable
              zoomable={false}
              style={{ width: 120, height: 80, borderRadius: 10, border: '1px solid #e2e8f0' }}
            />
          )}
        </ReactFlow>
      </div>
    </motion.div>
  );
}

// ─── Block wrapper ───────────────────────────────────────────────────────────

interface InfographicBlockProps {
  spec: InfographicSpec;
  onInteract?: (message: string) => void;
}

export function InfographicBlock({ spec, onInteract: _onInteract }: InfographicBlockProps) {
  return (
    <ExpandableChartWrapper
      title={spec.title || (TYPE_LABELS[spec.type] ?? 'Diagrama')}
      description={spec.description}
      filename={`infographic_${spec.id}`}
      expandedContent={<InfographicComponent spec={spec} fillParent />}
    >
      <InfographicComponent spec={spec} />
    </ExpandableChartWrapper>
  );
}
