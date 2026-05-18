import { createContext, useContext, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { Check, Copy } from 'lucide-react';
import type { UIComponentSpec } from './chat/InteractiveComponents';
import { ChartBlock, validateChartSpec } from './chat/ChartComponent';
import { DashboardBlock } from './chat/DashboardComponent';
import { validateDashboardSpec } from './chat/dashboard/validateDashboardSpec';
import { StandaloneKPIBlock } from './chat/StandaloneKPIComponent';
import { validateKPISpec } from './chat/kpi/validateKPISpec';
import { InfographicBlock } from './chat/InfographicComponent';
import { validateInfographicSpec } from './chat/infographic/validateInfographicSpec';
import { WidgetBlock } from './chat/WidgetComponent';
import { validateWidgetSpec } from './chat/widget/validateWidgetSpec';

// ─── Context para pasar props interactivos al CodeBlock ───────────────────────

interface UIContext {
  messageId?: string;
  isStreaming?: boolean;
  interactedComponents?: Set<string>;
  onInteract?: (componentId: string, label: string, type: UIComponentSpec['type']) => void;
}

const UIComponentContext = createContext<UIContext>({});

// ─── CodeBlock ────────────────────────────────────────────────────────────────

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const CodeBlock = ({ inline, className, children, ...props }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const { messageId, isStreaming, onInteract } = useContext(UIComponentContext);

  const match = /language-([\w-]+)/.exec(className || '');
  const language = match ? match[1] : '';

  // Ocultar bloques ui-component del cuerpo del mensaje — se renderizan
  // ancladas al input en ChatPage (ver pendingUISpec).
  if (language === 'ui-component' && !inline && !isStreaming) {
    return null;
  }

  // Interceptar bloques chart-component (solo en mensajes finalizados, no durante streaming)
  if (language === 'chart-component' && !inline && !isStreaming) {
    try {
      const raw = String(children).replace(/\n$/, '');
      const parsed = JSON.parse(raw);
      const spec = validateChartSpec(parsed);
      if (spec) {
        const componentId = `${messageId ?? 'msg'}:chart:${spec.id}`;
        return (
          <ChartBlock
            spec={spec}
            onInteract={(label) => onInteract?.(componentId, label, 'quick_reply')}
          />
        );
      }
      // Valid JSON but unsupported chart type or insufficient data — show friendly error
      return (
        <div className="my-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <p className="font-medium">No se pudo renderizar el gráfico</p>
          <p className="text-xs mt-1 text-amber-600">
            Tipo &quot;{String((parsed as Record<string, unknown>)?.type ?? (parsed as Record<string, unknown>)?.chart_type ?? 'desconocido')}&quot; no soportado o datos insuficientes.
          </p>
        </div>
      );
    } catch {
      // JSON inválido → cae al render de CodeBlock normal
    }
  }

  // Interceptar bloques dashboard-component
  if (language === 'dashboard-component' && !inline && !isStreaming) {
    try {
      const raw = String(children).replace(/\n$/, '');
      const spec = validateDashboardSpec(JSON.parse(raw));
      if (spec) {
        const componentId = `${messageId ?? 'msg'}:dashboard:${spec.id}`;
        return (
          <DashboardBlock
            spec={spec}
            onInteract={(label) => onInteract?.(componentId, label, 'quick_reply')}
          />
        );
      }
    } catch {
      // JSON inválido → cae al render de CodeBlock normal
    }
  }

  // Interceptar bloques kpi-component
  if (language === 'kpi-component' && !inline && !isStreaming) {
    try {
      const raw = String(children).replace(/\n$/, '');
      const spec = validateKPISpec(JSON.parse(raw));
      if (spec) {
        const componentId = `${messageId ?? 'msg'}:kpi:${spec.id}`;
        return (
          <StandaloneKPIBlock
            spec={spec}
            onInteract={(label) => onInteract?.(componentId, label, 'quick_reply')}
          />
        );
      }
    } catch {
      // JSON inválido → cae al render de CodeBlock normal
    }
  }

  // Interceptar bloques infographic-component
  if (language === 'infographic-component' && !inline && !isStreaming) {
    try {
      const raw = String(children).replace(/\n$/, '');
      const spec = validateInfographicSpec(JSON.parse(raw));
      if (spec) {
        const componentId = `${messageId ?? 'msg'}:infographic:${spec.id}`;
        return (
          <InfographicBlock
            spec={spec}
            onInteract={(label) => onInteract?.(componentId, label, 'quick_reply')}
          />
        );
      }
    } catch {
      // JSON inválido → cae al render de CodeBlock normal
    }
  }

  // Interceptar bloques widget-component
  if (language === 'widget-component' && !inline && !isStreaming) {
    try {
      const raw = String(children).replace(/\n$/, '');
      const spec = validateWidgetSpec(JSON.parse(raw));
      if (spec) {
        const componentId = `${messageId ?? 'msg'}:widget:${spec.id}`;
        return (
          <WidgetBlock
            spec={spec}
            onInteract={(label) => onInteract?.(componentId, label, 'quick_reply')}
          />
        );
      }
    } catch {
      // JSON inválido → cae al render de CodeBlock normal
    }
  }

  const handleCopy = () => {
    const code = String(children).replace(/\n$/, '');
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return (
      <code className="bg-slate-100 text-plataforma-turquesa px-1.5 py-0.5 rounded-md text-[0.8em] font-mono border border-slate-200" {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className="group my-3 max-w-full rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100">
        <span className="text-[11px] font-mono font-semibold text-plataforma-turquesa uppercase tracking-wider">
          {language || 'código'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-plataforma-gris-oscuro bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all opacity-0 group-hover:opacity-100"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>
      {/* Code */}
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed bg-slate-50 m-0">
        <code className={`${className}`} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
};

// ─── MarkdownMessage ──────────────────────────────────────────────────────────

interface MarkdownMessageProps {
  content: string;
  className?: string;
  messageId?: string;
  isStreaming?: boolean;
  interactedComponents?: Set<string>;
  onInteract?: (componentId: string, label: string, type: UIComponentSpec['type']) => void;
}

// Detecta bloques de código con JSON compacto y los formatea con indentación.
const formatJSONCodeBlocks = (content: string): string => {
  return content.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const trimmed = code.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return match;
    try {
      const parsed = JSON.parse(trimmed);
      const pretty = JSON.stringify(parsed, null, 2);
      return `\`\`\`${lang || 'json'}\n${pretty}\n\`\`\``;
    } catch {
      return match;
    }
  });
};

// Quita bloques ui-component del contenido antes de pasarlo al markdown.
// Cubre bloques completos y, durante streaming, también el fence abierto sin cerrar
// para que no aparezca un bloque negro mientras llegan los tokens.
const stripUIComponentBlocks = (content: string): string => {
  return content
    .replace(/```ui-component\n[\s\S]*?\n```\n?/g, '')
    .replace(/```ui-component[\s\S]*$/g, '');
};

// Durante streaming, recorta el final del contenido cuando queda un bloque
// markdown a medio cerrar (code fence, fila de tabla, ítem de lista). Evita
// flicker de tablas/código/listas mientras llegan los tokens.
const bufferIncompleteMarkdown = (content: string): string => {
  const fenceOpens = (content.match(/```/g) || []).length;
  if (fenceOpens % 2 === 1) {
    const lastFence = content.lastIndexOf('```');
    return content.slice(0, lastFence);
  }

  const lines = content.split('\n');
  const last = lines[lines.length - 1];

  if (last.startsWith('|') && !content.endsWith('\n')) {
    return lines.slice(0, -1).join('\n');
  }

  if (/^(\s*[-*+]|\s*\d+\.)\s?.{0,2}$/.test(last) && !content.endsWith('\n')) {
    return lines.slice(0, -1).join('\n');
  }

  return content;
};

export const MarkdownMessage = ({
  content,
  className = '',
  messageId,
  isStreaming,
  interactedComponents,
  onInteract,
}: MarkdownMessageProps) => {
  const stripped = stripUIComponentBlocks(content);
  const buffered = isStreaming ? bufferIncompleteMarkdown(stripped) : stripped;
  const cleanContent = isStreaming ? buffered : formatJSONCodeBlocks(buffered);
  return (
    <UIComponentContext.Provider value={{ messageId, isStreaming, interactedComponents, onInteract }}>
      <div className={`prose prose-sm max-w-none break-words ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            // Bloques de código
            code: CodeBlock,

            // Encabezados
            h1: ({ node: _node, ...props }) => (
              <h1 className="text-2xl font-heading font-bold text-plataforma-gris-oscuro mt-6 mb-3" {...props} />
            ),
            h2: ({ node: _node, children, ...props }) => {
              const flat = Array.isArray(children)
                ? children.map((c) => (typeof c === 'string' ? c : '')).join('')
                : typeof children === 'string'
                  ? children
                  : '';
              const match = flat.match(/^(\p{Extended_Pictographic}\uFE0F?)\s+(.*)$/u);
              if (match) {
                const [, emoji, rest] = match;
                return (
                  <h2
                    className="text-xl font-heading font-bold text-plataforma-gris-oscuro mt-6 mb-3 flex items-center gap-2 pb-1 border-b border-slate-200"
                    {...props}
                  >
                    <span className="text-2xl leading-none" aria-hidden="true">{emoji}</span>
                    <span>{rest}</span>
                  </h2>
                );
              }
              return (
                <h2 className="text-xl font-heading font-bold text-plataforma-gris-oscuro mt-5 mb-2 flex items-center" {...props}>
                  {children}
                </h2>
              );
            },
            h3: ({ node: _node, ...props }) => (
              <h3 className="text-lg font-heading font-semibold text-plataforma-gris-oscuro mt-4 mb-2" {...props} />
            ),

            // Párrafos
            p: ({ node: _node, ...props }) => (
              <div className="text-gray-700 leading-relaxed my-3" {...props} />
            ),

            // Listas
            ul: ({ node: _node, ...props }) => (
              <ul className="list-disc list-inside space-y-1 my-3 ml-2" {...props} />
            ),
            ol: ({ node: _node, ...props }) => (
              <ol className="list-decimal list-inside space-y-1 my-3 ml-2" {...props} />
            ),
            li: ({ node: _node, ...props }) => (
              <li className="text-gray-700" {...props} />
            ),

            // Enlaces
            a: ({ node: _node, ...props }) => (
              <a
                className="text-[#0072B1] hover:text-[#005a8e] underline transition-colors"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
            ),

            // Tablas
            table: ({ node: _node, ...props }) => (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg" {...props} />
              </div>
            ),
            thead: ({ node: _node, ...props }) => (
              <thead className="bg-gray-50" {...props} />
            ),
            th: ({ node: _node, ...props }) => (
              <th className="px-4 py-2 text-left text-xs font-heading font-semibold text-gray-700 uppercase tracking-wider" {...props} />
            ),
            td: ({ node: _node, ...props }) => (
              <td className="px-4 py-2 text-sm text-gray-700 border-t border-gray-200" {...props} />
            ),

            // Citas
            blockquote: ({ node: _node, ...props }) => (
              <blockquote className="border-l-4 border-plataforma-turquesa bg-gray-50 pl-4 py-2 my-3 italic text-gray-700" {...props} />
            ),

            // Línea horizontal
            hr: ({ node: _node, ...props }) => (
              <hr className="my-6 border-t-2 border-gray-200" {...props} />
            ),

            // Texto en negrita
            strong: ({ node: _node, ...props }) => (
              <strong className="font-bold text-plataforma-gris-oscuro" {...props} />
            ),

            // Texto en cursiva
            em: ({ node: _node, ...props }) => (
              <em className="italic text-gray-700" {...props} />
            ),
          }}
        >
          {cleanContent}
        </ReactMarkdown>
      </div>
    </UIComponentContext.Provider>
  );
};
