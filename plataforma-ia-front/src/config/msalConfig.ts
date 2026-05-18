import type { Configuration } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    // Tras el loginRedirect, MSAL v5 (vía MsalProvider) restaura automáticamente
    // la URL que el usuario intentaba visitar antes del redirect.
    redirectUri: window.location.origin,
  },
  cache: {
    // NOTA DE SEGURIDAD (observación QA):
    // Se usa sessionStorage intencionalmente en lugar de localStorage para que el
    // caché de tokens se limpie al cerrar la pestaña o el navegador. Esto reduce
    // el riesgo de que otra persona acceda a la sesión en equipos compartidos.
    //
    // La combinación sessionStorage + prompt:'select_account' implica que:
    // - El usuario debe seleccionar su cuenta en cada nueva sesión de navegador.
    // - Dentro de la misma pestaña, las credenciales se reutilizan de forma
    //   transparente (comportamiento estándar de SSO corporativo con Microsoft).
    //
    // Riesgo residual: si el equipo no tiene bloqueo de pantalla y la pestaña
    // queda abierta, otra persona podría acceder. Para mitigar, se puede:
    //   1. Configurar políticas de Conditional Access en Azure AD (sign-in frequency).
    //   2. Cambiar a 'memoryStorage' (caché se pierde al recargar la página).
    // Para el contexto de intranet corporativa, sessionStorage es aceptable.
    cacheLocation: 'sessionStorage',
  },
  system: {
    // Renovar tokens proactivamente 5 minutos antes de que expiren (300 seg).
    // Evita que el usuario encuentre un token expirado justo cuando hace una acción.
    // MSAL intentará acquireTokenSilent automáticamente dentro de esta ventana.
    tokenRenewalOffsetSeconds: 300,
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
  // Fuerza el selector de cuenta cada vez que el usuario inicia sesión activamente.
  // Previene la reutilización silenciosa de una sesión de otro usuario corporativo
  // en el mismo equipo. No afecta la renovación silenciosa de tokens (silentRequest).
  prompt: 'select_account',
  // AUTH-003: domain_hint dirige a Azure AD hacia el IdP federado de Plataforma IA.
  // Para cuentas no federadas con plataforma-ia.example, Azure AD muestra un error temprano
  // antes de continuar el flujo de autenticación.
  // NOTA: esto NO bloquea cuentas B2B guest ya invitadas al tenant — ese bloqueo
  // requiere una Conditional Access Policy en Entra ID (ver plan AUTH-003).
  extraQueryParameters: {
    domain_hint: 'plataforma-ia.example',
  },
};

// Usado para adquirir tokens en segundo plano sin interacción del usuario.
// Los scopes deben ser subconjunto o iguales al consentimiento otorgado en loginRequest.
export const silentRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};
