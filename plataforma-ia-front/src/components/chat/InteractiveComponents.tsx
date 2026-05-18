import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface UIOption {
  id: string;
  label: string;
  custom?: boolean;
}

export interface UIComponentSpec {
  type: 'quick_reply' | 'select' | 'confirm';
  id: string;
  label: string;
  options?: UIOption[];
  detail?: string;
  confirm_label?: string;
  cancel_label?: string;
  multi_select?: boolean;
}

interface BaseProps {
  spec: UIComponentSpec;
  isInteracted: boolean;
  onInteract: (label: string, type: UIComponentSpec['type']) => void;
  autoFocus?: boolean;
  onCancel?: () => void;
}

// ─── NumberedList (shared por quick_reply y select) ───────────────────────────

interface NumberedListProps {
  specId: string;
  options: UIOption[];
  isInteracted: boolean;
  multiSelect?: boolean;
  label?: string;
  onChoose: (label: string) => void;
  autoFocus?: boolean;
  onCancel?: () => void;
}

function NumberedList({
  specId,
  options,
  isInteracted,
  multiSelect = false,
  label,
  onChoose,
  autoFocus = true,
  onCancel,
}: NumberedListProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [customText, setCustomText] = useState('');
  const [customOtroText, setCustomOtroText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const customOtroRef = useRef<HTMLInputElement>(null);
  const listboxId = `uic-${specId}`;

  useEffect(() => {
    if (isInteracted || !autoFocus) return;
    containerRef.current?.focus({ preventScroll: true });
  }, [isInteracted, autoFocus]);

  const chooseSingle = (option: UIOption) => {
    if (isInteracted) return;
    onChoose(option.label);
  };

  const toggleMulti = (idx: number) => {
    if (isInteracted) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
        if (options[idx]?.custom) setCustomOtroText('');
      } else {
        next.add(idx);
        if (options[idx]?.custom) {
          setTimeout(() => customOtroRef.current?.focus(), 0);
        }
      }
      return next;
    });
  };

  const buildMultiLabels = (): string[] => {
    const result: string[] = [];
    for (const i of Array.from(selected).sort((a, b) => a - b)) {
      const opt = options[i];
      if (!opt) continue;
      if (opt.custom) {
        const txt = customOtroText.trim();
        if (txt) result.push(`Otro: ${txt}`);
      } else {
        result.push(opt.label);
      }
    }
    return result;
  };

  const canSubmitMulti = buildMultiLabels().length > 0;

  const submitMulti = () => {
    if (isInteracted) return;
    const labels = buildMultiLabels();
    if (labels.length === 0) return;
    onChoose(labels.join(', '));
  };

  const submitCustom = () => {
    if (isInteracted || !customText.trim()) return;
    onChoose(customText.trim());
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isInteracted) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
      return;
    }

    if (e.target === inputRef.current) return;

    if (e.key >= '1' && e.key <= '9') {
      const idx = parseInt(e.key, 10) - 1;
      if (idx < options.length) {
        e.preventDefault();
        if (multiSelect) { setActiveIdx(idx); toggleMulti(idx); }
        else { setActiveIdx(idx); chooseSingle(options[idx]); }
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === ' ' && multiSelect) {
      e.preventDefault();
      if (activeIdx < options.length) toggleMulti(activeIdx);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (multiSelect) submitMulti();
      else if (activeIdx < options.length) chooseSingle(options[activeIdx]);
    }
  };

  const activeDescendant = options[activeIdx]
    ? `${listboxId}-${options[activeIdx].id}`
    : undefined;

  // ── Layout vertical unificado estilo Claude Code ─────────────────────────
  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="listbox"
      id={listboxId}
      aria-multiselectable={multiSelect || undefined}
      aria-activedescendant={activeDescendant}
      onKeyDown={handleKeyDown}
      className="rounded-xl border border-slate-200 bg-white overflow-hidden focus:outline-none focus:ring-2 focus:ring-plataforma-turquesa/40"
    >
      {/* Pregunta / label prominente */}
      {label && (
        <p className="px-4 pt-3 pb-2 text-sm font-medium text-slate-700 border-b border-slate-100">
          {label}
        </p>
      )}

      {/* Lista de opciones vertical */}
      <div className="max-h-60 overflow-y-auto">
        {options.map((option, idx) => {
          const isActive = idx === activeIdx;
          const isSelected = multiSelect && selected.has(idx);
          const isCustomRow = multiSelect && !!option.custom;
          const showInlineInput = isCustomRow && isSelected && !isInteracted;
          const rowClass = [
            'w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors',
            isInteracted
              ? 'text-slate-400 cursor-not-allowed'
              : isActive
              ? 'bg-plataforma-turquesa text-white cursor-pointer'
              : 'text-slate-700 hover:bg-slate-50 cursor-pointer',
          ].join(' ');
          const numberNode = (
            <span
              className={[
                'inline-flex items-center justify-center w-5 h-5 rounded text-xs font-mono font-bold flex-shrink-0 transition-colors',
                isInteracted
                  ? 'bg-slate-100 text-slate-400'
                  : isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-500',
              ].join(' ')}
            >
              {idx + 1}
            </span>
          );
          const checkboxNode = multiSelect && (
            <span
              className={[
                'inline-flex items-center justify-center w-4 h-4 rounded border text-[10px] transition-colors flex-shrink-0',
                isSelected
                  ? 'bg-plataforma-turquesa border-plataforma-turquesa text-white'
                  : isActive
                  ? 'border-white/50 bg-transparent text-transparent'
                  : 'border-slate-300 bg-white text-transparent',
              ].join(' ')}
            >
              ✓
            </span>
          );

          if (isCustomRow) {
            return (
              <div
                key={option.id}
                id={`${listboxId}-${option.id}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIdx(idx)}
                className={rowClass}
              >
                <button
                  type="button"
                  onClick={() => { setActiveIdx(idx); toggleMulti(idx); }}
                  disabled={isInteracted}
                  aria-label={isSelected ? 'Desmarcar opción otro' : 'Marcar opción otro'}
                  className="flex items-center gap-3 flex-shrink-0 bg-transparent border-none p-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  {numberNode}
                  {checkboxNode}
                </button>
                {showInlineInput ? (
                  <input
                    ref={customOtroRef}
                    type="text"
                    value={customOtroText}
                    onChange={(e) => setCustomOtroText(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Escape') { onCancel?.(); return; }
                      if (e.key === 'Enter' && customOtroText.trim()) {
                        e.preventDefault();
                        submitMulti();
                      }
                    }}
                    placeholder="Escribe aquí..."
                    className={[
                      'flex-1 bg-transparent border-none outline-none text-sm placeholder-slate-400',
                      isActive ? 'text-white placeholder-white/70' : 'text-slate-700',
                    ].join(' ')}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { setActiveIdx(idx); toggleMulti(idx); }}
                    disabled={isInteracted}
                    className="flex-1 text-left bg-transparent border-none p-0 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {option.label}
                  </button>
                )}
              </div>
            );
          }

          return (
            <button
              key={option.id}
              id={`${listboxId}-${option.id}`}
              role="option"
              aria-selected={multiSelect ? isSelected : isActive}
              onClick={() => {
                setActiveIdx(idx);
                if (multiSelect) toggleMulti(idx);
                else chooseSingle(option);
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              disabled={isInteracted}
              className={rowClass}
            >
              {numberNode}
              {checkboxNode}
              <span className="flex-1">{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* Botón submit (solo multi-select con items seleccionados) */}
      {multiSelect && !isInteracted && selected.size > 0 && (
        <button
          onClick={submitMulti}
          disabled={!canSubmitMulti}
          className={[
            'w-full py-2 text-xs font-medium text-white transition-colors border-t',
            canSubmitMulti
              ? 'bg-plataforma-turquesa hover:bg-plataforma-turquesa/90 border-plataforma-turquesa/20 cursor-pointer'
              : 'bg-slate-300 border-slate-200 cursor-not-allowed',
          ].join(' ')}
        >
          Enviar selección ({buildMultiLabels().length})
        </button>
      )}

      {/* Input de texto custom (solo en single-select) */}
      {!isInteracted && !multiSelect && (
        <div className="border-t border-slate-100 px-4 py-2">
          <input
            ref={inputRef}
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') { onCancel?.(); return; }
              if (e.key === 'Enter' && customText.trim()) { e.preventDefault(); submitCustom(); }
            }}
            placeholder="Escribe tu respuesta..."
            className="w-full text-xs bg-transparent border-none outline-none placeholder-slate-400 text-slate-700"
          />
        </div>
      )}

      {/* Hint Esc para salir */}
      {!isInteracted && (
        <p className="text-xs text-slate-400 text-center pb-2">
          <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">Esc</kbd>{' '}
          para salir
        </p>
      )}
    </div>
  );
}

// ─── ConfirmComponent ─────────────────────────────────────────────────────────

function ConfirmComponent({ spec, isInteracted, onInteract }: BaseProps) {
  const [chosen, setChosen] = useState<'confirm' | 'cancel' | null>(null);
  const confirmLabel = spec.confirm_label ?? 'Sí, continuar';
  const cancelLabel = spec.cancel_label ?? 'No, cancelar';

  const handleClick = (type: 'confirm' | 'cancel') => {
    if (isInteracted) return;
    setChosen(type);
    onInteract(type === 'confirm' ? confirmLabel : cancelLabel, 'confirm');
  };

  return (
    <div className="flex flex-col gap-2">
      {spec.detail && <p className="text-xs text-slate-500">{spec.detail}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => handleClick('confirm')}
          disabled={isInteracted}
          className={[
            'px-4 py-2 rounded-full text-sm font-medium transition-all duration-150',
            isInteracted
              ? chosen === 'confirm'
                ? 'bg-plataforma-naranja text-white cursor-default'
                : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
              : 'bg-plataforma-gris-oscuro text-white hover:opacity-90 cursor-pointer',
          ].join(' ')}
        >
          {confirmLabel}
        </button>
        <button
          onClick={() => handleClick('cancel')}
          disabled={isInteracted}
          className={[
            'px-4 py-2 rounded-full text-sm font-medium border transition-all duration-150',
            isInteracted
              ? chosen === 'cancel'
                ? 'border-plataforma-naranja text-plataforma-naranja cursor-default'
                : 'border-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
              : 'border-slate-300 text-slate-600 hover:border-slate-400 cursor-pointer',
          ].join(' ')}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

const ALLOWED_TYPES = new Set(['quick_reply', 'select', 'confirm']);

export function validateSpec(raw: unknown): UIComponentSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!ALLOWED_TYPES.has(obj.type as string)) return null;
  if (typeof obj.id !== 'string' || !obj.id) return null;
  if (typeof obj.label !== 'string') return null;
  if ((obj.type === 'quick_reply' || obj.type === 'select') && !Array.isArray(obj.options)) return null;
  const spec: UIComponentSpec = {
    type: obj.type as UIComponentSpec['type'],
    id: obj.id as string,
    label: obj.label as string,
  };
  if (typeof obj.detail === 'string') spec.detail = obj.detail;
  if (typeof obj.confirm_label === 'string') spec.confirm_label = obj.confirm_label;
  if (typeof obj.cancel_label === 'string') spec.cancel_label = obj.cancel_label;
  if (typeof obj.multi_select === 'boolean') spec.multi_select = obj.multi_select;
  if (Array.isArray(obj.options)) {
    spec.options = (obj.options as unknown[])
      .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
      .map((o) => {
        const opt: UIOption = {
          id: String(o.id ?? ''),
          label: String(o.label ?? ''),
        };
        if (o.custom === true) opt.custom = true;
        return opt;
      })
      .filter((o) => o.id && o.label);
  }
  return spec;
}

const OTRO_RE = /^otr[oa]s?\b/i;

export function InteractiveBlock({ spec, isInteracted, onInteract, autoFocus, onCancel }: BaseProps) {
  if (spec.type === 'quick_reply' || spec.type === 'select') {
    // En single-select: filtrar variantes de "Otro (escribir)" — el input de texto libre ya cubre esa función.
    // En multi-select: respetar opciones con custom:true (despliegan input inline al marcarse).
    const filtered = (spec.options ?? []).filter(o => o.custom || !OTRO_RE.test(o.label));
    return (
      <NumberedList
        specId={spec.id}
        options={filtered}
        isInteracted={isInteracted}
        multiSelect={spec.multi_select}
        label={spec.label}
        onChoose={(label) => onInteract(label, spec.type)}
        autoFocus={autoFocus}
        onCancel={onCancel}
      />
    );
  }

  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
      <ConfirmComponent spec={spec} isInteracted={isInteracted} onInteract={onInteract} />
    </div>
  );
}

// ─── Extracción del spec desde el texto del mensaje ───────────────────────────

const UI_COMPONENT_BLOCK_RE = /```ui-component\n([\s\S]*?)\n```/g;

export function extractLatestUISpec(content: string | null | undefined): UIComponentSpec | null {
  if (!content) return null;
  const matches = Array.from(content.matchAll(UI_COMPONENT_BLOCK_RE));
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  try {
    return validateSpec(JSON.parse(last[1]));
  } catch {
    return null;
  }
}
