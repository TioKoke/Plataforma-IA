import { useState } from "react";
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, BookmarkPlus, Mail } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface MessageActionsProps {
  content: string;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  onSaveNote?: (content: string) => void;
  onEmail?: (content: string) => void;
}

interface SavedNote {
  id: string;
  content: string;
  savedAt: string;
}

const NOTES_STORAGE_KEY = "plataforma-ia:notes";

const defaultSaveNote = (content: string) => {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    const notes: SavedNote[] = raw ? JSON.parse(raw) : [];
    notes.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content,
      savedAt: new Date().toISOString(),
    });
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch (err) {
    console.warn("No se pudo guardar la nota:", err);
  }
};

const defaultEmail = (content: string) => {
  const body = encodeURIComponent(content.slice(0, 1800));
  const subject = encodeURIComponent("Respuesta Plataforma IA");
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
};

export default function MessageActions({
  content,
  onRegenerate,
  isRegenerating = false,
  onSaveNote,
  onEmail,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const btnBase =
    "p-1.5 rounded-md transition-colors duration-150 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plataforma-naranja focus-visible:ring-offset-1 " +
    "disabled:opacity-40 disabled:cursor-not-allowed";

  const neutralBtn =
    `${btnBase} text-slate-400 hover:text-plataforma-naranja hover:bg-plataforma-naranja/10`;

  return (
    <div className="flex items-center gap-0.5 -mt-0.5 ml-2" role="toolbar" aria-label="Acciones del mensaje">
      <Tooltip content={copied ? "Copiado" : "Copiar"}>
        <button
          onClick={handleCopy}
          aria-label={copied ? "Mensaje copiado" : "Copiar mensaje"}
          className={neutralBtn}
        >
          {copied ? (
            <Check size={14} className="text-plataforma-verde-oscuro" aria-hidden="true" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
        </button>
      </Tooltip>

      {onRegenerate && (
        <Tooltip content="Regenerar respuesta">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            aria-label="Regenerar respuesta"
            className={neutralBtn}
          >
            <RefreshCw
              size={14}
              className={isRegenerating ? "animate-spin" : ""}
              aria-hidden="true"
            />
          </button>
        </Tooltip>
      )}

      <Tooltip content={saved ? "Nota guardada" : "Guardar como nota"}>
        <button
          onClick={() => {
            (onSaveNote ?? defaultSaveNote)(content);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
          aria-label={saved ? "Nota guardada" : "Guardar como nota"}
          className={neutralBtn}
        >
          {saved ? (
            <Check size={14} className="text-plataforma-verde-oscuro" aria-hidden="true" />
          ) : (
            <BookmarkPlus size={14} aria-hidden="true" />
          )}
        </button>
      </Tooltip>

      <Tooltip content="Enviar por correo">
        <button
          onClick={() => (onEmail ?? defaultEmail)(content)}
          aria-label="Enviar por correo"
          className={neutralBtn}
        >
          <Mail size={14} aria-hidden="true" />
        </button>
      </Tooltip>

      <Separator orientation="vertical" className="h-4 mx-0.5" />

      <Tooltip content="Respuesta útil">
        <button
          onClick={() => setFeedback(feedback === "up" ? null : "up")}
          aria-label="Marcar como respuesta útil"
          aria-pressed={feedback === "up"}
          className={
            feedback === "up"
              ? `${btnBase} text-emerald-600 bg-emerald-500/15`
              : `${btnBase} text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10`
          }
        >
          <ThumbsUp size={14} aria-hidden="true" />
        </button>
      </Tooltip>

      <Tooltip content="Respuesta no útil">
        <button
          onClick={() => setFeedback(feedback === "down" ? null : "down")}
          aria-label="Marcar como respuesta no útil"
          aria-pressed={feedback === "down"}
          className={
            feedback === "down"
              ? `${btnBase} text-red-600 bg-red-500/15`
              : `${btnBase} text-red-500 hover:text-red-600 hover:bg-red-500/10`
          }
        >
          <ThumbsDown size={14} aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  );
}
