"""
Router de integraciones OAuth (Outlook, Jira).
Maneja flujos de autorización, callbacks, estado y desconexión.
"""
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse

from app.config import config, get_logger
from app.middleware.auth import require_user
from app.services.integration_service import integration_service
from app.services.outlook_service import outlook_service
from app.services.jira_service import jira_service, JiraService

logger = get_logger("integrations")

router = APIRouter(prefix="/integrations", tags=["integrations"])


# Las integraciones OAuth requieren credenciales que no existen en el demo.
# Cuando faltan, los endpoints de conexión degradan a un 503 controlado en vez
# de devolver una URL de autorización rota o un 500.
_OUTLOOK_CONFIGURED = bool(config.AZURE_CLIENT_ID and config.AZURE_CLIENT_SECRET and config.AZURE_TENANT_ID)
_JIRA_CONFIGURED = bool(config.JIRA_CLIENT_ID and config.JIRA_CLIENT_SECRET)


def _require_configured(service: str, configured: bool) -> None:
    if not configured:
        raise HTTPException(
            status_code=503,
            detail=f"La integración '{service}' no está configurada en este entorno (modo demo).",
        )


# ── Status ───────────────────────────────────────────────────────

@router.get("/status")
async def get_all_statuses(payload: dict = Depends(require_user)):
    """Get connection status for all integrations."""
    user_email = payload.get("upn", payload.get("preferred_username", ""))
    statuses = integration_service.get_all_statuses(user_email)
    return {"integrations": statuses}


# ── Outlook OAuth flow ───────────────────────────────────────────

@router.get("/outlook/auth-url")
async def get_outlook_auth_url(payload: dict = Depends(require_user)):
    """Generate Microsoft OAuth authorization URL."""
    _require_configured("outlook", _OUTLOOK_CONFIGURED)
    user_email = payload.get("upn", payload.get("preferred_username", ""))
    state = secrets.token_urlsafe(32)

    # Store state for CSRF validation
    integration_service.store_oauth_state(
        state=state,
        user_email=user_email,
        service="outlook",
    )

    auth_url = outlook_service.get_authorization_url(state)
    return {"auth_url": auth_url}


@router.get("/outlook/callback")
async def outlook_callback(
    code: str = Query(...),
    state: str = Query(...),
):
    """
    Handle Microsoft OAuth callback.
    Exchanges code for tokens, encrypts and stores them.
    Returns HTML that notifies the opener window and closes the popup.
    """
    # Validate state (CSRF protection)
    state_doc = integration_service.consume_oauth_state(state)
    if not state_doc or state_doc.get("service") != "outlook":
        return _error_html("Estado OAuth inválido o expirado. Intenta conectar de nuevo.")

    user_email = state_doc["user_email"]

    try:
        # Exchange code for tokens
        token_data = await outlook_service.exchange_code(code)

        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token", "")
        expires_in = token_data.get("expires_in", 3600)
        scopes = token_data.get("scope", "").split()

        # Validate token by fetching user profile
        profile = await outlook_service.get_user_profile(access_token)
        logger.info(f"Outlook conectado para: {profile.get('mail', user_email)}")

        # Store encrypted tokens
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        integration_service.store_tokens(
            user_email=user_email,
            service="outlook",
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            scopes=scopes,
        )

        return _success_html("outlook")

    except Exception as e:
        logger.error(f"Error en Outlook OAuth callback: {e}")
        return _error_html(f"Error al conectar Outlook: {str(e)}")


# ── Jira OAuth flow ──────────────────────────────────────────────

@router.get("/jira/auth-url")
async def get_jira_auth_url(payload: dict = Depends(require_user)):
    """Generate Atlassian OAuth authorization URL with PKCE."""
    _require_configured("jira", _JIRA_CONFIGURED)
    user_email = payload.get("upn", payload.get("preferred_username", ""))
    state = secrets.token_urlsafe(32)
    code_verifier, code_challenge = JiraService.generate_pkce()

    # Store state + code_verifier for callback
    integration_service.store_oauth_state(
        state=state,
        user_email=user_email,
        service="jira",
        code_verifier=code_verifier,
    )

    auth_url = jira_service.get_authorization_url(state, code_challenge)
    return {"auth_url": auth_url}


@router.get("/jira/callback")
async def jira_callback(
    code: str = Query(...),
    state: str = Query(...),
):
    """
    Handle Atlassian OAuth callback.
    Exchanges code for tokens with PKCE, discovers cloud_id, stores tokens.
    """
    # Validate state (CSRF protection)
    state_doc = integration_service.consume_oauth_state(state)
    if not state_doc or state_doc.get("service") != "jira":
        return _error_html("Estado OAuth inválido o expirado. Intenta conectar de nuevo.")

    user_email = state_doc["user_email"]
    code_verifier = state_doc.get("code_verifier", "")

    try:
        # Exchange code for tokens (with PKCE)
        token_data = await jira_service.exchange_code(code, code_verifier)

        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token", "")
        expires_in = token_data.get("expires_in", 3600)
        scopes = token_data.get("scope", "").split()

        # Discover accessible Jira sites to get cloud_id
        resources = await jira_service.get_accessible_resources(access_token)
        if not resources:
            return _error_html("No se encontraron sitios Jira accesibles con esta cuenta.")

        # Use the first accessible site
        site = resources[0]
        cloud_id = site["id"]
        site_url = site.get("url", "")

        logger.info(f"Jira conectado para: {user_email} -> {site.get('name', cloud_id)}")

        # Store encrypted tokens with Jira metadata
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        integration_service.store_tokens(
            user_email=user_email,
            service="jira",
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            scopes=scopes,
            metadata={
                "cloud_id": cloud_id,
                "site_url": site_url,
                "site_name": site.get("name", ""),
            },
        )

        return _success_html("jira")

    except Exception as e:
        logger.error(f"Error en Jira OAuth callback: {e}")
        return _error_html(f"Error al conectar Jira: {str(e)}")


# ── Disconnect ───────────────────────────────────────────────────

@router.delete("/{service}/disconnect")
async def disconnect_service(
    service: str,
    payload: dict = Depends(require_user),
):
    """Remove stored tokens and disconnect a service."""
    user_email = payload.get("upn", payload.get("preferred_username", ""))
    deleted = integration_service.disconnect(user_email, service)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Integración '{service}' no encontrada")
    return {"message": f"{service} desconectado exitosamente"}


# ── HTML helpers for OAuth popups ────────────────────────────────

def _success_html(service: str) -> HTMLResponse:
    """Return HTML that notifies the opener and closes the popup."""
    html = f"""<!DOCTYPE html>
<html><head><title>Conectado</title></head>
<body>
<p>Conectado exitosamente. Esta ventana se cerrará automáticamente...</p>
<script>
  if (window.opener) {{
    window.opener.postMessage({{ type: '{service}-oauth-success' }}, '{config.FRONTEND_URL}');
  }}
  setTimeout(() => window.close(), 1500);
</script>
</body></html>"""
    return HTMLResponse(content=html)


def _error_html(message: str) -> HTMLResponse:
    """Return HTML showing an error in the OAuth popup."""
    html = f"""<!DOCTYPE html>
<html><head><title>Error</title></head>
<body>
<p style="color:red;">{message}</p>
<p>Puedes cerrar esta ventana e intentar de nuevo.</p>
<script>
  if (window.opener) {{
    window.opener.postMessage({{ type: 'oauth-error', message: '{message}' }}, '{config.FRONTEND_URL}');
  }}
</script>
</body></html>"""
    return HTMLResponse(content=html)
