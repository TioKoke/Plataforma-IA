import React, { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorMessageBubbleProps {
  content: string;
  retryAfter?: number | null;
  isRetryable?: boolean;
  onRetry?: () => void;
}

export const ErrorMessageBubble: React.FC<ErrorMessageBubbleProps> = ({
  content,
  retryAfter = null,
  isRetryable = true,
  onRetry,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(() => retryAfter ?? 0);

  useEffect(() => {
    if (!retryAfter || retryAfter <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [retryAfter]);

  const isCountingDown = secondsLeft > 0;
  const retryButtonText = isCountingDown
    ? `Reintentar en ${secondsLeft}s`
    : "Reintentar";

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-xs lg:max-w-md bg-amber-50 border border-amber-200 rounded-lg p-3 shadow-sm">
        {/* Encabezado con ícono */}
        <div className="flex items-start gap-2 mb-2">
          <AlertTriangle
            size={18}
            className="text-amber-600 mt-0.5 flex-shrink-0"
          />
          <p className="text-sm text-gray-700 flex-1">{content}</p>
        </div>

        {/* Botón de reintentar */}
        {isRetryable && onRetry && (
          <button
            onClick={onRetry}
            disabled={isCountingDown}
            className={`text-sm font-medium rounded px-3 py-1.5 mt-2 transition-colors ${
              isCountingDown
                ? "bg-amber-100 text-amber-600 cursor-not-allowed opacity-70"
                : "bg-amber-200 text-amber-800 hover:bg-amber-300 active:bg-amber-400"
            }`}
          >
            {retryButtonText}
          </button>
        )}
      </div>
    </div>
  );
};
