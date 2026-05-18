"""
Configuración de la aplicación.

Los secretos se leen directamente de variables de entorno (Cloud Run las
inyecta en el contenedor). No se usa Azure Key Vault.
"""
import os
import sys
import logging
from dotenv import load_dotenv

# Cargar variables de entorno desde .env. override=True hace que el .env gane
# sobre variables del shell — evita que un valor vacío residual de una sesión
# previa (p.ej. `KEY=` exportado) impida cargar el valor real del .env.
# En producción (Cloud Run) no hay .env, así que esto es no-op.
load_dotenv(override=True)

# ── Filtro de redacción de secretos en logs (M-3 pentest) ────────────────────
# Enmascara patrones sensibles antes de que el log llegue a stdout. Container
# Apps reenvía stdout a Log Analytics, donde cualquier consultor con acceso al
# workspace podría leerlos. Este filtro reduce la exposición de tokens, claves
# y connection strings que se filtraron por error en stack traces.
import re as _re

_SENSITIVE_PATTERNS = [
    # JWT (3 segmentos base64 separados por puntos, prefijo común eyJ)
    (_re.compile(r'eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}'), '***JWT-REDACTED***'),
    # Bearer header completo
    (_re.compile(r'Bearer\s+[A-Za-z0-9._-]{20,}', _re.IGNORECASE), 'Bearer ***REDACTED***'),
    # Cosmos / Storage account keys (base64 ~88 chars terminando en ==)
    (_re.compile(r'[A-Za-z0-9+/]{86,}={1,2}'), '***KEY-REDACTED***'),
    # Connection strings tipo "AccountKey=...;" o "SharedAccessSignature=..."
    (_re.compile(r'(AccountKey|SharedAccessKey|SharedAccessSignature)=[^;\s\'"]+', _re.IGNORECASE),
     r'\1=***REDACTED***'),
    # OpenAI / Anthropic API keys (sk-... y sk-ant-...)
    (_re.compile(r'sk-(?:ant-)?[A-Za-z0-9_-]{20,}'), '***API-KEY-REDACTED***'),
]


class _SecretRedactionFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
        except Exception:
            return True
        if not msg:
            return True
        redacted = msg
        for pattern, replacement in _SENSITIVE_PATTERNS:
            redacted = pattern.sub(replacement, redacted)
        if redacted is not msg:
            # Reemplazar el mensaje y limpiar args para evitar re-render
            record.msg = redacted
            record.args = None
        return True


# Configurar logging
logger = logging.getLogger("plataforma-ia")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler(stream=sys.stdout)
handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
logger.addHandler(handler)

# Aplicar el filtro de redacción a TODOS los loggers conocidos. Necesario
# porque uvicorn/fastapi configuran sus propios loggers con propagate=False
# (los records no suben al root). Especialmente crítico: `uvicorn.access`
# loggea la URL completa, incluyendo `?token=eyJ...` del WebSocket.
_redaction_filter = _SecretRedactionFilter()


def _install_redaction_filter(logger_name: str | None) -> None:
    """Agrega el filtro a un logger y a todos sus handlers existentes."""
    lg = logging.getLogger(logger_name) if logger_name else logging.getLogger()
    if not any(isinstance(f, _SecretRedactionFilter) for f in lg.filters):
        lg.addFilter(_redaction_filter)
    for h in lg.handlers:
        if not any(isinstance(f, _SecretRedactionFilter) for f in h.filters):
            h.addFilter(_redaction_filter)


# Lista de loggers conocidos que pueden registrar tokens/URLs/secretos
_KNOWN_LOGGERS = (
    None,  # raíz
    "uvicorn", "uvicorn.access", "uvicorn.error", "uvicorn.asgi",
    "fastapi", "starlette",
    "azure", "azure.identity", "azure.cosmos", "azure.storage",
    "httpx", "httpcore",
    "plataforma-ia",
)
for _name in _KNOWN_LOGGERS:
    _install_redaction_filter(_name)


# Monkey-patch logging.Logger.addHandler para que cualquier logger creado
# DESPUÉS de este import (e.g. uvicorn al arrancar más tarde) reciba el
# filtro automáticamente.
_original_addHandler = logging.Logger.addHandler


def _patched_addHandler(self: logging.Logger, hdlr: logging.Handler) -> None:
    if not any(isinstance(f, _SecretRedactionFilter) for f in hdlr.filters):
        hdlr.addFilter(_redaction_filter)
    _original_addHandler(self, hdlr)


logging.Logger.addHandler = _patched_addHandler  # type: ignore[method-assign]


def get_logger(module_name: str) -> logging.Logger:
    """
    Obtiene un logger para un módulo específico.

    Args:
        module_name: Nombre del módulo

    Returns:
        Logger configurado
    """
    return logging.getLogger(f"plataforma-ia.{module_name}")


