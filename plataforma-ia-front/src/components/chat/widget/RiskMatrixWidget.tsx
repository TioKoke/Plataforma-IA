import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RiskItem } from './types';

/** Returns a color on the green-yellow-red gradient based on risk score (1-25). */
function riskColor(score: number): string {
  if (score <= 3) return '#22c55e';   // green
  if (score <= 6) return '#84cc16';   // lime
  if (score <= 9) return '#F4AA00';   // Plataforma IA amarillo
  if (score <= 12) return '#E55302';  // Plataforma IA naranja
  if (score <= 16) return '#C13832';  // Plataforma IA rojo
  return '#7A2531';                   // Plataforma IA rojo-oscuro
}

const Y_VALUES = [5, 4, 3, 2, 1] as const;
const X_VALUES = [1, 2, 3, 4, 5] as const;
const CELL_W = 60;
const CELL_H = 44;
const Y_LABEL_W = 28;

export function RiskMatrixWidget({ risks }: { risks: RiskItem[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Group risks by cell (likelihood × impact)
  const cellMap = new Map<string, RiskItem[]>();
  risks.forEach((r) => {
    const key = `${r.likelihood}-${r.impact}`;
    const list = cellMap.get(key) ?? [];
    list.push(r);
    cellMap.set(key, list);
  });

  return (
    <div className="flex flex-col items-center gap-3 p-2">
      {/* Matriz: Y axis label + grid */}
      <div className="flex items-stretch gap-2">
        {/* Y axis title (rotated) */}
        <div className="flex items-center justify-center" style={{ width: 18 }}>
          <span
            className="text-[11px] font-semibold tracking-wide text-slate-700"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Impacto
          </span>
        </div>

        {/* Grid: rows of (Y label + 5 cells) */}
        <div className="flex flex-col gap-1">
          {Y_VALUES.map((impact) => (
            <div key={impact} className="flex items-center gap-1">
              <span
                className="text-[11px] font-semibold text-slate-600 text-right"
                style={{ width: Y_LABEL_W }}
              >
                {impact}
              </span>
              {X_VALUES.map((likelihood) => {
                const key = `${likelihood}-${impact}`;
                const cellRisks = cellMap.get(key) ?? [];
                const bg = riskColor(likelihood * impact);

                return (
                  <div
                    key={key}
                    className="relative rounded-md flex flex-wrap items-center justify-center gap-1 p-1"
                    style={{
                      width: CELL_W,
                      height: CELL_H,
                      backgroundColor: bg,
                      opacity: cellRisks.length > 0 ? 1 : 0.45,
                    }}
                  >
                    {cellRisks.map((r, i) => (
                      <motion.span
                        key={r.label + i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.06, type: 'spring', stiffness: 320, damping: 22 }}
                        className="relative inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white cursor-pointer ring-1 ring-white/60"
                        style={{
                          backgroundColor: r.color ?? '#36424A',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                        }}
                        onMouseEnter={() => setHovered(r.label)}
                        onMouseLeave={() => setHovered(null)}
                        title={r.label}
                      >
                        {r.label.charAt(0).toUpperCase()}

                        <AnimatePresence>
                          {hovered === r.label && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-max max-w-[12rem] px-2.5 py-1.5 rounded-md text-[11px] font-normal text-left text-white bg-slate-800 shadow-lg pointer-events-none"
                            >
                              <div className="font-semibold">{r.label}</div>
                              {r.description && <div className="mt-0.5 opacity-85">{r.description}</div>}
                              <div className="mt-1 text-[10px] opacity-90">
                                Probabilidad {r.likelihood} × Impacto {r.impact} = <span className="font-semibold">{r.likelihood * r.impact}</span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.span>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}

          {/* X axis numbers — alineados por dentro debajo de cada celda */}
          <div className="flex items-center gap-1 mt-1" style={{ paddingLeft: Y_LABEL_W + 4 }}>
            {X_VALUES.map((x) => (
              <span
                key={x}
                className="text-[11px] font-semibold text-slate-600 text-center"
                style={{ width: CELL_W }}
              >
                {x}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* X axis title — centrado bajo la grilla */}
      <span className="text-[11px] font-semibold tracking-wide text-slate-700" style={{ paddingLeft: Y_LABEL_W }}>
        Probabilidad
      </span>

      {/* Leyenda + lista de riesgos referenciados */}
      <div className="flex flex-col gap-2 w-full mt-1 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <span className="text-[11px] font-medium text-slate-600">Nivel:</span>
          {[
            { label: 'Bajo', color: '#22c55e' },
            { label: 'Medio', color: '#F4AA00' },
            { label: 'Alto', color: '#E55302' },
            { label: 'Crítico', color: '#7A2531' },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} />
              <span className="text-[11px] text-slate-700">{l.label}</span>
            </div>
          ))}
        </div>

        {/* Lista de riesgos por inicial — clave para identificar cada burbuja */}
        {risks.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-slate-700 mt-1 max-w-md mx-auto">
            {risks.map((r, i) => (
              <li key={r.label + i} className="flex items-center gap-1.5 truncate">
                <span
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white shrink-0"
                  style={{ backgroundColor: r.color ?? '#36424A' }}
                >
                  {r.label.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{r.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
