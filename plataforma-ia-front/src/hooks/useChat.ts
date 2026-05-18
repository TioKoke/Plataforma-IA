import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChatMessage, UIComponentKind, UIComponentPayload } from '../types/index';
import { useAuth } from '../context/AuthContext';

export type PendingFile = { name: string; size: number; url?: string };

export type StreamingState = {
  messageId: string;
  content: string;
  steps: NonNullable<ChatMessage['steps']>;
  pendingFiles: PendingFile[];
  thinkingLabel: string;
  uiComponents: UIComponentPayload[];
} | null;

const UI_COMPONENT_KINDS: UIComponentKind[] = ['chart', 'dashboard', 'kpi', 'infographic', 'widget'];

// Elimina del markdown los bloques ```<kind>-component ... ``` cuyo spec.id ya
// fue recibido por el evento `ui-component`, para evitar doble render.
function stripRenderedComponentBlocks(content: string, components: UIComponentPayload[]): string {
  if (!components.length) return content;
  const renderedIds = new Set(
    components.map(c => (c.spec && typeof c.spec.id === 'string' ? c.spec.id : '')).filter(Boolean)
  );
  if (!renderedIds.size) return content;
  let out = content;
  for (const kind of UI_COMPONENT_KINDS) {
    const re = new RegExp('```' + kind + '-component\\s*\\n([\\s\\S]*?)\\n```', 'g');
    out = out.replace(re, (match, body: string) => {
      try {
        const parsed = JSON.parse(body);
        if (parsed && typeof parsed.id === 'string' && renderedIds.has(parsed.id)) return '';
      } catch {
        // Bloque inválido — dejar al MarkdownMessage mostrarlo como fallback
      }
      return match;
    });
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

type UserContext = {
  name: string;
  email: string;
  division: string;
};

type WsEvent = {
  type: string;
  data?: Record<string, unknown>;
  error?: string;
};

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 30000];

export function useChat(apiUrl: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingState, setStreamingState] = useState<StreamingState>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [interactedComponents, setInteractedComponents] = useState<Set<string>>(new Set());

  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string>(crypto.randomUUID());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  // Keep a ref to streamingState so onmessage closure always has current value
  const streamingStateRef = useRef<StreamingState>(null);
  // Prevents message_complete from creating a duplicate when stream_end already committed the message
  const streamEndRanRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    streamingStateRef.current = streamingState;
  }, [streamingState]);

  // Keep conversationId ref in sync
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const handleMessage = useCallback((event: MessageEvent) => {
    let msg: WsEvent;
    try {
      msg = JSON.parse(event.data as string);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'connected':
        setIsConnected(true);
        setConnectionError(null);
        break;

      case 'tool_start': {
        const { tool_id, label, args_preview } = msg.data as {
          tool_id: string;
          label: string;
          args_preview?: string;
        };
        setStreamingState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            steps: [
              ...prev.steps,
              {
                id: tool_id,
                title: label,
                status: 'running' as const,
                details: args_preview,
              },
            ],
          };
        });
        break;
      }

      case 'tool_complete': {
        const { tool_id, result_summary } = msg.data as {
          tool_id: string;
          result_summary?: string;
        };
        setStreamingState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            steps: prev.steps.map(s =>
              s.id === tool_id
                ? { ...s, status: 'completed' as const, details: result_summary }
                : s
            ),
          };
        });
        break;
      }

      case 'tool_error': {
        const { tool_id, error } = msg.data as { tool_id: string; error?: string };
        setStreamingState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            steps: prev.steps.map(s =>
              s.id === tool_id
                ? { ...s, status: 'failed' as const, details: error }
                : s
            ),
          };
        });
        break;
      }

      case 'stream_thinking': {
        const { label } = msg.data as { label: string };
        setStreamingState(prev => prev ? { ...prev, thinkingLabel: label } : prev);
        break;
      }

      case 'stream_token': {
        const { token } = msg.data as { token: string };
        setStreamingState(prev => {
          if (!prev) return prev;
          return { ...prev, content: prev.content + token };
        });
        break;
      }

      case 'ui-component': {
        const { kind, spec } = (msg.data ?? {}) as {
          kind?: UIComponentKind;
          spec?: { id?: string; [k: string]: unknown };
        };
        if (!kind || !spec || !UI_COMPONENT_KINDS.includes(kind)) break;
        setStreamingState(prev => {
          if (!prev) return prev;
          const specId = typeof spec.id === 'string' ? spec.id : undefined;
          const already = specId
            ? prev.uiComponents.some(c => c.kind === kind && (c.spec as { id?: string }).id === specId)
            : false;
          if (already) return prev;
          return { ...prev, uiComponents: [...prev.uiComponents, { kind, spec }] };
        });
        break;
      }

      case 'file_created': {
        const { filename, url, size } = msg.data as { filename: string; url?: string; size?: number };
        setStreamingState(prev => {
          if (!prev) return prev;
          return { ...prev, pendingFiles: [...prev.pendingFiles, { name: filename, size: size ?? 0, url }] };
        });
        break;
      }

      case 'stream_end': {
        const { conversation_id, files: backendFiles } = msg.data as {
          conversation_id?: string;
          files?: { name: string; size: number; url?: string }[];
        };
        if (conversation_id) {
          setConversationId(conversation_id);
          conversationIdRef.current = conversation_id;
        }
        // Finalizar: leemos el streamingState desde el ref (no del callback)
        // para evitar el anti-pattern de tener side effects dentro de un state
        // updater — bajo StrictMode los updaters se invocan dos veces en dev,
        // lo que duplicaba el setMessages y dejaba el mismo mensaje dos veces.
        const prev = streamingStateRef.current;
        if (prev) {
          const pendingNames = new Set(prev.pendingFiles.map(f => f.name));
          const extra = (backendFiles ?? []).filter(f => !pendingNames.has(f.name));
          const allFiles = [...prev.pendingFiles, ...extra];
          const finalContent = stripRenderedComponentBlocks(prev.content, prev.uiComponents);
          const finalMsg: ChatMessage = {
            id: prev.messageId,
            content: finalContent,
            sender: 'ai',
            timestamp: new Date(),
            characterCount: finalContent.length,
            steps: prev.steps.length > 0 ? prev.steps : undefined,
            files: allFiles.length > 0 ? allFiles : undefined,
            uiComponents: prev.uiComponents.length > 0 ? prev.uiComponents : undefined,
          };
          setMessages(m => [...m, finalMsg]);
          streamEndRanRef.current = true;
        }
        setStreamingState(null);
        break;
      }

      case 'message_complete': {
        // Fallback: si stream_end no llegó (ej. mensaje sin streaming),
        // crear el mensaje directamente desde el contenido completo.
        const { content, conversation_id, message_id, files: backendFiles } = msg.data as {
          content: string;
          conversation_id?: string;
          message_id?: string;
          files?: { name: string; size: number; url?: string }[];
        };
        if (conversation_id) {
          setConversationId(conversation_id);
          conversationIdRef.current = conversation_id;
        }
        // Chequeo del flag FUERA de setStreamingState. Hacerlo dentro era
        // bugueado bajo StrictMode: React invoca el updater dos veces en
        // dev, y el reseteo del ref adentro hacía que la segunda invocación
        // viera `false` y agregara un mensaje duplicado.
        if (streamEndRanRef.current) {
          streamEndRanRef.current = false;
          break;
        }
        // Si todavía hay tokens en flight (stream_end aún no llegó), ignorar
        // este message_complete; stream_end va a commitear el mensaje.
        if (streamingStateRef.current && streamingStateRef.current.content.length > 0) {
          break;
        }
        // No hubo streaming: crear mensaje desde contenido completo
        const prev = streamingStateRef.current;
        const pendingFiles = prev?.pendingFiles ?? [];
        const pendingNames = new Set(pendingFiles.map(f => f.name));
        const extra = (backendFiles ?? []).filter(f => !pendingNames.has(f.name));
        const allFiles = [...pendingFiles, ...extra];
        const uiComponents = prev?.uiComponents ?? [];
        const finalContent = stripRenderedComponentBlocks(content ?? '', uiComponents);
        const finalMsg: ChatMessage = {
          id: message_id ?? `msg_${Date.now()}`,
          content: finalContent,
          sender: 'ai',
          timestamp: new Date(),
          characterCount: finalContent.length,
          steps: prev?.steps && prev.steps.length > 0 ? prev.steps : undefined,
          files: allFiles.length > 0 ? allFiles : undefined,
          uiComponents: uiComponents.length > 0 ? uiComponents : undefined,
        };
        setMessages(m => [...m, finalMsg]);
        setStreamingState(null);
        break;
      }

      case 'error': {
        const errorMsg: ChatMessage = {
          id: `err_${Date.now()}`,
          content: (msg.error as string) ?? 'Error desconocido',
          sender: 'ai',
          timestamp: new Date(),
          characterCount: 0,
          isError: true,
          isRetryable: true,
        };
        setMessages(prev => [...prev, errorMsg]);
        setStreamingState(null);
        break;
      }
    }
  }, []);

  const { getIdToken } = useAuth();

  const connect = useCallback(async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const wsUrl = apiUrl.replace(/^http/, 'ws');
    // Auth: token via Sec-WebSocket-Protocol (segundo subprotocol después del
    // marker `plataforma-ia.bearer.v1`). Evita que el JWT aparezca en URL/Referer/
    // historial. Backend valida antes de aceptar el handshake.
    //
    // Transición: durante el rollout, también incluimos el token en query
    // string como fallback. El backend prefiere el subprotocol cuando ambos
    // están presentes. Se removerá el query string en una iteración posterior
    // cuando todos los entornos estén estables con auth via header.
    const token = await getIdToken();
    const baseUrl = `${wsUrl}/chat/ws/${clientIdRef.current}`;
    const url = token
      ? `${baseUrl}?token=${encodeURIComponent(token)}`
      : baseUrl;
    const ws = token
      ? new WebSocket(url, ['plataforma-ia.bearer.v1', token])
      : new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      // isConnected se establece en el evento 'connected' del servidor
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;

      // Reconexión con backoff
      const delay = RECONNECT_DELAYS[
        Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)
      ];
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => { void connect(); }, delay);
    };

    ws.onerror = (evt) => {
      console.error('[chat-ws] error', evt);
      setConnectionError('Conexión con el agente perdida. Reintentando…');
      ws.close();
    };
  }, [apiUrl, handleMessage, getIdToken]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const markComponentInteracted = useCallback((componentId: string) => {
    setInteractedComponents(prev => new Set(prev).add(componentId));
  }, []);

  const resetInteractions = useCallback(() => {
    setInteractedComponents(new Set());
  }, []);

  const sendMessage = useCallback(
    (text: string, userContext?: UserContext) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      const tempId = `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

      // Reset por si acaso quedó en true de un ciclo anterior
      streamEndRanRef.current = false;
      // Crear slot vacío para el mensaje en progreso
      setStreamingState({ messageId: tempId, content: '', steps: [], pendingFiles: [], thinkingLabel: 'Analizando tu consulta...', uiComponents: [] });

      wsRef.current.send(
        JSON.stringify({
          message: trimmed,
          conversation_id: conversationIdRef.current,
          user_context: userContext,
        })
      );
    },
    []
  );

  const regenerate = useCallback(
    (userContext?: UserContext) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      // Encontrar el último mensaje del usuario en el estado actual
      setMessages(prev => {
        const lastUserIdx = [...prev].reverse().findIndex(m => m.sender === 'user');
        if (lastUserIdx === -1) return prev;

        const actualIdx = prev.length - 1 - lastUserIdx;
        const lastUserMessage = prev[actualIdx];
        const messagesWithoutLastAI = prev.slice(0, actualIdx + 1);

        // Separar el envío de WebSocket del setter de estado usando setTimeout
        setTimeout(() => {
          const tempId = `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
          streamEndRanRef.current = false;
          setStreamingState({
            messageId: tempId,
            content: '',
            steps: [],
            pendingFiles: [],
            thinkingLabel: 'Regenerando respuesta...',
            uiComponents: [],
          });
          wsRef.current?.send(
            JSON.stringify({
              message: lastUserMessage.content,
              conversation_id: conversationIdRef.current,
              user_context: userContext,
            })
          );
        }, 0);

        return messagesWithoutLastAI;
      });
    },
    []
  );

  // Conectar al montar, desconectar al desmontar
  useEffect(() => {
    void connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    messages,
    setMessages,
    streamingState,
    setStreamingState,
    conversationId,
    setConversationId,
    isConnected,
    connectionError,
    sendMessage,
    regenerate,
    connect,
    disconnect,
    interactedComponents,
    markComponentInteracted,
    resetInteractions,
  };
}
