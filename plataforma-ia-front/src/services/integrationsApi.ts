const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export type IntegrationServiceId = 'outlook' | 'jira';
export type IntegrationStatusValue = 'connected' | 'disconnected' | 'expired';

export interface IntegrationStatus {
    service: IntegrationServiceId;
    status: IntegrationStatusValue;
    connected_at: string | null;
    scopes: string[];
}

export interface IntegrationsStatusResponse {
    integrations: IntegrationStatus[];
}

export async function fetchIntegrationStatuses(
    idToken: string
): Promise<IntegrationsStatusResponse> {
    const res = await fetch(`${API_URL}/integrations/status`, {
        headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    return res.json();
}

export async function getOutlookAuthUrl(idToken: string): Promise<string> {
    const res = await fetch(`${API_URL}/integrations/outlook/auth-url`, {
        headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return data.auth_url;
}

export async function getJiraAuthUrl(idToken: string): Promise<string> {
    const res = await fetch(`${API_URL}/integrations/jira/auth-url`, {
        headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return data.auth_url;
}

export async function disconnectIntegration(
    service: IntegrationServiceId,
    idToken: string
): Promise<void> {
    const res = await fetch(`${API_URL}/integrations/${service}/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}

/**
 * Abre un popup OAuth en blanco de forma SINCRÓNICA (dentro del gesto del usuario).
 * Debe llamarse antes de cualquier await para evitar que el bloqueador de popups
 * del navegador bloquee la ventana (Chrome/Firefox/Safari requieren que window.open
 * se llame en el call stack síncrono de un evento de usuario).
 */
export function openOAuthWindow(service: IntegrationServiceId): Window | null {
    const width = 600;
    const height = 720;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    return window.open(
        'about:blank',
        `${service}-oauth`,
        `width=${width},height=${height},left=${left},top=${top}`
    );
}

/**
 * Espera a que el popup OAuth complete el flujo, escuchando el postMessage
 * que envía el HTML de callback del backend.
 * Se llama DESPUÉS de navegar el popup a la URL de autenticación real.
 */
export function waitForOAuthPopup(
    popup: Window,
    service: IntegrationServiceId
): Promise<void> {
    return new Promise((resolve, reject) => {
        const successType = `${service}-oauth-success`;

        const messageHandler = (event: MessageEvent) => {
            if (!event.data || typeof event.data !== 'object') return;
            if (event.data.type === successType) {
                window.removeEventListener('message', messageHandler);
                clearInterval(pollTimer);
                resolve();
            } else if (event.data.type === 'oauth-error') {
                window.removeEventListener('message', messageHandler);
                clearInterval(pollTimer);
                reject(new Error(event.data.message || 'Error en OAuth'));
            }
        };
        window.addEventListener('message', messageHandler);

        // Detectar si el usuario cierra el popup manualmente
        const pollTimer = window.setInterval(() => {
            if (popup.closed) {
                window.removeEventListener('message', messageHandler);
                clearInterval(pollTimer);
                reject(new Error('Ventana OAuth cerrada sin completar'));
            }
        }, 500);
    });
}
