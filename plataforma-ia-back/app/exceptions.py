"""
Excepciones custom para el servicio de IA.
Estas excepciones mapean errores de OpenAI a tipos más legibles y amigables.
"""
from typing import Optional, Literal


class AIError(Exception):
    """Excepción base para errores del servicio de IA"""
    error_type: Literal["rate_limit", "connection", "model", "overload", "unknown"] = "unknown"
    user_message: str = "Algo salió mal. Por favor intenta de nuevo en un momento."
    retry_after: Optional[int] = None
    is_retryable: bool = True
    http_status_code: int = 500

    def __init__(
        self,
        user_message: str,
        error_type: Literal["rate_limit", "connection", "model", "overload", "unknown"] = "unknown",
        retry_after: Optional[int] = None,
        is_retryable: bool = True,
        http_status_code: int = 500,
    ):
        self.user_message = user_message
        self.error_type = error_type
        self.retry_after = retry_after
        self.is_retryable = is_retryable
        self.http_status_code = http_status_code
        super().__init__(user_message)


class AIRateLimitError(AIError):
    """Error 429: rate limit excedido"""
    def __init__(self, retry_after: int = 60):
        super().__init__(
            user_message="Estamos recibiendo muchas solicitudes. Espera un momento e intenta de nuevo.",
            error_type="rate_limit",
            retry_after=retry_after,
            is_retryable=True,
            http_status_code=429,
        )


class AIOverloadError(AIError):
    """Error 529: servicio sobrecargado"""
    def __init__(self, retry_after: int = 10):
        super().__init__(
            user_message="El asistente está muy ocupado ahora. Reintentando en unos segundos...",
            error_type="overload",
            retry_after=retry_after,
            is_retryable=True,
            http_status_code=503,
        )


class AIConnectionError(AIError):
    """Error de conexión a OpenAI"""
    def __init__(self):
        super().__init__(
            user_message="No se pudo conectar con el asistente. Verifica tu conexión e intenta de nuevo.",
            error_type="connection",
            retry_after=None,
            is_retryable=True,
            http_status_code=503,
        )


class AIModelError(AIError):
    """Error del modelo de IA (5xx, timeout, etc.)"""
    def __init__(self, retry_after: Optional[int] = None):
        super().__init__(
            user_message="Ocurrió un problema en el servicio de IA. Por favor intenta de nuevo.",
            error_type="model",
            retry_after=retry_after,
            is_retryable=True,
            http_status_code=500,
        )
