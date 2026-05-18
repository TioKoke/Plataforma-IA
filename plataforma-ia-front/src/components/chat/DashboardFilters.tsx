import type { DashboardFilterSpec } from './dashboard/types';

interface DashboardFiltersProps {
  filters: DashboardFilterSpec[];
  values: Record<string, string | string[]>;
  onChange: (filterId: string, value: string | string[]) => void;
}

export function DashboardFilters({ filters, values, onChange }: DashboardFiltersProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200 rounded-t-xl">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filtros</span>
      {filters.map(filter => {
        const selected = values[filter.id] ?? filter.default;

        if (filter.type === 'radio' && filter.options.length <= 6) {
          return (
            <div key={filter.id} className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 mr-1">{filter.label}:</span>
              {filter.options.map(opt => {
                const isActive = Array.isArray(selected) ? selected.includes(opt.id) : selected === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onChange(filter.id, opt.id)}
                    className={[
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150',
                      isActive
                        ? 'bg-plataforma-azul text-white border-plataforma-azul shadow-sm'
                        : 'border-slate-300 text-slate-600 hover:border-plataforma-azul hover:text-plataforma-azul',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          );
        }

        // Dropdown for 'dropdown' or when too many options
        return (
          <div key={filter.id} className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">{filter.label}:</span>
            <select
              value={Array.isArray(selected) ? selected[0] ?? '' : selected}
              onChange={e => onChange(filter.id, e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-plataforma-azul"
            >
              {filter.options.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
