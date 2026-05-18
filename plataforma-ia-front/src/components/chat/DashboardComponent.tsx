import { X } from 'lucide-react';
import type { DashboardSpec } from './dashboard/types';
import { useDashboardState } from './dashboard/useDashboardState';
import { DashboardFilters } from './DashboardFilters';
import { DashboardPanel } from './DashboardPanel';
import { ExpandableChartWrapper } from './ChartActions';

// ─── Dashboard Component ─────────────────────────────────────────────────────

interface DashboardComponentProps {
  spec: DashboardSpec;
  onInteract: (message: string) => void;
}

function DashboardComponent({ spec, onInteract }: DashboardComponentProps) {
  const {
    state,
    filteredPanels,
    handleFilterChange,
    handleCrossFilter,
    clearCrossFilter,
  } = useDashboardState(spec);

  return (
    <div className="flex flex-col">
      {/* Title */}
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-base font-bold text-slate-800">{spec.title}</h3>
        {spec.description && (
          <p className="text-xs text-slate-500 mt-0.5">{spec.description}</p>
        )}
      </div>

      {/* Shared Filters */}
      {spec.filters && spec.filters.length > 0 && (
        <DashboardFilters
          filters={spec.filters}
          values={state.filterValues}
          onChange={handleFilterChange}
        />
      )}

      {/* Cross-filter indicator */}
      {state.crossFilter && (
        <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-1.5 bg-plataforma-azul/10 border border-plataforma-azul/20 rounded-lg text-xs text-plataforma-azul">
          <span>Filtro cruzado activo: <strong>{String(state.crossFilter.filterValue)}</strong></span>
          <button onClick={clearCrossFilter} className="ml-auto hover:text-red-500 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Panels Grid */}
      <div
        className="grid gap-3 p-4"
        style={{ gridTemplateColumns: `repeat(${spec.layout.columns}, minmax(0, 1fr))` }}
      >
        {filteredPanels.map(panel => (
          <DashboardPanel
            key={panel.id}
            panel={panel}
            isHighlighted={state.crossFilter?.sourcePanelId === panel.id}
            onInteract={onInteract}
            onCrossFilter={handleCrossFilter}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard Block (exported wrapper) ──────────────────────────────────────

interface DashboardBlockProps {
  spec: DashboardSpec;
  onInteract: (message: string) => void;
}

export function DashboardBlock({ spec, onInteract }: DashboardBlockProps) {
  return (
    <ExpandableChartWrapper
      title={spec.title}
      description={spec.description}
      filename={`dashboard_${spec.id}`}
      className="my-4"
      actionsClassName="right-3 top-3"
      expandedContent={
        // En el modal, el grid del dashboard tiene más ancho disponible —
        // cada panel queda menos apretado y los charts internos tienen
        // espacio para que los labels rotados respiren.
        <div className="overflow-auto h-full">
          <DashboardComponent spec={spec} onInteract={onInteract} />
        </div>
      }
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <DashboardComponent spec={spec} onInteract={onInteract} />
      </div>
    </ExpandableChartWrapper>
  );
}
