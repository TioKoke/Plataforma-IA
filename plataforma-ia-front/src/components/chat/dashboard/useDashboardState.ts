import { useState, useMemo, useCallback } from 'react';
import type { DashboardSpec, DashboardState, CrossFilterState, PanelSpec } from './types';

export function useDashboardState(spec: DashboardSpec) {
  // Initialize filter defaults
  const [filterValues, setFilterValues] = useState<Record<string, string | string[]>>(() => {
    const defaults: Record<string, string | string[]> = {};
    spec.filters?.forEach(f => { defaults[f.id] = f.default; });
    return defaults;
  });

  const [crossFilter, setCrossFilter] = useState<CrossFilterState | null>(null);

  const handleFilterChange = useCallback((filterId: string, value: string | string[]) => {
    setFilterValues(prev => ({ ...prev, [filterId]: value }));
  }, []);

  const handleCrossFilter = useCallback((sourcePanelId: string, filterKey: string, filterValue: unknown) => {
    setCrossFilter(prev => {
      // Toggle off if clicking same value
      if (prev && prev.sourcePanelId === sourcePanelId && prev.filterValue === filterValue) {
        return null;
      }
      return { sourcePanelId, filterKey, filterValue };
    });
  }, []);

  const clearCrossFilter = useCallback(() => setCrossFilter(null), []);

  // Compute filtered data for each panel
  const filteredPanels = useMemo(() => {
    return spec.panels.map(panel => {
      if (panel.type === 'kpi' || !panel.data) return panel;

      let data = panel.data;

      // Apply shared filters
      if (spec.filters) {
        for (const filter of spec.filters) {
          // Skip if panel is excluded from this filter
          if (panel.exclude_filters?.includes(filter.id)) continue;
          // Skip if filter only applies to specific panels and this one isn't in the list
          if (filter.applies_to && !filter.applies_to.includes(panel.id)) continue;

          const selected = filterValues[filter.id] ?? filter.default;
          if (selected === 'all') continue;

          if (Array.isArray(selected)) {
            // Multi-select
            if (selected.length > 0 && !selected.includes('all')) {
              data = data.filter(row => selected.includes(String(row[filter.key_to_filter])));
            }
          } else {
            data = data.filter(row => String(row[filter.key_to_filter]) === selected);
          }
        }
      }

      // Apply cross-filter (but not to the source panel itself)
      if (crossFilter && crossFilter.sourcePanelId !== panel.id) {
        data = data.filter(row => row[crossFilter.filterKey] === crossFilter.filterValue);
      }

      return { ...panel, data } as PanelSpec;
    });
  }, [spec.panels, spec.filters, filterValues, crossFilter]);

  const state: DashboardState = { filterValues, crossFilter };

  return {
    state,
    filteredPanels,
    handleFilterChange,
    handleCrossFilter,
    clearCrossFilter,
  };
}
