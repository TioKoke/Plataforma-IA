import { motion } from 'framer-motion';
import type { WidgetSpec, ChecklistItem, RankingItem } from './widget/types';
import { ComparisonWidget } from './widget/ComparisonWidget';
import { ChecklistWidget } from './widget/ChecklistWidget';
import { RankingWidget } from './widget/RankingWidget';
import { SwotWidget } from './widget/SwotWidget';
import { RiskMatrixWidget } from './widget/RiskMatrixWidget';
import { ExpandableChartWrapper } from './ChartActions';

// ─── Type label + icon mapping ───────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: string }> = {
  comparison: { label: 'Comparación', icon: '⚖️' },
  checklist: { label: 'Checklist', icon: '✅' },
  ranking: { label: 'Ranking', icon: '🏆' },
  swot: { label: 'Análisis SWOT', icon: '🎯' },
  risk_matrix: { label: 'Matriz de Riesgo', icon: '⚠️' },
};

// ─── Dispatcher ──────────────────────────────────────────────────────────────

function WidgetContent({ spec }: { spec: WidgetSpec }) {
  switch (spec.type) {
    case 'comparison':
      return spec.options ? <ComparisonWidget options={spec.options} /> : null;
    case 'checklist':
      return spec.items ? <ChecklistWidget items={spec.items as ChecklistItem[]} /> : null;
    case 'ranking':
      return spec.items ? <RankingWidget items={spec.items as RankingItem[]} /> : null;
    case 'swot':
      return spec.swot ? <SwotWidget swot={spec.swot} /> : null;
    case 'risk_matrix':
      return spec.risks ? <RiskMatrixWidget risks={spec.risks} /> : null;
    default:
      return null;
  }
}

// ─── Main component ──────────────────────────────────────────────────────────

function WidgetComponent({ spec }: { spec: WidgetSpec }) {
  const meta = TYPE_META[spec.type] ?? { label: spec.type, icon: '📦' };

  return (
    <motion.div
      className="my-4 max-w-full"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' as const }}
    >
      {/* Header */}
      {(spec.title || spec.description) && (
        <div className="mb-3">
          <div className="flex items-center gap-2">
            {spec.title && (
              <h3 className="text-base font-bold text-slate-800">{spec.title}</h3>
            )}
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-full flex items-center gap-1">
              <span>{meta.icon}</span>
              {meta.label}
            </span>
          </div>
          {spec.description && (
            <p className="text-xs text-slate-500 mt-1">{spec.description}</p>
          )}
        </div>
      )}

      {/* Content */}
      <WidgetContent spec={spec} />
    </motion.div>
  );
}

// ─── Block wrapper ───────────────────────────────────────────────────────────

interface WidgetBlockProps {
  spec: WidgetSpec;
  onInteract?: (message: string) => void;
}

export function WidgetBlock({ spec, onInteract: _onInteract }: WidgetBlockProps) {
  return (
    <ExpandableChartWrapper
      title={spec.title || (TYPE_META[spec.type]?.label ?? 'Widget')}
      description={spec.description}
      filename={`widget_${spec.id}`}
      expandedContent={<WidgetComponent spec={spec} />}
    >
      <WidgetComponent spec={spec} />
    </ExpandableChartWrapper>
  );
}
