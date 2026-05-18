import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Mail,
  Database,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Plug,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ConnectorMeta {
  id: IntegrationServiceId;
  name: string;
  provider: string;
  description: string;
  capabilities: { label: string; description: string }[];
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface ComingSoonMeta {
  name: string;
  provider: string;
  description: string;
  icon: React.ReactNode;
}

// ── Datos de conectores disponibles ───────────────────────────────────────────

const CONNECTORS: ConnectorMeta[] = [
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    provider: 'Microsoft 365',
    description:
      'Permite al agente leer y enviar correos electrónicos, y consultar eventos de tu calendario de Outlook.',
    capabilities: [
      { label: 'Leer emails', description: 'El agente puede consultar tu bandeja de entrada' },
      { label: 'Enviar emails', description: 'El agente puede redactar y enviar correos en tu nombre' },
      { label: 'Calendario', description: 'Consulta reuniones y disponibilidad' },
    ],
    icon: <Mail size={28} />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    id: 'jira',
    name: 'Jira',
    provider: 'Atlassian',
    description:
      'Conecta con Jira para buscar issues, crear tareas y agregar comentarios directamente desde el chat.',
    capabilities: [
      { label: 'Buscar issues', description: 'Consulta tickets y estados de proyectos' },
      { label: 'Crear tareas', description: 'El agente puede crear nuevos issues en tus proyectos' },
      { label: 'Comentar', description: 'Agrega comentarios a issues existentes' },
    ],
    icon: <Database size={28} />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
];

const COMING_SOON: ComingSoonMeta[] = [
  {
    name: 'SAP',
    provider: 'SAP SE',
    description: 'Consulta órdenes de compra, inventario y reportes ERP.',
    icon: (
      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
      </svg>
    ),
  },
  {
    name: 'SharePoint',
    provider: 'Microsoft 365',
    description: 'Accede a documentos y bibliotecas de SharePoint corporativo.',
    icon: (
      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current" aria-hidden="true">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z" />
      </svg>
    ),
  },
  {
    name: 'Google Workspace',
    provider: 'Google',
    description: 'Integra Gmail, Google Calendar y Google Drive.',
    icon: (
      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
      </svg>
    ),
  },
  {
    name: 'Salesforce',
    provider: 'Salesforce',
    description: 'Consulta clientes, oportunidades y reportes de CRM.',
    icon: (
      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
      </svg>
    ),
  },
];

// ── Componente principal ───────────────────────────────────────────────────────

const ConnectorsPage = () => {
  const { getIdToken } = useAuth();
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [connectingService, setConnectingService] = useState<IntegrationServiceId | null>(null);
  const [disconnectingService, setDisconnectingService] = useState<IntegrationServiceId | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const refreshStatuses = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const data = await fetchIntegrationStatuses(token);
      setStatuses(data.integrations);
    } catch {
      // silent
    } finally {
      setLoadingStatuses(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    refreshStatuses();
  }, [refreshStatuses]);

  const getStatus = (serviceId: IntegrationServiceId): IntegrationStatus => {
    return (
      statuses.find(s => s.service === serviceId) ?? {
        service: serviceId,
        status: 'disconnected',
        connected_at: null,
        scopes: [],
      }
    );
  };

  const handleConnect = async (service: IntegrationServiceId) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setConnectingService(service);

    // Abrir popup sincrónicamente ANTES de cualquier await
    const popup = openOAuthWindow(service);
    if (!popup) {
      setErrorMessage('No se pudo abrir el popup. Verifica el bloqueador de popups en tu navegador.');
      setConnectingService(null);
      return;
    }

    try {
      const token = await getIdToken();
      if (!token) throw new Error('Tu sesión expiró. Te estamos redirigiendo al login — volvé a intentar después.');

      const authUrl =
        service === 'outlook'
          ? await getOutlookAuthUrl(token)
          : await getJiraAuthUrl(token);

      popup.location.href = authUrl;
      await waitForOAuthPopup(popup, service);
      await refreshStatuses();
      setSuccessMessage(`${service === 'outlook' ? 'Microsoft Outlook' : 'Jira'} conectado correctamente.`);
    } catch (err) {
      if (!popup.closed) popup.close();
      setErrorMessage(err instanceof Error ? err.message : 'Error desconocido al conectar');
    } finally {
      setConnectingService(null);
    }
  };

  const handleDisconnect = async (service: IntegrationServiceId) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setDisconnectingService(service);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Tu sesión expiró. Te estamos redirigiendo al login — volvé a intentar después.');
      await disconnectIntegration(service, token);
      await refreshStatuses();
      setSuccessMessage(`${service === 'outlook' ? 'Microsoft Outlook' : 'Jira'} desconectado.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al desconectar');
    } finally {
      setDisconnectingService(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-16">
      <div className="ck-container max-w-3xl pt-10">

        {/* Header — design system */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <span className="ck-pill mb-3">
            <Plug className="size-3" />
            <span className="ck-mono text-[11px] tracking-wider text-ink-2">
              INTEGRACIONES
            </span>
          </span>
          <h1 className="ck-display text-[40px] leading-tight">
            Conectores
          </h1>
          <p className="text-base text-ink-muted mt-2">
            Conecta tus cuentas para que los agentes puedan actuar en tu nombre.
          </p>
        </motion.div>

        {/* Mensajes de estado */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
          >
            <XCircle size={16} className="flex-shrink-0 mt-0.5" />
            {errorMessage}
          </motion.div>
        )}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700"
          >
            <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
            {successMessage}
          </motion.div>
        )}

        {/* Conectores disponibles */}
        <section className="mb-10">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
            Disponibles
          </h2>

          {loadingStatuses ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-gray-300" />
            </div>
          ) : (
            <div className="space-y-4">
              {CONNECTORS.map((connector, i) => {
                const status = getStatus(connector.id);
                const isConnected = status.status === 'connected';
                const isExpired = status.status === 'expired';
                const isConnecting = connectingService === connector.id;
                const isDisconnecting = disconnectingService === connector.id;

                return (
                  <motion.div
                    key={connector.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    {/* Card header */}
                    <div className="p-5 flex items-start gap-4">
                      {/* Icon */}
                      <div
                        className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isConnected
                            ? 'bg-green-50 text-green-600'
                            : `${connector.bgColor} ${connector.color}`
                        }`}
                      >
                        {connector.icon}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-plataforma-gris-oscuro text-base leading-tight">
                            {connector.name}
                          </h3>
                          <span className="text-[10px] text-gray-400">{connector.provider}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              isConnected
                                ? 'bg-green-500/10 text-green-600'
                                : isExpired
                                ? 'bg-yellow-500/10 text-yellow-600'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {isConnected ? 'Conectado' : isExpired ? 'Expirado' : 'Desconectado'}
                          </span>
                        </div>

                        <p className="text-sm text-gray-500 mt-1 leading-snug">
                          {connector.description}
                        </p>

                        {/* Fecha de conexión */}
                        {isConnected && status.connected_at && (
                          <div className="flex items-center gap-1 mt-1.5 text-[11px] text-gray-400">
                            <Clock size={11} />
                            <span>Conectado el {formatDate(status.connected_at)}</span>
                          </div>
                        )}
                      </div>

                      {/* Acción */}
                      <div className="flex-shrink-0 ml-2">
                        {isConnected ? (
                          <button
                            onClick={() => handleDisconnect(connector.id)}
                            disabled={isDisconnecting}
                            className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {isDisconnecting ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                Desconectando...
                              </>
                            ) : (
                              'Desconectar'
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConnect(connector.id)}
                            disabled={isConnecting}
                            className="px-4 py-2 bg-plataforma-gris-oscuro text-white rounded-xl text-xs font-bold hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {isConnecting ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                Conectando...
                              </>
                            ) : (
                              <>
                                Conectar
                                <ChevronRight size={12} />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Capacidades */}
                    <div className="px-5 pb-4 border-t border-gray-50 pt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                        Permisos que se solicitarán
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {connector.capabilities.map(cap => (
                          <div
                            key={cap.label}
                            className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg"
                          >
                            <CheckCircle2
                              size={13}
                              className={`mt-0.5 flex-shrink-0 ${
                                isConnected ? 'text-green-500' : 'text-gray-300'
                              }`}
                            />
                            <div>
                              <p className="text-xs font-semibold text-gray-700 leading-tight">
                                {cap.label}
                              </p>
                              <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                                {cap.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* Próximamente */}
        <section className="mb-10">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
            Próximamente
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COMING_SOON.map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="bg-white rounded-2xl border border-dashed border-gray-200 p-4 flex items-start gap-3 opacity-60"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-600">{item.name}</p>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 text-[9px] font-bold rounded uppercase tracking-wider">
                      Pronto
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Footer de seguridad */}
        <div className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-gray-100 text-xs text-gray-500">
          <ShieldCheck size={18} className="text-plataforma-turquesa flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-700 mb-0.5">Seguridad y privacidad</p>
            <p>
              Tus credenciales OAuth se almacenan cifradas con AES-256-GCM en el backend y nunca se
              exponen al frontend. Puedes desconectar cualquier servicio en cualquier momento y los
              tokens serán eliminados permanentemente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectorsPage;
