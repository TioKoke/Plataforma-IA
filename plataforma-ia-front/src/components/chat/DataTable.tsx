import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { TableColumnSpec } from './dashboard/types';

interface DataTableProps {
  data: Record<string, unknown>[];
  columns: TableColumnSpec[];
}

const PAGE_SIZE = 8;

function formatCell(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'number') return value.toLocaleString('es-CL');
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T|\s|$)/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return String(value);
}

export function DataTable({ data, columns }: DataTableProps) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const sa = String(va), sb = String(vb);
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-x-auto flex-1">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide cursor-pointer hover:text-plataforma-azul select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-xs text-slate-400 italic">
                  Sin datos
                </td>
              </tr>
            ) : (
              pageData.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                      {formatCell(row[col.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 text-xs text-slate-500">
          <span>{sorted.length} filas</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-0.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100"
            >
              Ant
            </button>
            <span>{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-0.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100"
            >
              Sig
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
