/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus, InteractionRequiredAuthError } from '@azure/msal-browser';
import { loginRequest, silentRequest } from '../config/msalConfig';

export type AppRole = 'User' | 'Reviewer' | 'Admin';

// Dominios corporativos autorizados (AUTH-002)
const ALLOWED_EMAIL_DOMAINS: string[] = (
  import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS ?? 'plataforma-ia.example,contratistas.plataforma-ia.example,plataforma-ia.example'
).split(',').map((d: string) => d.trim().toLowerCase());

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  roles: AppRole[];
  isAdmin: boolean;
  isReviewer: boolean;
  userEmail: string | null;
  userName: string | null;
  userDivision: string | null;
  userJobTitle: string | null;
  userPhoto: string | null;
  isUnauthorizedAccount: boolean;
  login: () => Promise<void>;
  logout: () => void;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Modo demo: omite MSAL por completo e inyecta un usuario Admin simulado.
const DEMO_AUTH = import.meta.env.VITE_DEMO_AUTH === 'true';

// Contexto fijo usado en modo demo.
const DEMO_CONTEXT: AuthContextType = {
  isAuthenticated: true,
  isLoading: false,
  roles: ['Admin'],
  isAdmin: true,
  isReviewer: true,
  userEmail: 'demo@plataforma-ia.example',
  userName: 'Usuario Demo',
  userDivision: null,
  userJobTitle: null,
  userPhoto: null,
  isUnauthorizedAccount: false,
  login: async () => {},
  logout: () => {},
  getIdToken: async () => 'demo-token',
};

function DemoAuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={DEMO_CONTEXT}>{children}</AuthContext.Provider>;
}

