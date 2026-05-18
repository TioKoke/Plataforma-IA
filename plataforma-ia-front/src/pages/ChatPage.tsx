import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useChat } from '../hooks/useChat';
import { Link } from 'react-router-dom';
import { Send, Bot, Sparkles, AlertCircle, Paperclip, X, FileText, Image as ImageIcon, Download, ClipboardList, SquarePen, Clock, Plus, Mail, Database, Terminal, Loader2, ChevronRight, ChevronDown, Globe, Layers, CheckCircle2, Circle } from 'lucide-react';
import MessageActions from '../components/chat/MessageActions';
import { ConversationsList } from '../components/chat/ConversationsList';
import { fetchConversationMessages } from '../services/conversationsApi';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage } from '../types/index';

const ThinkingProcess = ({
  thought,
  steps,
  isThinking,
  thinkingLabel,
}: {
  thought?: string,
  steps?: ChatMessage['steps'],
  isThinking: boolean,
  thinkingLabel?: string,
}) => {
  const [isExpanded, setIsExpanded] = useState(isThinking);

  // Auto-expand when thinking starts, but allow user to toggle
  useEffect(() => {
    if (isThinking) setIsExpanded(true);
  }, [isThinking]);

  if (!thought && (!steps || steps.length === 0) && !isThinking) return null;

  return (
    <div className={`mb-3 w-full max-w-full border rounded-xl px-3 py-2.5 transition-colors duration-300 ${
      isThinking
        ? 'bg-plataforma-turquesa/5 border-plataforma-turquesa/20'
        : 'bg-slate-50 border-slate-100'
    }`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Colapsar pensamiento del agente' : 'Expandir pensamiento del agente'}
        className={`flex items-center gap-2 transition-colors text-xs font-medium group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plataforma-naranja rounded ${
          isThinking ? 'text-plataforma-turquesa hover:text-plataforma-verde-oscuro' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <motion.div
          animate={{ rotate: isExpanded ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={14} aria-hidden="true" />
        </motion.div>
        <span className="flex items-center gap-2">
          {isThinking
            ? (steps && steps.length > 0 ? 'Procesando...' : 'Pensando...')
            : 'Pensamiento del agente'}
          {isThinking && (
            <span className="flex gap-1" aria-hidden="true">
              <span className="w-1 h-1 bg-plataforma-turquesa rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
              <span className="w-1 h-1 bg-plataforma-turquesa rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-1 h-1 bg-plataforma-turquesa rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
            </span>
          )}
        </span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={`mt-2 ml-1 pl-4 border-l-2 space-y-3 transition-colors duration-300 ${
              isThinking ? 'border-plataforma-turquesa/30' : 'border-slate-100'
            }`}>
              {isThinking && (!steps || steps.length === 0) && (
                <AnimatePresence mode="wait">
                  <motion.p
                    key={thinkingLabel ?? 'default'}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="text-sm text-slate-400 italic"
                  >
                    {thinkingLabel ?? 'analizando tu consulta...'}
                  </motion.p>
                </AnimatePresence>
              )}
              {thought && (
                <div className="text-sm text-slate-500 italic leading-relaxed whitespace-pre-line">
                  {thought}
                </div>
              )}
              
              {steps && steps.length > 0 && (
                <div className="space-y-2" role="list" aria-label="Pasos del proceso">
                  {steps.map((step, idx) => (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.08, ease: 'easeOut' }}
                      className="flex items-start gap-3"
                      role="listitem"
                    >
                      <div className="mt-0.5">
                        {step.status === 'completed' && <CheckCircle2 size={14} className="text-plataforma-verde-oscuro" aria-label="Completado" />}
                        {step.status === 'running' && <Loader2 size={14} className="text-plataforma-turquesa animate-spin" aria-label="En progreso" />}
                        {step.status === 'pending' && <Circle size={14} className="text-slate-300" aria-label="Pendiente" />}
                        {step.status === 'failed' && <X size={14} className="text-plataforma-rojo" aria-label="Fallido" />}
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs ${
                          step.status === 'running' ? 'text-plataforma-turquesa font-semibold' :
                          step.status === 'completed' ? 'text-slate-600 font-medium' : 'text-slate-400 font-medium'
                        }`}>
                          {step.title}
                        </p>
                        {step.details && isThinking && step.status === 'running' && (
                          <p className="text-[10px] text-slate-400 mt-0.5 animate-pulse">
                            {step.details}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isThinking && !steps.some(s => s.status === 'running') && thinkingLabel && (
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={thinkingLabel}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.25 }}
                        className="text-sm text-slate-400 italic"
                      >
                        {thinkingLabel}
                      </motion.p>
                    </AnimatePresence>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
import { MarkdownMessage } from '../components/MarkdownMessage';
import { InteractiveBlock, extractLatestUISpec, type UIComponentSpec } from '../components/chat/InteractiveComponents';
import { ChartBlock, validateChartSpec } from '../components/chat/ChartComponent';
import { DashboardBlock } from '../components/chat/DashboardComponent';
import { validateDashboardSpec } from '../components/chat/dashboard/validateDashboardSpec';
import { StandaloneKPIBlock } from '../components/chat/StandaloneKPIComponent';
import { validateKPISpec } from '../components/chat/kpi/validateKPISpec';
import { InfographicBlock } from '../components/chat/InfographicComponent';
import { validateInfographicSpec } from '../components/chat/infographic/validateInfographicSpec';
import { WidgetBlock } from '../components/chat/WidgetComponent';
import { validateWidgetSpec } from '../components/chat/widget/validateWidgetSpec';
import type { UIComponentPayload } from '../types/index';

// Renderiza los specs recibidos por evento WebSocket `ui-component` usando los
// mismos Block components que MarkdownMessage utiliza para los code-fences.
// Esto elimina el round-trip markdown → parse → validate → render.
const RenderedUIComponents = ({
  components,
  messageId,
  onInteract,
}: {
  components: UIComponentPayload[];
  messageId: string;
  onInteract?: (componentId: string, label: string, type: UIComponentSpec['type']) => void;
}) => {
  if (!components?.length) return null;
  return (
    <div className="space-y-3">
      {components.map((c, idx) => {
        const key = `${messageId}:${c.kind}:${(c.spec as { id?: string }).id ?? idx}`;
        const fireInteract = (label: string) =>
          onInteract?.(key, label, 'quick_reply');
        switch (c.kind) {
          case 'chart': {
            const spec = validateChartSpec(c.spec);
            if (!spec) return null;
            return <ChartBlock key={key} spec={spec} onInteract={fireInteract} />;
          }
          case 'dashboard': {
            const spec = validateDashboardSpec(c.spec);
            if (!spec) return null;
            return <DashboardBlock key={key} spec={spec} onInteract={fireInteract} />;
          }
          case 'kpi': {
            const spec = validateKPISpec(c.spec);
            if (!spec) return null;
            return <StandaloneKPIBlock key={key} spec={spec} onInteract={fireInteract} />;
          }
          case 'infographic': {
            const spec = validateInfographicSpec(c.spec);
            if (!spec) return null;
            return <InfographicBlock key={key} spec={spec} onInteract={fireInteract} />;
          }
          case 'widget': {
            const spec = validateWidgetSpec(c.spec);
            if (!spec) return null;
            return <WidgetBlock key={key} spec={spec} onInteract={fireInteract} />;
          }
          default:
            return null;
        }
      })}
    </div>
  );
};
import { useAuth } from '../context/AuthContext';
import BlurText from '../components/reactbits/BlurText';
import SpotlightCard from '../components/reactbits/SpotlightCard';
import { AIError, type AIErrorResponse } from '../utils/AIError';
import { ErrorMessageBubble } from '../components/ErrorMessageBubble';

const BACKLOG_ID_REGEX = /bl_[a-f0-9]{12}/g;

// Extrae nombres de archivo con extensiones conocidas del texto de un mensaje de IA,
// excluyendo los que ya están en message.files para evitar duplicados.
const _FILE_CONTENT_RE = /\b([a-zA-Z0-9_\-]+\.(xlsx|xls|pdf|docx|doc|txt|csv|json))\b/gi;
function extractFilesFromContent(
  content: string,
  existingFiles?: ChatMessage['files']
): NonNullable<ChatMessage['files']> {
  const existingNames = new Set((existingFiles ?? []).map(f => f.name));
  const found: NonNullable<ChatMessage['files']> = [];
  const seen = new Set<string>();
  const re = new RegExp(_FILE_CONTENT_RE.source, 'gi');
  let match;
  while ((match = re.exec(content)) !== null) {
    const name = match[1];
    if (!existingNames.has(name) && !seen.has(name)) {
      seen.add(name);
      found.push({ name, size: 0, url: `/chat/files/${name}` });
    }
  }
  return found;
}

const PastedTextChip = ({ pastedText, onRemove }: { pastedText: PastedText, onRemove: () => void }) => {
  return (
    <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm animate-fadeInUp hover:border-plataforma-naranja/50 hover:bg-plataforma-naranja/5 transition-all">
      <ClipboardList size={14} className="text-plataforma-naranja flex-shrink-0" />
      <div className="flex flex-col min-w-0">
        <span className="font-semibold text-gray-700 text-xs">PEGADO</span>
        <span className="text-gray-600 text-xs truncate max-w-xs">{pastedText.previewLine}</span>
      </div>
      <span className="text-gray-400 text-xs whitespace-nowrap">{pastedText.content.length} chars</span>
      <button
        onClick={onRemove}
        className="ml-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
        title="Eliminar texto pegado"
      >
        <X size={14} />
      </button>
    </div>
  );
};

const AttachedFileThumbnail = ({ file, onRemove, icon }: { file: File, onRemove: () => void, icon: React.ReactNode }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
    const isPDF = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

    if (isImage || isPDF) {
      const url = URL.createObjectURL(file);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
  const isPDF = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

  if ((isImage || isPDF) && previewUrl) {
    return (
      <SpotlightCard
        className="relative flex flex-col group overflow-hidden border-gray-200 shadow-lg w-32 h-32 bg-white flex-shrink-0 transition-all hover:shadow-xl hover:-translate-y-1 hover:border-plataforma-naranja/40 p-0 rounded-2xl"
        spotlightColor="rgba(229, 83, 2, 0.2)"
      >
        <button onClick={onRemove} className="absolute top-1.5 right-1.5 z-20 bg-black/40 hover:bg-red-500 text-white p-1 rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-sm" title="Eliminar archivo">
          <X size={14} />
        </button>
        <div className="w-full h-24 bg-gray-50 relative overflow-hidden flex items-center justify-center z-10">
          {isImage ? (
            <img src={previewUrl} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <>
              <iframe src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} className="absolute inset-0 w-[125%] h-[125%] transform scale-[0.8] origin-top-left border-none pointer-events-none opacity-90 bg-white overflow-hidden" scrolling="no" />
            </>
          )}
        </div>
        <div className="px-2 py-1 flex items-center justify-center bg-white border-t border-gray-100 z-10 w-full h-8">
          <span className="text-[10px] font-semibold text-gray-700 truncate w-full text-center" title={file.name}>{file.name}</span>
        </div>
      </SpotlightCard>
    );
  }

  return (
    <SpotlightCard
      className="relative flex flex-col group overflow-hidden border-gray-200 shadow-lg w-32 h-32 bg-white flex-shrink-0 transition-all hover:shadow-xl hover:-translate-y-1 hover:border-plataforma-naranja/40 p-0 rounded-2xl"
      spotlightColor="rgba(229, 83, 2, 0.2)"
    >
      <button onClick={onRemove} className="absolute top-1.5 right-1.5 z-20 bg-gray-200/80 hover:bg-red-500 hover:text-white text-gray-600 p-1 rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-sm" title="Eliminar archivo">
        <X size={14} />
      </button>
      <div className="w-full h-24 bg-gray-50 relative flex flex-col items-center justify-center z-10">
        <div className="text-gray-400 mb-2 scale-150">
          {icon}
        </div>
        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-2">{file.name.split('.').pop() || 'FILE'}</span>
      </div>
      <div className="px-2 py-1 flex items-center justify-center bg-white border-t border-gray-100 z-10 w-full h-8">
        <span className="text-[10px] font-semibold text-gray-700 truncate w-full text-center" title={file.name}>{file.name}</span>
      </div>
    </SpotlightCard>
  );
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type PastedText = {
  id: string;
  content: string;
  previewLine: string;
};

import {
  fetchIntegrationStatuses,
  getOutlookAuthUrl,
  getJiraAuthUrl,
  disconnectIntegration,
  openOAuthWindow,
  waitForOAuthPopup,
  type IntegrationStatus,
  type IntegrationServiceId,
} from '../services/integrationsApi';
import { Link as RouterLink } from 'react-router-dom';

type IntegrationMeta = {
  id: IntegrationServiceId;
  name: string;
  description: string;
  capabilities: string[];
};

const AVAILABLE_INTEGRATIONS: IntegrationMeta[] = [
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    description: 'Lee emails, envía correos y consulta tu calendario',
    capabilities: ['read_emails', 'send_email', 'get_calendar_events'],
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Busca issues, crea tareas y agrega comentarios',
    capabilities: ['get_jira_issues', 'create_jira_issue', 'add_jira_comment'],
  },
];

const ChatPage = () => {
  const { userEmail, userName, userDivision, userPhoto, isAdmin } = useAuth();
  const { messages, setMessages, streamingState, setStreamingState, conversationId, setConversationId, connectionError, sendMessage: wsSendMessage, regenerate: wsRegenerate, interactedComponents, markComponentInteracted, resetInteractions } = useChat(API_URL);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [pastedTexts, setPastedTexts] = useState<PastedText[]>([]);
  const lastAiMessageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevMessageCount = useRef(0);
  // refreshKey bump → fuerza al sidebar de historial a re-fetchear la lista
  // (sube cada vez que el backend asigna una nueva conversationId).
  const [conversationsRefreshKey, setConversationsRefreshKey] = useState(0);
  const lastSeenConversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (conversationId && conversationId !== lastSeenConversationIdRef.current) {
      lastSeenConversationIdRef.current = conversationId;
      setConversationsRefreshKey((k) => k + 1);
    }
  }, [conversationId]);

  // Integrations State
  const { getIdToken } = useAuth();
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isMCPModalOpen, setIsMCPModalOpen] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [integrationStatuses, setIntegrationStatuses] = useState<IntegrationStatus[]>([]);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  const refreshIntegrations = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const data = await fetchIntegrationStatuses(token);
      setIntegrationStatuses(data.integrations);
    } catch (err) {
      console.error('Error fetching integrations:', err);
    }
  }, [getIdToken]);

  // Load integrations when the modal opens
  useEffect(() => {
    if (isMCPModalOpen) {
      refreshIntegrations();
    }
  }, [isMCPModalOpen, refreshIntegrations]);

  // Close plus menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setIsPlusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToLastAiMessage = () => {
    if (lastAiMessageRef.current && messagesContainerRef.current) {
      const messageTop = lastAiMessageRef.current.offsetTop;
      messagesContainerRef.current.scrollTo({
        top: messageTop,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.sender === 'ai') {
        setTimeout(() => {
          scrollToLastAiMessage();
        }, 100);
      }
    }
    prevMessageCount.current = messages.length;
  }, [messages]);

  // Auto-expand textarea as user types
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [inputValue]);

  const quickActions = [
    '¿Qué agentes de IA están disponibles para mi área?',
    '¿Cómo puedo solicitar un nuevo agente de IA?',
    '¿Qué tipo de archivos puedo analizar con IA?'
  ];

  // Sólo usado para mensajes con archivos adjuntos (HTTP multipart)
  const sendMessageWithFilesHttp = async (userMessage: string, files: File[]) => {
    try {
      setError(null);
      const formData = new FormData();
      const effectiveMessage = userMessage.trim() || 'Analiza los archivos adjuntos';
      formData.append('message', effectiveMessage);
      if (conversationId) {
        formData.append('conversation_id', conversationId);
      }
      if (userEmail) {
        formData.append('user_context_json', JSON.stringify({ email: userEmail, name: userName, division: userDivision }));
      }
      files.forEach(file => {
        formData.append('files', file);
      });

      const token = await getIdToken();
      const response = await fetch(`${API_URL}/chat/message-with-files`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const aiError = errorBody as AIErrorResponse | null;
        throw AIError.fromResponse(
          aiError ?? {
            error_type: 'unknown',
            user_message: 'Algo salió mal. Por favor intenta de nuevo en un momento.',
            is_retryable: true,
          },
          response.status
        );
      }

      const data = await response.json();
      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }
      return { content: data.content, files: data.files || [] };
    } catch (err) {
      if (err instanceof AIError) throw err;
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      throw new AIError(
        `No se pudo conectar con el servidor: ${errorMessage}`,
        'connection',
        null,
        true,
        503
      );
    }
  };

  const handleRetry = async (errorMessage: ChatMessage) => {
    const errorIndex = messages.findIndex(m => m.id === errorMessage.id);
    if (errorIndex <= 0) return;
    const userMsg = [...messages].reverse().slice(messages.length - errorIndex + 1).find(m => m.sender === 'user');
    if (!userMsg) return;
    setMessages(prev => prev.filter(msg => msg.id !== errorMessage.id));
    setInputValue(userMsg.content);
    setTimeout(() => { handleSendMessage(); }, 100);
  };

  const handleSendMessage = async () => {
    if (streamingState) return;
    if (!inputValue.trim() && attachedFiles.length === 0 && pastedTexts.length === 0) return;

    const pastedContent = pastedTexts.map(p => p.content).join('\n\n');
    const messageContent = pastedContent
      ? `${pastedContent}\n\n${inputValue}`.trim()
      : inputValue;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: messageContent,
      sender: 'user',
      timestamp: new Date(),
      characterCount: messageContent.length,
      files: attachedFiles.length > 0
        ? attachedFiles.map(f => ({ name: f.name, size: f.size, url: URL.createObjectURL(f) }))
        : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    const currentFiles = [...attachedFiles];
    setInputValue('');
    setAttachedFiles([]);
    setPastedTexts([]);

    if (currentFiles.length > 0) {
      // Path archivos: HTTP bloqueante (sin streaming)
      const tempId = `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      setStreamingState({ messageId: tempId, content: '', steps: [], pendingFiles: [], thinkingLabel: 'Analizando archivos...', uiComponents: [] });
      const startTime = performance.now();
      try {
        const aiResponse = await sendMessageWithFilesHttp(messageContent, currentFiles);
        const duration = ((performance.now() - startTime) / 1000).toFixed(1);
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: aiResponse.content,
          sender: 'ai',
          timestamp: new Date(),
          characterCount: aiResponse.content.length,
          responseTime: Number(duration),
          files: aiResponse.files.length > 0 ? aiResponse.files : undefined,
        };
        setStreamingState(null);
        setMessages(prev => [...prev, aiMessage]);
      } catch (err) {
        setStreamingState(null);
        const aiErr = err instanceof AIError ? err : AIError.generic();
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          content: aiErr.userMessage,
          sender: 'ai',
          timestamp: new Date(),
          characterCount: 0,
          isError: true,
          errorType: aiErr.errorType,
          retryAfter: aiErr.retryAfter,
          isRetryable: aiErr.isRetryable,
        }]);
      }
    } else {
      // Path texto: WebSocket con streaming en tiempo real
      wsSendMessage(
        messageContent,
        userEmail ? { email: userEmail, name: userName ?? '', division: userDivision ?? '' } : undefined
      );
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Capturamos el array EAGERLY antes de limpiar el input. Si pasamos
    // `Array.from(files)` dentro del updater de setState, React lo evalúa
    // durante el render — pero para entonces `event.target.value=''` ya
    // limpió el FileList y termina copiando un array vacío.
    const picked = event.target.files ? Array.from(event.target.files) : [];
    if (picked.length > 0) {
      setAttachedFiles(prev => [...prev, ...picked]);
    }
    // Reset del value para que volver a elegir el mismo archivo dispare
    // onChange (sin esto, mismo path dos veces no emite el evento).
    event.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setAttachedFiles(prev => [...prev, ...Array.from(files)]);
    }
  };

  const getFileIcon = (fileName: string, forDownload = false) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const colorClass = forDownload ? 'text-plataforma-naranja' : 'text-plataforma-naranja';
    if (imageExts.includes(ext || '')) {
      return <ImageIcon size={16} className={colorClass} />;
    }
    return <FileText size={16} className={colorClass} />;
  };

  const handleDownloadFile = async (file: { name: string; url?: string; data?: string }) => {
    try {
      if (file.url) {
        // Usar fetch + blob para evitar problemas de cross-origin con <a download>
        const href = file.url.startsWith('/') ? `${API_URL}${file.url}` : file.url;
        const response = await fetch(href);
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } else if (file.data) {
        const link = document.createElement('a');
        link.href = file.data;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Error descargando archivo:', err);
    }
  };

  const handleQuickAction = (action: string) => {
    setInputValue(action);
  };

  const handleComponentInteract = useCallback((componentId: string, label: string, _type: UIComponentSpec['type']) => {
    // Chart components allow multiple data-point clicks — don't lock them as interacted
    if (!componentId.includes(':chart:')) {
      markComponentInteracted(componentId);
    }
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: label,
      sender: 'user',
      timestamp: new Date(),
      characterCount: label.length,
    };
    setMessages(prev => [...prev, userMessage]);
    wsSendMessage(
      label,
      userEmail ? { email: userEmail, name: userName ?? '', division: userDivision ?? '' } : undefined
    );
  }, [markComponentInteracted, setMessages, wsSendMessage, userEmail, userName, userDivision]);

  // Último ui-component pendiente (no interactuado) del último mensaje del agente
  const pendingUISpec = useMemo(() => {
    if (streamingState) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.sender !== 'ai') continue;
      const spec = extractLatestUISpec(msg.content);
      if (!spec) return null;
      const componentId = `${msg.id}:${spec.id}`;
      if (interactedComponents.has(componentId)) return null;
      return { messageId: msg.id, spec, componentId };
    }
    return null;
  }, [messages, streamingState, interactedComponents]);

  // Cancelar/dismiss un ui-component sin enviar mensaje
  const handleComponentCancel = useCallback(() => {
    if (pendingUISpec) {
      markComponentInteracted(pendingUISpec.componentId);
    }
  }, [pendingUISpec, markComponentInteracted]);

  // Listener global de Escape para cancelar ui-component
  useEffect(() => {
    if (!pendingUISpec) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') handleComponentCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [pendingUISpec, handleComponentCancel]);

  const handleNewChat = () => {
    const previousConversationId = conversationId;
    if (previousConversationId) {
      (async () => {
        try {
          const token = await getIdToken();
          if (!token) return;
          await fetch(`${API_URL}/chat/conversation/${previousConversationId}/files`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // Fire-and-forget: el TTL del backend barre cualquier huérfano.
        }
      })();
    }
    setMessages([]);
    setConversationId(null);
    setInputValue('');
    setAttachedFiles([]);
    setPastedTexts([]);
    setError(null);
    resetInteractions();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectConversation = useCallback((id: string) => {
    // Cargar una conversación pasada desde el sidebar.
    // Reset visual + fetch async de los mensajes persistidos.
    setMessages([]);
    setConversationId(id);
    setInputValue('');
    setAttachedFiles([]);
    setPastedTexts([]);
    setError(null);
    resetInteractions();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    (async () => {
      try {
        const token = await getIdToken();
        const data = await fetchConversationMessages(id, token);
        if (data.items.length === 0) {
          return;
        }
        const restored: ChatMessage[] = data.items.map((m) => ({
          id: m.id,
          content: m.content,
          sender: m.role === 'user' ? 'user' : 'ai',
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
          characterCount: m.content.length,
        }));
        setMessages(restored);
      } catch (e) {
        setError(`No se pudo cargar la conversación: ${(e as Error).message}`);
      }
    })();
  }, [setMessages, setConversationId, resetInteractions, getIdToken]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Check for files in clipboard first (images)
    const items = e.clipboardData.items;
    const files: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      setAttachedFiles(prev => [...prev, ...files]);
      return;
    }

    // Handle large text blocks
    const text = e.clipboardData.getData('text');
    if (text.length > 500) {
      e.preventDefault();
      const preview = text.split('\n')[0].slice(0, 60);
      setPastedTexts(prev => [...prev, {
        id: crypto.randomUUID(),
        content: text,
        previewLine: preview || 'Texto pegado',
      }]);
    }
    // else: default paste applies — text goes into textarea
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden relative">

      {/* Top bar */}
      <div className="relative z-20 bg-white border-b border-slate-200 p-4 pt-20 flex-shrink-0 shadow-sm">
        <div className="flex items-center justify-between lg:pl-72">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-plataforma-gris-oscuro rounded-xl flex items-center justify-center mr-3 shadow-sm">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-base text-plataforma-gris-oscuro">
                Asistente IA Plataforma IA
              </h2>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Activo · Powered by Foundry
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-plataforma-gris-oscuro hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-lg transition-all"
              title="Nuevo chat"
            >
              <SquarePen size={15} />
              <span className="hidden sm:inline">Nuevo chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: solo historial de conversaciones (estilo Claude.ai) */}
        <div className="w-72 relative z-20 bg-white border-r border-slate-200 p-5 hidden lg:flex flex-col overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Botón "nuevo chat" siempre visible en el sidebar */}
          <button
            onClick={handleNewChat}
            className="mb-4 flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-plataforma-gris-oscuro hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-lg transition-all"
            title="Nuevo chat"
          >
            <SquarePen size={15} />
            <span>Nuevo chat</span>
          </button>

          {/* Historial de conversaciones */}
          <ConversationsList
            activeId={conversationId}
            refreshKey={conversationsRefreshKey}
            onSelect={handleSelectConversation}
          />
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-slate-50">
            <div className="w-full max-w-5xl mx-auto px-2">
              {/* Welcome screen */}
              {messages.length === 0 && !streamingState && (
                <div className="flex flex-col items-center justify-center py-8 space-y-5 animate-fadeIn">
                  <div className="w-12 h-12 bg-plataforma-gris-oscuro rounded-xl flex items-center justify-center shadow-md">
                    <Bot size={24} className="text-white" />
                  </div>

                  <div className="text-center max-w-3xl space-y-3">
                    <h1 className="font-heading font-black text-plataforma-gris-oscuro text-2xl md:text-3xl lg:text-4xl tracking-tight leading-tight flex flex-row items-center justify-center gap-3 flex-wrap">
                      <BlurText text="Bienvenido a" delay={50} />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-plataforma-naranja to-plataforma-amarillo">
                        IA Plataforma IA
                      </span>
                    </h1>
                    <p className="text-slate-500 text-xs md:text-sm leading-relaxed">
                      Tu asistente inteligente para explorar agentes, aprender conceptos clave y crear soluciones con IA en minería.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl">
                    {quickActions.map((action, index) => (
                      <SpotlightCard
                        key={index}
                        spotlightColor="rgba(229, 83, 2, 0.2)"
                        className="bg-white border-slate-200 shadow-sm transition-all group cursor-pointer"
                        onClick={() => handleQuickAction(action)}
                      >
                        <div className="p-4 text-sm text-left text-gray-700 h-full relative z-10">
                          <div className="flex items-start gap-3">
                            <Sparkles size={16} className="text-plataforma-naranja mt-0.5 flex-shrink-0" />
                            <span className="leading-relaxed text-xs">{action}</span>
                          </div>
                        </div>
                      </SpotlightCard>
                    ))}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 w-full max-w-5xl">
                    <SpotlightCard
                      spotlightColor="rgba(0, 152, 170, 0.2)"
                      className="bg-white border-slate-200 shadow-sm transition-all text-left cursor-pointer"
                      onClick={() => {
                        setInputValue("Analiza este archivo y dame un resumen con los puntos más importantes");
                        fileInputRef.current?.click();
                      }}
                    >
                      <div className="p-5 h-full relative z-10">
                        <h4 className="font-heading font-semibold text-plataforma-gris-oscuro mb-2">Analizar un Documento</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          "Sube un Excel, PDF o Word y obtén un resumen con los puntos clave"
                        </p>
                        <div className="flex items-center gap-2 text-xs text-plataforma-turquesa font-medium">
                          <Paperclip size={14} />
                          <span>Sube tu archivo</span>
                        </div>
                      </div>
                    </SpotlightCard>

                    <SpotlightCard
                      spotlightColor="rgba(229, 83, 2, 0.2)"
                      className="bg-white border-slate-200 shadow-sm transition-all text-left cursor-pointer"
                      onClick={() => handleQuickAction("Quiero solicitar un nuevo agente de IA para mi área, ¿cómo lo hago?")}
                    >
                      <div className="p-5 h-full relative z-10">
                        <h4 className="font-heading font-semibold text-plataforma-gris-oscuro mb-2">Solicitar un Agente IA</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          "Registra tu idea de agente IA en el backlog de IA Plataforma IA"
                        </p>
                        <div className="flex items-center gap-2 text-xs text-plataforma-naranja font-medium">
                          <Sparkles size={14} />
                          <span>Crea tu solicitud</span>
                        </div>
                      </div>
                    </SpotlightCard>
                  </div>
                </div>
              )}

              {/* Messages */}
              {(messages.length > 0 || streamingState) && (
                <div className="space-y-5">
                  {messages.map((message, index) => {
                    const isLastAiMessage = message.sender === 'ai' && index === messages.length - 1;
                    return (
                      <div
                        key={message.id}
                        ref={isLastAiMessage ? lastAiMessageRef : null}
                        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                      >
                        <div className={`flex items-start min-w-0 ${message.sender === 'user' ? 'max-w-[70%] flex-row-reverse' : 'max-w-[90%] flex-row'}`}>
                          <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden shadow-sm ${message.sender === 'user'
                            ? 'bg-plataforma-gris-oscuro ml-3'
                            : 'bg-slate-200 mr-3'
                            }`}>
                            {message.sender === 'user' ? (
                              userPhoto ? (
                                <img src={userPhoto} alt={userName ?? 'Usuario'} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-white text-xs font-bold">
                                  {(userName ?? '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                                </span>
                              )
                            ) : (
                              <Bot size={18} className="text-plataforma-gris-oscuro" />
                            )}
                          </div>
                          <div className={`flex flex-col min-w-0 overflow-hidden ${message.sender === 'user' ? 'items-end' : 'items-start'} gap-1.5 group`}>
                            {message.sender === 'ai' && (
                              <ThinkingProcess 
                                thought={message.thought} 
                                steps={message.steps} 
                                isThinking={false} 
                              />
                            )}
                            
                            {message.sender === 'user' && message.files && message.files.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2 justify-end">
                                {message.files.map((file, idx) => {
                                  const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
                                  const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(ext);
                                  const isPDF = ext === 'PDF';

                                  return (
                                    <div key={idx} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm w-32 h-32 flex flex-col group hover:border-plataforma-naranja/40 transition-all duration-300 relative">
                                      {isImage && file.url ? (
                                        <div className="w-full h-24 bg-gray-50 relative cursor-pointer" onClick={() => window.open(file.url, '_blank')}>
                                          <img src={file.url} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                            <Download size={20} className="text-white drop-shadow-md" onClick={(e) => { e.stopPropagation(); handleDownloadFile(file); }} />
                                          </div>
                                        </div>
                                      ) : isPDF && file.url ? (
                                        <div className="w-full h-24 bg-white relative cursor-pointer overflow-hidden flex items-center justify-center" onClick={() => window.open(file.url, '_blank')}>
                                          <iframe src={`${file.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} className="absolute inset-0 w-[125%] h-[125%] transform scale-[0.8] origin-top-left border-none pointer-events-none opacity-90" scrolling="no" />
                                          <div className="absolute inset-0 bg-black/5 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center z-10">
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/80 p-1.5 rounded-full hover:bg-white shadow-sm">
                                              <Download size={16} className="text-plataforma-gris-oscuro" onClick={(e) => { e.stopPropagation(); handleDownloadFile(file); }} />
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="w-full h-24 bg-gray-50 relative flex flex-col items-center justify-center cursor-pointer" onClick={() => handleDownloadFile(file)}>
                                          <div className="text-gray-400 mb-2 scale-150">
                                            {getFileIcon(file.name)}
                                          </div>
                                          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-2">{ext}</span>
                                          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                            <div className="bg-white/80 p-1.5 rounded-full hover:bg-white shadow-sm">
                                              <Download size={16} className="text-plataforma-gris-oscuro" />
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      <div className="px-2 py-1 flex items-center justify-center bg-white border-t border-gray-100 z-10 w-full h-8">
                                        <p className="text-[10px] font-semibold text-gray-700 truncate w-full text-center" title={file.name}>
                                          {file.name}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {message.isError ? (
                              <ErrorMessageBubble
                                content={message.content}
                                retryAfter={message.retryAfter}
                                isRetryable={message.isRetryable}
                                onRetry={() => handleRetry(message)}
                              />
                            ) : message.content && (
                              <div className={`px-4 py-3 shadow-sm ${message.sender === 'user'
                                ? 'bg-plataforma-gris-oscuro text-white rounded-2xl rounded-tr-sm'
                                : 'bg-white border border-slate-200 rounded-2xl rounded-tl-sm'
                                }`}>
                                {message.sender === 'user' ? (
                                  <div className="space-y-1">
                                    <div
                                      className={`overflow-hidden transition-all duration-300 ${
                                        expandedMessages.has(message.id)
                                          ? 'max-h-none'
                                          : 'max-h-32'
                                      }`}
                                    >
                                      <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
                                    </div>

                                    {/* Show more button for user messages */}
                                    {message.content.split('\n').length > 4 && (
                                      <button
                                        onClick={() => {
                                          setExpandedMessages(prev => {
                                            const newSet = new Set(prev);
                                            if (newSet.has(message.id)) {
                                              newSet.delete(message.id);
                                            } else {
                                              newSet.add(message.id);
                                            }
                                            return newSet;
                                          });
                                        }}
                                        className="text-xs text-white/70 hover:text-white font-medium mt-2 transition-colors"
                                      >
                                        {expandedMessages.has(message.id) ? 'Mostrar menos' : 'Mostrar más'}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {message.uiComponents && message.uiComponents.length > 0 && (
                                      <RenderedUIComponents
                                        components={message.uiComponents}
                                        messageId={message.id}
                                        onInteract={handleComponentInteract}
                                      />
                                    )}
                                    <MarkdownMessage
                                      content={message.content}
                                      className="text-gray-800"
                                      messageId={message.id}
                                      isStreaming={false}
                                      interactedComponents={interactedComponents}
                                      onInteract={handleComponentInteract}
                                    />

                                    {/* Backlog confirmation card */}
                                    {(() => {
                                      const matches = message.content.match(BACKLOG_ID_REGEX);
                                      if (!matches) return null;
                                      return (
                                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-2">
                                            <ClipboardList size={16} className="text-green-600 flex-shrink-0" />
                                            <div>
                                              <p className="text-xs font-semibold text-green-800">Requerimiento registrado</p>
                                              <p className="text-xs text-green-700 font-mono">{matches[0]}</p>
                                            </div>
                                          </div>
                                          <Link
                                            to="/backlog"
                                            className="flex-shrink-0 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors font-medium"
                                          >
                                            Ver backlog
                                          </Link>
                                        </div>
                                      );
                                    })()}
                                    {(() => {
                                      const scanned = message.sender === 'ai'
                                        ? extractFilesFromContent(message.content, message.files)
                                        : [];
                                      const allFiles = [...(message.files ?? []), ...scanned];
                                      if (allFiles.length === 0) return null;
                                      return (
                                      <div className="space-y-3 pt-3 flex flex-col">
                                        {allFiles.map((file, idx) => {
                                          const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
                                          const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(ext);
                                          const isPDF = ext === 'PDF';
                                          const fileSource = file.url ? (file.url.startsWith('/') ? `${API_URL}${file.url}` : file.url) : file.data;

                                          if (isImage || isPDF) {
                                            return (
                                              <div key={idx} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm w-64 flex flex-col group transition-all duration-300 hover:shadow-md hover:border-plataforma-naranja/40">
                                                {isImage && fileSource ? (
                                                  <div className="w-full h-40 bg-gray-100 relative cursor-pointer" onClick={() => window.open(fileSource, '_blank')}>
                                                    <img src={fileSource} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                                      <Download size={24} className="text-white drop-shadow-md" onClick={(e) => { e.stopPropagation(); handleDownloadFile(file); }} />
                                                    </div>
                                                  </div>
                                                ) : isPDF && fileSource ? (
                                                  <div className="w-full h-40 bg-gray-50 relative cursor-pointer" onClick={() => window.open(fileSource, '_blank')}>
                                                    <iframe src={`${fileSource}#toolbar=0&navpanes=0&scrollbar=0`} className="w-[125%] h-[125%] transform scale-[0.8] origin-top-left border-none pointer-events-none" />
                                                    <div className="absolute inset-0 bg-black/5 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                                                      <FileText size={32} className="text-plataforma-naranja drop-shadow-sm" />
                                                    </div>
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/80 p-1.5 rounded-full hover:bg-white shadow-sm">
                                                      <Download size={16} className="text-plataforma-gris-oscuro" onClick={(e) => { e.stopPropagation(); handleDownloadFile(file); }} />
                                                    </div>
                                                  </div>
                                                ) : null}
                                                <div className="p-2.5 flex justify-between items-center bg-white border-t border-gray-100">
                                                  <p className="text-[11px] font-medium text-gray-700 truncate mr-2" title={file.name}>
                                                    {file.name}
                                                  </p>
                                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)}KB</span>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDownloadFile(file); }} className="text-gray-400 hover:text-plataforma-naranja transition-colors">
                                                      <Download size={14} />
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          }

                                          return (
                                            <button
                                              key={idx}
                                              onClick={() => handleDownloadFile(file)}
                                              className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 hover:border-plataforma-naranja/40 px-3 py-2.5 rounded-lg text-sm transition-colors w-full group"
                                            >
                                              <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                                                  {getFileIcon(file.name, true)}
                                                </div>
                                                <div className="text-left overflow-hidden">
                                                  <p className="font-medium text-gray-700 text-xs truncate" title={file.name}>{file.name}</p>
                                                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                              </div>
                                              <Download size={16} className="text-gray-400 group-hover:text-plataforma-naranja transition-colors flex-shrink-0" />
                                            </button>
                                          );
                                        })}
                                      </div>
                                      );
                                    })()}
                                  </div>
                                )}
                                <div className={`text-[10px] mt-1.5 flex items-center justify-end gap-3 ${message.sender === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                                  {message.sender === 'ai' && message.responseTime !== undefined && (
                                    <div className="flex items-center gap-1">
                                      <Clock size={10} />
                                      <span>{message.responseTime}s</span>
                                    </div>
                                  )}
                                  <span>{message.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              </div>
                            )}
                            {message.sender === 'ai' && !message.isError && (
                              <MessageActions
                                content={message.content}
                                isRegenerating={isRegenerating && message.id === messages[messages.length - 1]?.id}
                                onRegenerate={message.id === messages[messages.length - 1]?.id ? () => {
                                  setIsRegenerating(true);
                                  wsRegenerate({ name: userName ?? '', email: userEmail ?? '', division: userDivision ?? '' });
                                  setTimeout(() => setIsRegenerating(false), 500);
                                } : undefined}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {streamingState && (
                    <div className="flex justify-start animate-fadeIn" ref={lastAiMessageRef}>
                      <div className="flex items-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-slate-200 mr-3 shadow-sm">
                          <Bot size={16} className="text-plataforma-gris-oscuro" />
                        </div>
                        <div className="flex flex-col gap-1 w-full">
                          <ThinkingProcess
                            isThinking={true}
                            steps={streamingState.steps}
                            thinkingLabel={streamingState.thinkingLabel}
                          />
                          {streamingState.uiComponents.length > 0 && (
                            <RenderedUIComponents
                              components={streamingState.uiComponents}
                              messageId={streamingState.messageId}
                              onInteract={handleComponentInteract}
                            />
                          )}
                          {streamingState.content && (
                            <div className="px-4 py-3 bg-white border border-slate-200 shadow-sm rounded-2xl rounded-tl-sm max-w-full">
                              <MarkdownMessage content={streamingState.content} className="text-gray-800" isStreaming={true} />
                              <span className="inline-block w-0.5 h-4 bg-slate-400 ml-0.5 animate-pulse align-middle" />
                            </div>
                          )}
                          {streamingState.pendingFiles.length > 0 && (
                            <div className="space-y-2 mt-1">
                              {streamingState.pendingFiles.map((file, idx) => (
                                <a
                                  key={idx}
                                  href={`${API_URL}${file.url}`}
                                  download={file.name}
                                  className="flex items-center gap-3 bg-gray-50 border border-emerald-200 hover:border-plataforma-naranja/40 px-3 py-2.5 rounded-xl text-sm transition-colors w-full group"
                                >
                                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Download size={14} className="text-emerald-600" />
                                  </div>
                                  <div className="text-left overflow-hidden flex-1">
                                    <p className="font-medium text-gray-700 text-xs truncate">{file.name}</p>
                                    <p className="text-xs text-emerald-600 animate-pulse">Listo para descargar</p>
                                  </div>
                                  <Download size={16} className="text-gray-400 group-hover:text-plataforma-naranja transition-colors flex-shrink-0" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Input area */}
          <div className="px-4 py-2 bg-slate-50 flex-shrink-0 z-40">
            <div className="w-full max-w-4xl mx-auto px-2 relative">
              {/* Pasted Texts and File Previews - Overlayed */}
              <AnimatePresence>
                {(pastedTexts.length > 0 || attachedFiles.length > 0) && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full left-0 mb-4 flex flex-wrap gap-3 z-50 p-1"
                  >
                    {pastedTexts.map((pastedText, index) => (
                      <PastedTextChip
                        key={pastedText.id}
                        pastedText={pastedText}
                        onRemove={() => setPastedTexts(prev => prev.filter((_, i) => i !== index))}
                      />
                    ))}
                    {attachedFiles.length > 0 && (
                      <div className="flex gap-3 items-end overflow-x-auto custom-scrollbar pb-2">
                        {attachedFiles.map((file, index) => (
                          <AttachedFileThumbnail
                            key={index}
                            file={file}
                            onRemove={() => handleRemoveFile(index)}
                            icon={getFileIcon(file.name)}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept=".pdf,.docx,.txt,.md,.py,.js,.json,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp"
                className="hidden"
              />

              {connectionError && (
                <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">{connectionError}</p>
                </div>
              )}

              {/* Unified input container */}
              <div
                className={`flex flex-col rounded-2xl border bg-white transition-all shadow-sm ${
                  isDragging
                    ? 'border-plataforma-naranja border-dashed bg-plataforma-naranja/5'
                    : 'border-slate-300 hover:border-slate-400 focus-within:border-plataforma-naranja/50 focus-within:ring-4 focus-within:ring-plataforma-naranja/5'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Pending ui-component (quick_reply / select / confirm) */}
                {pendingUISpec && (
                  <div className={pendingUISpec.spec.type === 'confirm' ? 'px-3 pt-3' : 'px-3 py-2.5'}>
                    <InteractiveBlock
                      spec={pendingUISpec.spec}
                      isInteracted={false}
                      autoFocus={false}
                      onInteract={(label, type) =>
                        handleComponentInteract(pendingUISpec.componentId, label, type)
                      }
                      onCancel={handleComponentCancel}
                    />
                  </div>
                )}

                {/* Textarea Area — hidden when quick_reply/select selector is active */}
                {(!pendingUISpec || pendingUISpec.spec.type === 'confirm') && (
                  <div className="flex-1 relative px-3 pt-2 pb-0">
                    <textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyPress}
                      onPaste={handlePaste}
                      placeholder="Escribe tu pregunta sobre IA en minería..."
                      rows={1}
                      className="w-full bg-transparent border-none text-sm resize-none focus:outline-none text-slate-800 placeholder-slate-400 py-1"
                      style={{ minHeight: '32px', maxHeight: '160px', overflowY: 'auto' }}
                      disabled={!!streamingState}
                    />
                    {isDragging && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-white/60 rounded-t-2xl z-10">
                        <p className="text-sm font-medium text-plataforma-naranja">Suelta los archivos aquí</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Divider + Action Bar — hidden when quick_reply/select selector is active */}
                {(!pendingUISpec || pendingUISpec.spec.type === 'confirm') && (
                  <>
                    <div className="border-t border-slate-100 mx-3" />

                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex-1 flex justify-start">
                        {/* Plus Menu */}
                        <div className="relative" ref={plusMenuRef}>
                          <button
                            onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                            disabled={!!streamingState}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 ${
                              isPlusMenuOpen
                                ? 'bg-plataforma-naranja text-white rotate-45 shadow-md shadow-plataforma-naranja/20'
                                : 'text-slate-400 hover:text-plataforma-gris-oscuro hover:bg-slate-100'
                            }`}
                            title="Adjuntar"
                          >
                            <Plus size={20} />
                          </button>

                          <AnimatePresence>
                            {isPlusMenuOpen && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="absolute bottom-full left-0 mb-3 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 p-2"
                              >
                                <button
                                  onClick={() => { fileInputRef.current?.click(); setIsPlusMenuOpen(false); }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-slate-700 hover:bg-slate-50 transition-colors group"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors flex-shrink-0">
                                    <Paperclip size={16} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-slate-700">Subir archivos</p>
                                    <p className="text-[10px] text-slate-400">PDF, Excel, Imágenes...</p>
                                  </div>
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => { setIsMCPModalOpen(true); setIsPlusMenuOpen(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-slate-700 hover:bg-slate-50 transition-colors group"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-plataforma-naranja/10 flex items-center justify-center text-plataforma-naranja group-hover:bg-plataforma-naranja/20 transition-colors flex-shrink-0">
                                      <Layers size={16} />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-xs font-semibold text-slate-700">Connectors (MCP)</p>
                                      <p className="text-[10px] text-slate-400">SAP, Outlook...</p>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-300" />
                                  </button>
                                )}
                                <button
                                  disabled
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-slate-400 opacity-50 cursor-not-allowed"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 flex-shrink-0">
                                    <Globe size={16} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold">Web Search</p>
                                    <p className="text-[10px] text-slate-400">Próximamente</p>
                                  </div>
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Keyboard Hints - Centered */}
                      <div className="hidden sm:flex flex-1 justify-center items-center gap-2 text-[10px] text-slate-400 font-medium whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <kbd className="px-1 py-0.5 bg-slate-50 rounded border border-slate-200 min-w-[20px] text-center">↵</kbd>
                          enviar
                        </span>
                        <span className="text-slate-200">|</span>
                        <span className="flex items-center gap-1">
                          <kbd className="px-1 py-0.5 bg-slate-50 rounded border border-slate-200">Shift</kbd>
                          <span>+</span>
                          <kbd className="px-1 py-0.5 bg-slate-50 rounded border border-slate-200 min-w-[20px] text-center">↵</kbd>
                          nueva línea
                        </span>
                      </div>

                      <div className="flex-1 flex items-center justify-end gap-3">
                        {inputValue.length > 0 && (
                          <span className="text-[11px] text-slate-400 font-medium tabular-nums">{inputValue.length}</span>
                        )}
                        <button
                          onClick={handleSendMessage}
                          disabled={(!inputValue.trim() && attachedFiles.length === 0 && pastedTexts.length === 0) || !!streamingState}
                          className="w-9 h-9 bg-plataforma-naranja text-white rounded-xl flex items-center justify-center hover:bg-plataforma-naranja/90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-plataforma-naranja/10"
                          title="Enviar (Enter)"
                        >
                          {streamingState ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Added simple keyframes for upward animation */}
          <style dangerouslySetInnerHTML={{
            __html: `
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(20px) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            .animate-fadeInUp {
              animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}} />
        </div>
      </div>
      <IntegrationsModal
        isOpen={isMCPModalOpen}
        onClose={() => setIsMCPModalOpen(false)}
        integrations={integrationStatuses}
        onRefresh={refreshIntegrations}
      />
    </div>
  );
};

const IntegrationsModal = ({
  isOpen,
  onClose,
  integrations,
  onRefresh,
}: {
  isOpen: boolean;
  onClose: () => void;
  integrations: IntegrationStatus[];
  onRefresh: () => Promise<void>;
}) => {
  const { getIdToken, isAdmin } = useAuth();
  const [connectingService, setConnectingService] = useState<IntegrationServiceId | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getStatus = (service: IntegrationServiceId): IntegrationStatus => {
    return (
      integrations.find(i => i.service === service) || {
        service,
        status: 'disconnected',
        connected_at: null,
        scopes: [],
      }
    );
  };

  const handleConnect = async (service: IntegrationServiceId) => {
    setErrorMessage(null);
    setConnectingService(service);

    // Abrir el popup sincrónicamente ANTES de cualquier await.
    // Los navegadores (Chrome, Firefox, Safari) sólo permiten window.open()
    // en el call stack síncrono de un gesto del usuario. Si se llama después
    // de un await, el popup es bloqueado silenciosamente.
    const popup = openOAuthWindow(service);
    if (!popup) {
      setErrorMessage('No se pudo abrir el popup. Verifica el bloqueador de popups en tu navegador.');
      setConnectingService(null);
      return;
    }

    try {
      const token = await getIdToken();
      if (!token) throw new Error('No se pudo obtener el token de autenticación');

      const authUrl =
        service === 'outlook'
          ? await getOutlookAuthUrl(token)
          : await getJiraAuthUrl(token);

      // Navegar el popup ya abierto a la URL de autenticación real
      popup.location.href = authUrl;

      // Esperar el postMessage de éxito desde el callback del backend
      await waitForOAuthPopup(popup, service);
      await onRefresh();
    } catch (err) {
      if (!popup.closed) popup.close();
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setErrorMessage(msg);
    } finally {
      setConnectingService(null);
    }
  };

  const handleDisconnect = async (service: IntegrationServiceId) => {
    setErrorMessage(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('No se pudo obtener el token de autenticación');
      await disconnectIntegration(service, token);
      await onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setErrorMessage(msg);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-plataforma-gris-oscuro/40 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
          >
            <div className="bg-gradient-to-r from-plataforma-gris-oscuro to-gray-700 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-plataforma-naranja rounded-xl flex items-center justify-center shadow-lg">
                  <Layers size={20} />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-xl leading-tight">Integraciones</h2>
                  <p className="text-white/60 text-xs">Conecta tus cuentas para que el agente pueda ayudarte</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-4">
                {AVAILABLE_INTEGRATIONS.map(meta => {
                  const status = getStatus(meta.id);
                  const isConnected = status.status === 'connected';
                  const isExpired = status.status === 'expired';
                  const isConnecting = connectingService === meta.id;

                  return (
                    <div
                      key={meta.id}
                      className="p-5 bg-gray-50 border border-gray-100 rounded-2xl"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isConnected
                                ? 'bg-green-100 text-green-600'
                                : 'bg-gray-200 text-gray-400'
                            }`}
                          >
                            {meta.id === 'outlook' ? <Mail size={22} /> : <Database size={22} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-gray-800 text-sm">{meta.name}</h4>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  isConnected
                                    ? 'bg-green-500/10 text-green-600'
                                    : isExpired
                                    ? 'bg-yellow-500/10 text-yellow-600'
                                    : 'bg-gray-200 text-gray-500'
                                }`}
                              >
                                {isConnected ? 'Conectado' : isExpired ? 'Expirado' : 'Desconectado'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{meta.description}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {meta.capabilities.map(cap => (
                                <span
                                  key={cap}
                                  className="px-1.5 py-0.5 bg-plataforma-turquesa/5 text-plataforma-turquesa border border-plataforma-turquesa/10 rounded text-[9px] font-medium"
                                >
                                  {cap}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {isConnected ? (
                            <button
                              onClick={() => handleDisconnect(meta.id)}
                              className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors"
                            >
                              Desconectar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleConnect(meta.id)}
                              disabled={isConnecting}
                              className="px-4 py-2 bg-plataforma-gris-oscuro text-white rounded-xl text-xs font-bold hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              {isConnecting ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  Conectando...
                                </>
                              ) : (
                                <>
                                  Conectar
                                  <Terminal size={12} />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-4">
              <p className="text-[10px] text-gray-400">
                Credenciales cifradas (AES-256-GCM). Puedes desconectar en cualquier momento.
              </p>
              {isAdmin && (
                <RouterLink
                  to="/conectores"
                  onClick={onClose}
                  className="text-[11px] font-semibold text-plataforma-naranja hover:underline whitespace-nowrap flex-shrink-0"
                >
                  Ver configuración completa →
                </RouterLink>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ChatPage;

