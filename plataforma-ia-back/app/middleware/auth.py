"""
Middleware de autenticación.

Por defecto valida tokens JWT firmados por Microsoft Entra ID y verifica roles
de aplicación. Cuando `DEMO_AUTH` está activo (modo demo), omite toda la
validación e inyecta un usuario Admin simulado — útil para desplegar la app
como demo sin un tenant de Azure AD.
"""
import asyncio
import os
import time
import httpx
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from app.config import config

# `os.getenv` en vez de `os.environ[...]`: el módulo debe importar sin crashear
# aunque falten las variables de Azure AD (p.ej. en modo demo o en local).
TENANT_ID = os.getenv("AZURE_TENANT_ID", "")
CLIENT_ID = os.getenv("AZURE_CLIENT_ID", "")
JWKS_URL = f"https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys"

# Payload simulado para el modo demo — usuario Admin.
_DEMO_PAYLOAD: dict = {
    "roles": ["Admin"],
    "oid": "demo-user",
    "sub": "demo-user",
    "name": "Usuario Demo",
    "upn": "demo@plataforma-ia.example",
    "preferred_username": "demo@plataforma-ia.example",
    "tid": TENANT_ID,
}

# Issuers válidos de Azure AD para nuestro tenant. Aceptamos ambos formatos
# (v2.0 y v1.0) porque dependen del `accessTokenAcceptedVersion` del app
# registration. Validar `iss` es defensa en profundidad sobre el chequeo de
# `tid` — bloquea tokens emitidos por endpoints "vecinos" no estándar.
ALLOWED_ISSUERS: frozenset[str] = frozenset({
    f"https://login.microsoftonline.com/{TENANT_ID}/v2.0",
    f"https://sts.windows.net/{TENANT_ID}/",
})

# Dominios de email corporativos autorizados (AUTH-002)
_raw_domains = os.environ.get("ALLOWED_EMAIL_DOMAINS", "plataforma-ia.example,contratistas.plataforma-ia.example,plataforma-ia.example")
ALLOWED_EMAIL_DOMAINS: frozenset[str] = frozenset(
    d.strip().lower() for d in _raw_domains.split(",") if d.strip()
)

security = HTTPBearer(auto_error=False)

# Cache en memoria para las claves públicas de Azure AD.
# Azure rota las claves de firma periódicamente (~24h). Sin TTL, el backend
# rechaza tokens nuevos con `kid` rotado hasta el próximo redeploy y nunca se
# entera de claves revocadas. Refresco cada 1h, o on-demand si el `kid` del
# token no está en cache.
_JWKS_TTL_SECONDS = 3600
_jwks_cache: dict = {}
_jwks_last_fetch: float = 0.0
_jwks_lock = asyncio.Lock()


async def _get_jwks(force_refresh: bool = False) -> dict:
    """Retorna el JWKS cacheado, refrescando si expiró o si se fuerza."""
    global _jwks_cache, _jwks_last_fetch
    now = time.monotonic()
    if not force_refresh and _jwks_cache and (now - _jwks_last_fetch) < _JWKS_TTL_SECONDS:
        return _jwks_cache
    # Lock evita N requests concurrentes al endpoint de Microsoft cuando expira
    # la cache o múltiples requests llegan en cold start.
    async with _jwks_lock:
        now = time.monotonic()
        if not force_refresh and _jwks_cache and (now - _jwks_last_fetch) < _JWKS_TTL_SECONDS:
            return _jwks_cache
        async with httpx.AsyncClient() as client:
            response = await client.get(JWKS_URL)
            response.raise_for_status()
            _jwks_cache = response.json()
            _jwks_last_fetch = now
        return _jwks_cache


async def decode_token_string(token: str | None) -> dict:
    """
    Valida la firma de un ID token Azure AD (raw string) y retorna el payload.
    Usable desde WebSocket donde no hay HTTPAuthorizationCredentials.

    En modo demo (`DEMO_AUTH`) retorna directamente un usuario Admin simulado.
    """
    if config.DEMO_AUTH:
        return dict(_DEMO_PAYLOAD)

    if not token:
        raise HTTPException(status_code=401, detail="Token de autenticación requerido")

    decode_kwargs = dict(
        algorithms=["RS256"],
        audience=CLIENT_ID,
        options={"verify_at_hash": False},
    )
    try:
        payload = jwt.decode(token, await _get_jwks(), **decode_kwargs)
    except JWTError as e:
        # Si la firma falla porque el `kid` rotó antes del TTL, recarga JWKS una
        # vez y reintenta. Otros JWTError (audience, exp, etc.) no se reintentan.
        msg = str(e).lower()
        if "key" in msg or "signature" in msg:
            try:
                payload = jwt.decode(token, await _get_jwks(force_refresh=True), **decode_kwargs)
            except JWTError as e2:
                raise HTTPException(status_code=401, detail=f"Token inválido: {str(e2)}")
        else:
            raise HTTPException(status_code=401, detail=f"Token inválido: {str(e)}")

    # Validar `iss` explícitamente. Defensa en profundidad sobre `tid`.
    if payload.get("iss") not in ALLOWED_ISSUERS:
        raise HTTPException(status_code=401, detail="Emisor del token no autorizado")

    # Validar que el token fue emitido por el tenant corporativo de Plataforma IA (AUTH-002)
    if payload.get("tid") != TENANT_ID:
        raise HTTPException(status_code=403, detail="Cuenta no pertenece al directorio corporativo de Plataforma IA")

    # Bloquear cuentas B2B guest: acct=0 → miembro, acct=1 → invitado externo (AUTH-002)
    if payload.get("acct") == 1:
        raise HTTPException(status_code=403, detail="Cuentas de invitado externo no están autorizadas")

    # Validar dominio de email corporativo (AUTH-002)
    upn = payload.get("upn", payload.get("preferred_username", "")).lower()
    if upn and not any(upn.endswith(f"@{domain}") for domain in ALLOWED_EMAIL_DOMAINS):
        raise HTTPException(status_code=403, detail="Dominio de email no autorizado para acceder a la plataforma")

    return payload


async def _decode_token(credentials: HTTPAuthorizationCredentials | None) -> dict:
    """Valida la firma del ID token de Azure AD y retorna el payload (HTTP)."""
    if config.DEMO_AUTH:
        return dict(_DEMO_PAYLOAD)
    if not credentials:
        raise HTTPException(status_code=401, detail="Token de autenticación requerido")
    return await decode_token_string(credentials.credentials)


async def require_admin(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """Requiere rol Admin."""
    payload = await _decode_token(credentials)
    if "Admin" not in payload.get("roles", []):
        raise HTTPException(status_code=403, detail="Se requiere rol Admin")
    return payload


async def require_reviewer_or_admin(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """Requiere rol Reviewer o Admin."""
    payload = await _decode_token(credentials)
    roles: list[str] = payload.get("roles", [])
    if not {"Reviewer", "Admin"}.intersection(roles):
        raise HTTPException(status_code=403, detail="Se requiere rol Reviewer o Admin")
    return payload


async def require_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """Valida cualquier usuario autenticado (sin rol específico)."""
    return await _decode_token(credentials)