/**
 * Provider de autenticación. En modo demo entrega un usuario Admin simulado;
 * en modo normal usa la implementación MSAL/Entra ID completa.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (DEMO_AUTH) {
    return <DemoAuthProvider>{children}</DemoAuthProvider>;
  }
  return <MsalAuthProvider>{children}</MsalAuthProvider>;
}

function MsalAuthProvider({ children }: { children: ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const isLoading = inProgress !== InteractionStatus.None;

  const account = accounts[0] ?? null;
  const userEmail = account?.username ?? null;
  const userName = account?.name ?? null;

  // Roles asignados en Azure AD → App roles → Enterprise Applications
  const rawRoles = ((account?.idTokenClaims as { roles?: string[] })?.roles ?? []);
  const roles = rawRoles as AppRole[];
  const isAdmin = rawRoles.some(r => r.toLowerCase() === 'admin');
  const isReviewer = rawRoles.some(r => r.toLowerCase() === 'reviewer');

  // AUTH-002: detectar cuentas B2B guest o dominio no autorizado
  const isUnauthorizedAccount = useMemo(() => {
    if (!account || !isAuthenticated) return false;
    const claims = account.idTokenClaims as { acct?: number };
    if (claims?.acct === 1) return true; // guest B2B
    const email = (account.username ?? '').toLowerCase();
    return email.length > 0 && !ALLOWED_EMAIL_DOMAINS.some(d => email.endsWith(`@${d}`));
  }, [account, isAuthenticated]);

  // Foto, división y cargo desde Microsoft Graph
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [userDivision, setUserDivision] = useState<string | null>(
    (account?.idTokenClaims as { department?: string })?.department ?? null
  );
  const [userJobTitle, setUserJobTitle] = useState<string | null>(
    (account?.idTokenClaims as { jobTitle?: string })?.jobTitle ?? null
  );

  // FIX A — Registrar cuenta activa en MSAL v5.
  // acquireTokenSilent puede operar sin pasar account explícitamente cuando hay
  // una cuenta activa registrada. MsalProvider ya llama initialize() internamente.
  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return;
    if (accounts.length > 0 && !instance.getActiveAccount()) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, inProgress, instance]);

  // FIX B — Revocar blob URL de foto para evitar memory leak.
  // URL.createObjectURL crea un objeto en memoria que persiste hasta que se revoca
  // explícitamente. El cleanup revoca el URL exacto creado en esta ejecución del efecto.
  useEffect(() => {
    if (!account || !isAuthenticated || inProgress !== InteractionStatus.None) return;

    let objectUrl: string | null = null;

    const fetchProfileData = async () => {
      try {
        const tokenResponse = await instance.acquireTokenSilent({
          ...silentRequest,
          account,
        });

        // Foto del perfil — pre-check de metadata antes del fetch binario.
        // GET /me/photo/$value retorna 404 cuando no existe foto (comportamiento
        // documentado de Microsoft Graph). Para evitar el error rojo en consola del
        // browser, primero verificamos si existe la foto con el endpoint de metadata
        // (GET /me/photo), que devuelve 404 sin body binario. Solo si existe foto
        // hacemos el fetch del binario ($value).
        const photoMetaRes = await fetch('https://graph.microsoft.com/v1.0/me/photo', {
          headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
        });
        if (photoMetaRes.ok) {
          const photoRes = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
            headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
          });
          if (photoRes.ok) {
            const blob = await photoRes.blob();
            objectUrl = URL.createObjectURL(blob);
            setUserPhoto(objectUrl);
          }
        } else {
          console.warn('[Auth] No se encontró foto de perfil en Graph — usando iniciales.');
        }

        // División y cargo desde el perfil de Graph API
        const profileRes = await fetch(
          'https://graph.microsoft.com/v1.0/me?$select=department,companyName,jobTitle',
          { headers: { Authorization: `Bearer ${tokenResponse.accessToken}` } }
        );
        if (profileRes.ok) {
          const profile = await profileRes.json();
          const division = profile.department || profile.companyName || null;
          setUserDivision(division);
          if (profile.jobTitle) setUserJobTitle(profile.jobTitle);
        }
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect({ ...silentRequest, account });
        }
        // Otros errores (sin foto, sin perfil) → fallback silencioso
      }
    };

    fetchProfileData();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [account, isAuthenticated, inProgress, instance]);

  // AUTH-002: auto-logout si la cuenta es guest o dominio no autorizado
  // AUTH-003: useRef evita que logoutRedirect se llame múltiples veces si el
  // efecto se re-ejecuta antes de que el redirect complete (ej. error de red).
  const isLoggingOutRef = useRef(false);
  useEffect(() => {
    if (!isUnauthorizedAccount || isLoading || isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    const unauthorizedAccount = instance.getActiveAccount() ?? accounts[0];
    const hint =
      (unauthorizedAccount?.idTokenClaims as { login_hint?: string })?.login_hint
      ?? unauthorizedAccount?.loginHint
      ?? unauthorizedAccount?.username;
    instance.logoutRedirect({
      account: unauthorizedAccount,
      logoutHint: hint,
      postLogoutRedirectUri: '/?error=cuenta_no_autorizada',
    });
  }, [isUnauthorizedAccount, isLoading, instance, accounts]);

  // FIX C — Referencias estables con useCallback.
  // Sin useCallback, estas funciones se recrean en cada render y disparan re-renders
  // en todos los consumidores del contexto que las tengan como dependencia de efectos.
  const login = useCallback(async () => {
    await instance.loginRedirect(loginRequest);
  }, [instance]);

  const logout = useCallback(() => {
    const activeAccount = instance.getActiveAccount() ?? accounts[0];
    const logoutHint =
      (activeAccount?.idTokenClaims as { login_hint?: string })?.login_hint
      ?? activeAccount?.loginHint
      ?? activeAccount?.username;

    instance.logoutRedirect({
      account: activeAccount,
      logoutHint,
      postLogoutRedirectUri: '/',
    });
  }, [instance, accounts]);

  // ID token firmado por Azure AD — se envía como Bearer al backend.
  // Cualquier fallo de acquireTokenSilent (InteractionRequired, monitor_window_timeout,
  // no_tokens_found, etc.) se trata como recuperable vía redirect interactivo. Antes
  // solo se manejaba InteractionRequiredAuthError, dejando los demás errores como
  // fallos silenciosos sin log — lo que producía el banner "No se pudo obtener el
  // token de autenticación" sin rastro en consola.
  const getIdToken = useCallback(async (): Promise<string | null> => {
    const activeAccount = instance.getActiveAccount() ?? accounts[0] ?? null;
    if (!activeAccount) {
      console.error('[Auth] getIdToken: sin cuenta activa');
      return null;
    }
    try {
      const response = await instance.acquireTokenSilent({ ...silentRequest, account: activeAccount });
      return response.idToken;
    } catch (error) {
      console.error('[Auth] acquireTokenSilent falló:', error);
      try {
        await instance.acquireTokenRedirect({ ...silentRequest, account: activeAccount });
      } catch (redirectErr) {
        console.error('[Auth] acquireTokenRedirect falló:', redirectErr);
      }
      return null;
    }
  }, [instance, accounts]);

  // FIX D — Memoizar el valor del contexto.
  // Sin useMemo, el objeto value se recrea en cada render de AuthProvider,
  // causando que todos los consumidores re-rendericen innecesariamente.
  const contextValue = useMemo(() => ({
    isAuthenticated,
    isLoading,
    roles,
    isAdmin,
    isReviewer,
    userEmail,
    userName,
    userDivision,
    userJobTitle,
    userPhoto,
    isUnauthorizedAccount,
    login,
    logout,
    getIdToken,
  }), [
    isAuthenticated, isLoading,
    roles, isAdmin, isReviewer,
    userEmail, userName, userDivision, userJobTitle, userPhoto,
    isUnauthorizedAccount,
    login, logout, getIdToken,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
