import { useState, type ReactNode } from 'react';
import { Maximize2, Download, Loader2 } from 'lucide-react';
import { useGenerateImage } from 'recharts-to-png';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

/**
 * Descarga un data URL como archivo, sin pasar por `fetch`. Necesario porque
 * la CSP de la app define `connect-src 'self' azurecontainerapps.io ...` y
 * **no** incluye `data:`; `file-saver` internamente hace fetch del data URL
 * antes de descargarlo, lo que viola CSP. Un anchor `<a download>` directo
 * evita esa transición y respeta CSP.
 */
function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Hook que devuelve un ref a colocar en el wrapper del chart y un handler
 * para descargar ese wrapper como PNG. Implementado sobre `recharts-to-png`,
 * que abstrae html2canvas para SVGs de Recharts (foreignObject + tooltips).
 */
export function useChartImageDownload(filename: string) {
  const [isDownloading, setIsDownloading] = useState(false);
  // El typing estricto de `options` (Html2Canvas WindowOptions) exige campos
  // como scrollX/scrollY/windowWidth/windowHeight; los pasamos vía cast para
  // mantener configurables solo `backgroundColor` y `scale` (resolución 2x
  // mejora nitidez al pegar el PNG en presentaciones o documentos).
  const [getPng, { ref }] = useGenerateImage<HTMLDivElement>({
    quality: 1.0,
    type: 'image/png',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: { backgroundColor: '#ffffff', scale: 2 } as any,
  });

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const png = await getPng();
      if (png) {
        downloadDataUrl(png, filename.endsWith('.png') ? filename : `${filename}.png`);
      }
    } catch (err) {
      console.error('Error generando PNG del chart', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return { ref, handleDownload, isDownloading };
}

/** Botones flotantes (expand + download) en la esquina superior derecha del chart. */
export function ChartActionsBar({
  onExpand,
  onDownload,
  isDownloading,
  className,
}: {
  onExpand?: () => void;
  onDownload?: () => void;
  isDownloading?: boolean;
  className?: string;
}) {
  if (!onExpand && !onDownload) return null;
  return (
    <div
      className={[
        'flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity',
        className ?? '',
      ].join(' ')}
    >
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          aria-label="Descargar como imagen"
          title="Descargar como imagen PNG"
          className="rounded-md p-1.5 bg-white/80 backdrop-blur text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-plataforma-azul shadow-sm"
        >
          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </button>
      )}
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          aria-label="Expandir"
          title="Expandir"
          className="rounded-md p-1.5 bg-white/80 backdrop-blur text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-plataforma-azul shadow-sm"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Wrapper que provee botones de expand + download. Pone el ref de descarga
 * en su propio `<div>` interior, así el caller solo pasa el contenido.
 *
 * Al hacer expand, abre un Dialog full-screen con `expandedContent` (idealmente
 * el mismo chart con altura mayor — el ancho extra resuelve overlaps de labels).
 */
export function ExpandableChartWrapper({
  title,
  description,
  filename,
  children,
  expandedContent,
  className,
  actionsClassName,
}: {
  title: string;
  description?: string;
  filename: string;
  /** Chart en tamaño normal (lo que se descarga como imagen). */
  children: ReactNode;
  /** Chart en tamaño expandido (modal). */
  expandedContent: ReactNode;
  className?: string;
  actionsClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { ref, handleDownload, isDownloading } = useChartImageDownload(filename);

  return (
    <>
      <div className={['group relative', className ?? ''].join(' ')}>
        <ChartActionsBar
          onExpand={() => setIsOpen(true)}
          onDownload={handleDownload}
          isDownloading={isDownloading}
          className={['absolute right-2 top-2 z-10', actionsClassName ?? ''].join(' ')}
        />
        <div ref={ref}>{children}</div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[1200px] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {/*
            Altura concreta calculada (no `flex-1` con `h-full`) para que
            ResponsiveContainer reciba dimensiones reales en píxeles. Recharts
            falla con width=-1/height=-1 cuando algún ancestro no resuelve la
            altura — `calc(70vh - …)` evita esa cadena rota.
          */}
          <div className="h-[calc(70vh-100px)] min-h-[400px]">{expandedContent}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
