import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { resolveIcon } from '../kpi/KPIIconResolver';
import type { ComparisonOption } from './types';

const BRAND_COLORS: Record<string, string> = {
  naranja: '#E55302',
  amarillo: '#F4AA00',
  turquesa: '#0098AA',
  rojo: '#C13832',
  'verde-oscuro': '#106470',
  azul: '#0072B1',
  'gris-oscuro': '#36424A',
};

const FALLBACK_ACCENTS = ['#0098AA', '#E55302', '#0072B1'];

function resolveColor(name?: string, index?: number): string {
  if (name && BRAND_COLORS[name]) return BRAND_COLORS[name];
  if (name) return name;
  return FALLBACK_ACCENTS[(index ?? 0) % FALLBACK_ACCENTS.length];
}

export function ComparisonWidget({ options }: { options: ComparisonOption[] }) {
  const colCount = Math.min(options.length, 3);
  const gridClass =
    colCount === 1
      ? 'grid-cols-1'
      : colCount === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={`grid ${gridClass} gap-4 p-4`}>
      {options.map((opt, i) => {
        const accent = resolveColor(opt.color, i);
        const Icon = opt.icon ? resolveIcon(opt.icon) : null;

        return (
          <motion.div
            key={i}
            className="relative rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 overflow-hidden transition-all"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35 }}
            style={opt.badge ? { borderColor: accent + '4d' } : undefined}
          >
            {/* Accent bar */}
            <div className="h-1.5" style={{ backgroundColor: accent }} />

            {/* Badge */}
            {opt.badge && (
              <div
                className="absolute top-3 right-0 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white rounded-l-full shadow"
                style={{ backgroundColor: accent }}
              >
                {opt.badge}
              </div>
            )}

            <div className="p-5">
              {/* Header */}
              <div className="flex items-center gap-2.5 mb-2">
                {Icon && (
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: `${accent}1a` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: accent }} strokeWidth={2.2} />
                  </div>
                )}
                <h4 className="text-base font-bold text-slate-800">{opt.title}</h4>
              </div>

              {/* Description */}
              {opt.description && (
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">{opt.description}</p>
              )}

              {/* Features list */}
              <ul className="space-y-2">
                {opt.features.map((feat, fi) => (
                  <li key={fi} className="flex items-start gap-2 text-sm">
                    {typeof feat.value === 'boolean' ? (
                      feat.value ? (
                        <Check className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" strokeWidth={2.5} />
                      ) : (
                        <X className="w-4 h-4 mt-0.5 text-slate-300 shrink-0" strokeWidth={2.5} />
                      )
                    ) : (
                      <span
                        className="w-1.5 h-1.5 mt-2 rounded-full shrink-0"
                        style={{ backgroundColor: accent }}
                      />
                    )}
                    <span className="text-slate-700">
                      <span className="font-semibold text-slate-800">{feat.label}:</span>{' '}
                      {typeof feat.value === 'boolean'
                        ? feat.value
                          ? 'Sí'
                          : 'No'
                        : feat.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
