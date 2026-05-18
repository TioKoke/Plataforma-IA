import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { EventType, PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './config/msalConfig'
import './index.css'
import App from './App.tsx'

const DEMO_AUTH = import.meta.env.VITE_DEMO_AUTH === 'true';

// Modo demo: no se inicializa MSAL en absoluto. AuthProvider entrega un
// usuario Admin simulado, así que la app puede desplegarse sin un tenant
// de Azure AD.
if (DEMO_AUTH) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  const msalInstance = new PublicClientApplication(msalConfig);

  // Logger global de fallos de auth. Sin esto, errores como monitor_window_timeout
  // o no_tokens_found se tragan silenciosamente y el usuario ve banners genéricos
  // ("No se pudo obtener el token") sin que quede rastro en DevTools.
  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.ACQUIRE_TOKEN_FAILURE) {
      console.error('[MSAL]', event.eventType, event.error);
    }
  });

  // MSAL v3+ requiere inicialización explícita antes de cualquier operación
  // (acquireTokenSilent, login, etc). Sin esto, los componentes que llaman a
  // useAuth() en mount fallan con `uninitialized_public_client_application`.
  // handleRedirectPromise() procesa el resultado del flujo redirect-back, debe
  // llamarse antes de renderizar para que el state de cuenta esté listo.
  const bootstrap = async () => {
    await msalInstance.initialize();
    await msalInstance.handleRedirectPromise();

    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </StrictMode>,
    );
  };

  bootstrap().catch((err) => {
    console.error('[MSAL] Fallo en bootstrap, renderizando sin auth:', err);
    // Fallback: renderizar igual para que el usuario vea algo, no una página
    // en blanco. ProtectedRoute redirigirá a login si la sesión no está lista.
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </StrictMode>,
    );
  });
}
