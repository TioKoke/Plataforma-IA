/**
 * Clase para errores tipados del servicio de IA
 * Contiene toda la información necesaria para mostrar un error amigable al usuario
 */

export type ErrorType = "rate_limit" | "connection" | "model" | "overload" | "unknown";

export interface AIErrorResponse {
  error_type: ErrorType;
  user_message: string;
  retry_after?: number | null;
  is_retryable: boolean;
}

export class AIError extends Error {
  public readonly errorType: ErrorType;
  public readonly userMessage: string;
  public readonly retryAfter: number | null;
  public readonly isRetryable: boolean;
  public readonly httpStatusCode: number;

  constructor(
    userMessage: string,
    errorType: ErrorType = "unknown",
    retryAfter: number | null = null,
    isRetryable: boolean = true,
    httpStatusCode: number = 500,
  ) {
    super(userMessage);
    this.name = "AIError";
    this.userMessage = userMessage;
    this.errorType = errorType;
    this.retryAfter = retryAfter;
    this.isRetryable = isRetryable;
    this.httpStatusCode = httpStatusCode;
  }

  /**
   * Crea un AIError a partir de una respuesta de error del backend
   */
  static fromResponse(
    response: AIErrorResponse,
    httpStatusCode: number,
  ): AIError {
    return new AIError(
      response.user_message,
      response.error_type,
      response.retry_after ?? null,
      response.is_retryable,
      httpStatusCode,
    );
  }

  /**
   * Crea un AIError genérico para errores desconocidos
   */
  static generic(): AIError {
    return new AIError(
      "Algo salió mal. Por favor intenta de nuevo en un momento.",
      "unknown",
      null,
      true,
      500,
    );
  }
}
