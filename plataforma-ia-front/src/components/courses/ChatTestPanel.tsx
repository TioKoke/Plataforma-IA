import { useState, useRef, useEffect } from 'react';
import * as Icons from 'lucide-react';

export interface ChatMsg {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isLoading?: boolean;
}

interface Props {
    messages: ChatMsg[];
    isExecuting: boolean;
    canExecute: boolean;
    onSend: (message: string) => void;
    onClear: () => void;
    suggestedPrompts?: string[];
    testObservation?: string;
}

export const ChatTestPanel = ({ messages, isExecuting, canExecute, onSend, onClear, suggestedPrompts, testObservation }: Props) => {
    const [input, setInput] = useState('');
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        const text = input.trim();
        if (!text || isExecuting || !canExecute) return;
        onSend(text);
        setInput('');
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    // Show observation after first AI response is complete
    const hasAIResponse = messages.some(m => m.role === 'assistant' && !m.isLoading && m.content);

    return (
        <aside className="w-[340px] bg-bg-elev border-l border-border-soft flex flex-col h-full shrink-0">

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-plataforma-turquesa/10 text-plataforma-turquesa flex items-center justify-center">
                        <Icons.MessageCircle size={15} />
                    </div>
                    <div>
                        <div className="text-slate-800 font-bold text-sm leading-tight">Chat de prueba</div>
                        <div className="text-[10px] text-slate-400">Ejecuta el flujo con mensajes reales</div>
                    </div>
                </div>
                {messages.length > 0 && (
                    <button
                        onClick={onClear}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Limpiar chat"
                    >
                        <Icons.Trash2 size={13} />
                    </button>
                )}
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 custom-scrollbar">

                {/* Empty state */}
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                            <Icons.Workflow size={26} className="text-slate-300" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-500">
                                {canExecute ? 'Listo para ejecutar' : 'Construye tu flujo'}
                            </p>
                            <p className="text-[11px] text-slate-400 leading-relaxed max-w-[180px]">
                                {canExecute
                                    ? 'Escribe un mensaje y verás el flujo ejecutarse en tiempo real'
                                    : 'Arrastra y conecta nodos en el canvas para poder probar'}
                            </p>
                        </div>
                        {canExecute && (
                            <div className="flex items-center gap-1.5 text-[10px] text-plataforma-turquesa bg-plataforma-turquesa/5 border border-plataforma-turquesa/20 rounded-lg px-3 py-1.5">
                                <Icons.Zap size={10} />
                                <span>El flujo se ejecutará con gpt-5.2-chat</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Message bubbles */}
                {messages.map(msg => (
                    <div
                        key={msg.id}
                        className={`flex flex-col gap-0.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                        {/* Avatar + name */}
                        <div className={`flex items-center gap-1.5 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                msg.role === 'user'
                                    ? 'bg-plataforma-naranja/20 text-plataforma-naranja'
                                    : 'bg-plataforma-turquesa/20 text-plataforma-turquesa'
                            }`}>
                                {msg.role === 'user'
                                    ? <Icons.User size={10} />
                                    : <Icons.Bot  size={10} />}
                            </div>
                            <span className="text-[9px] text-slate-400 font-medium">
                                {msg.role === 'user' ? 'Tú' : 'IA · gpt-5.2-chat'}
                            </span>
                        </div>

                        {/* Bubble */}
                        <div className={`max-w-[92%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                            msg.role === 'user'
                                ? 'bg-plataforma-turquesa text-white rounded-tr-sm'
                                : 'bg-slate-100 text-slate-700 rounded-tl-sm border border-slate-200'
                        }`}>
                            {msg.isLoading ? (
                                <div className="flex items-center gap-2 py-0.5">
                                    <Icons.Loader2 size={12} className="animate-spin text-plataforma-turquesa" />
                                    <span className="text-slate-500">Ejecutando flujo...</span>
                                </div>
                            ) : (
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            )}
                        </div>
                    </div>
                ))}

                {/* Test observation — shown after first AI response */}
                {testObservation && hasAIResponse && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                        <Icons.Eye size={12} className="text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-800 leading-relaxed">{testObservation}</p>
                    </div>
                )}

                <div ref={endRef} />
            </div>

            {/* ── Suggested prompts ── */}
            {suggestedPrompts && suggestedPrompts.length > 0 && canExecute && messages.length === 0 && (
                <div className="px-3 pb-2 border-t border-slate-100 pt-2 shrink-0">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Icons.Sparkles size={10} className="text-plataforma-turquesa" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prueba con:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {suggestedPrompts.map((prompt, i) => (
                            <button
                                key={i}
                                onClick={() => onSend(prompt)}
                                disabled={isExecuting}
                                className="text-[10px] bg-plataforma-turquesa/5 hover:bg-plataforma-turquesa/15 border border-plataforma-turquesa/20 hover:border-plataforma-turquesa/40 text-plataforma-turquesa rounded-lg px-2.5 py-1.5 transition-colors text-left leading-snug disabled:opacity-40"
                            >
                                {prompt.length > 50 ? prompt.slice(0, 50) + '…' : prompt}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Input area ── */}
            <div className="px-3 py-3 border-t border-slate-200 shrink-0 space-y-2">

                {/* Hint when no flow */}
                {!canExecute && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        <Icons.AlertTriangle size={10} className="shrink-0" />
                        Conecta al menos 2 nodos para poder ejecutar
                    </div>
                )}

                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder={canExecute ? 'Escribe tu consulta...' : 'Construye el flujo primero'}
                        disabled={isExecuting || !canExecute}
                        className="flex-1 min-w-0 text-xs bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-plataforma-turquesa focus:bg-white focus:ring-1 focus:ring-plataforma-turquesa/30 disabled:opacity-50 transition-all"
                    />
                    <button
                        onClick={handleSend}
                        disabled={isExecuting || !input.trim() || !canExecute}
                        className="p-2 rounded-xl bg-plataforma-turquesa hover:bg-teal-600 text-white transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none shrink-0"
                        title="Enviar (Enter)"
                    >
                        {isExecuting
                            ? <Icons.Loader2 size={14} className="animate-spin" />
                            : <Icons.Send size={14} />}
                    </button>
                </div>

                <p className="text-center text-[10px] text-slate-400">
                    Observa los nodos animarse mientras el flujo procesa tu mensaje
                </p>
            </div>
        </aside>
    );
};