class Config:
    """Configuración de la aplicación"""

    # LLM — endpoint HTTP externo (Anthropic Claude vía capa OpenAI-compat).
    # El código usa el SDK de `openai` apuntando a `https://api.anthropic.com/v1/`,
    # pero también funciona contra cualquier endpoint OpenAI-compatible (Foundry,
    # OpenAI, Groq, OpenRouter) cambiando solo estas dos variables.
    # El SDK nativo de Anthropic appendea `/v1/messages`. Si dejaras `/v1/`
    # acá, la URL final sería `/v1/v1/messages` → 404. El default sin sufijo
    # es lo correcto.
    ANTHROPIC_BASE_URL: str = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")

    # Model name (p.ej. claude-sonnet-4-6, claude-haiku-4-5, claude-opus-4-7).
    CHAT_MODEL: str = os.getenv("CHAT_MODEL", "claude-sonnet-4-6")
    CHAT_TEMPERATURE: float = float(os.getenv("CHAT_TEMPERATURE", "0.7"))
    CHAT_MAX_TOKENS: int = int(os.getenv("CHAT_MAX_TOKENS", "16000"))
    # Temperatura baja para specs JSON estructurados (UI components, tool calls).
    # La narrativa final usa CHAT_TEMPERATURE normal.
    CHAT_TEMPERATURE_STRUCTURED: float = float(os.getenv("CHAT_TEMPERATURE_STRUCTURED", "0.2"))

    # `reasoning_effort` para modelos base de la familia GPT-5 (gpt-5.5,
    # gpt-5.4, etc.) y la serie reasoning. Niveles soportados varían por
    # modelo:
    #   - gpt-5.5: "none" | "low" | "medium" | "high" | "xhigh"
    #   - o-series y gpt-5 más antiguos: "minimal" | "low" | "medium" | "high"
    # "none" minimiza los reasoning_tokens internos en queries triviales
    # (chat conversacional), reduciendo costo y latencia. Para análisis
    # complejos, subir a "low" o "medium". Solo aplica a modelos base — los
    # `*-chat` no soportan este parámetro y nuestro helper
    # `_supports_reasoning_effort` lo filtra.
    CHAT_REASONING_EFFORT: str = os.getenv("CHAT_REASONING_EFFORT", "none")

    # `verbosity` para gpt-5 family. Controla longitud y elaboración de la
    # respuesta. Niveles: "low" | "medium" | "high". Default "medium" en la
    # API; subimos a "high" para que las respuestas conversacionales tengan
    # estructura markdown (negritas, listas, secciones) similar a chat-tuned
    # models. Solo aplica a modelos gpt-5* y o-series; chat-tuned y otros
    # modelos lo ignoran via helper `_supports_verbosity`.
    CHAT_VERBOSITY: str = os.getenv("CHAT_VERBOSITY", "high")

    # PDF multimodal: rasteriza PDFs cortos a imágenes y los envía como
    # image_url para que el modelo razone sobre gráficos, tablas con layout
    # complejo y firmas. PDFs con más páginas que el límite se envían sólo
    # como markdown para controlar tokens.
    PDF_MULTIMODAL_ENABLED: bool = os.getenv("PDF_MULTIMODAL_ENABLED", "true").lower() in ("true", "1", "yes")
    PDF_MULTIMODAL_MAX_PAGES: int = int(os.getenv("PDF_MULTIMODAL_MAX_PAGES", "10"))

    # FastAPI Configuration
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    ALLOWED_ORIGINS: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000"
    )

    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Auth — modo demo. Cuando es True, el middleware de auth omite la
    # validación MSAL/JWT e inyecta un usuario Admin simulado.
    DEMO_AUTH: bool = os.getenv("DEMO_AUTH", "false").lower() in ("true", "1", "yes")

    # OAuth - Azure AD (confidential client para Outlook Graph API).
    # No funcional en modo demo; los endpoints degradan a "no configurado".
    AZURE_TENANT_ID: str = os.getenv("AZURE_TENANT_ID", "")
    AZURE_CLIENT_ID: str = os.getenv("AZURE_CLIENT_ID", "")
    AZURE_CLIENT_SECRET: str = os.getenv("AZURE_CLIENT_SECRET", "")
    OUTLOOK_REDIRECT_URI: str = os.getenv(
        "OUTLOOK_REDIRECT_URI", "http://localhost:8000/integrations/outlook/callback"
    )

    # OAuth - Jira (Atlassian Cloud). No funcional en modo demo.
    JIRA_CLIENT_ID: str = os.getenv("JIRA_CLIENT_ID", "")
    JIRA_CLIENT_SECRET: str = os.getenv("JIRA_CLIENT_SECRET", "")
    JIRA_REDIRECT_URI: str = os.getenv(
        "JIRA_REDIRECT_URI", "http://localhost:8000/integrations/jira/callback"
    )

    INTEGRATION_ENCRYPTION_KEY: str = os.getenv("INTEGRATION_ENCRYPTION_KEY", "")

    # Frontend URL (for OAuth popup close/redirect)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Google Cloud Storage — archivos subidos y generados.
    # En Cloud Run usa Application Default Credentials (la service account
    # asignada al servicio).
    # En local, si no está configurado, StorageService cae a disco local.
    GCS_BUCKET_NAME: str = os.getenv("GCS_BUCKET_NAME", "")
    # Solo para desarrollo local: ruta a un JSON de service account.
    GOOGLE_APPLICATION_CREDENTIALS: str = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")

    @property
    def use_gcs_storage(self) -> bool:
        """True si hay un bucket de GCS configurado."""
        return bool(self.GCS_BUCKET_NAME)

    # MongoDB (Atlas M0 en el demo)
    MONGODB_URI: str = os.getenv("MONGODB_URI", "")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "plataformaia")

    @property
    def origins_list(self) -> list[str]:
        """Convierte la cadena de orígenes permitidos en una lista"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def is_development(self) -> bool:
        """Verifica si estamos en modo desarrollo"""
        return self.ENVIRONMENT.lower() == "development"

    def validate(self) -> None:
        """Valida que la configuración esté completa"""
        if not self.ANTHROPIC_API_KEY:
            raise ValueError(
                "ANTHROPIC_API_KEY debe estar configurado en .env"
            )
        if not self.ANTHROPIC_BASE_URL:
            raise ValueError(
                "ANTHROPIC_BASE_URL debe estar configurado en .env"
            )
        logger.info("Configuracion validada correctamente")


# Instancia global de configuración
config = Config()


# Exportar configuración y funciones principales
__all__ = [
    "config",
    "get_logger"
]
