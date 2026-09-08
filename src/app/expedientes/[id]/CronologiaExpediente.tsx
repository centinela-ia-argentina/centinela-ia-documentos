import { formatPlazoDate } from '@/lib/format/date';
import { Badge } from '@/components/ui/Badge';
import { pluralHito } from '@/lib/format/pluralize';
import type { IndustryType } from '@/lib/industries/documentTypes';

export type ItemCronologia = {
  fecha: string;
  titulo: string;
  detalle?: string | null;
  origen: 'actuacion' | 'detectada' | 'documento' | 'agenda';
  etiquetaOrigen: string;
  esFuturo: boolean;
};

const ORIGEN_TONE: Record<string, 'accent' | 'neutral' | 'success' | 'warning'> = {
  actuacion: 'accent',
  detectada: 'success',
  documento: 'neutral',
  agenda: 'warning',
};

const ORIGEN_DOT: Record<string, string> = {
  actuacion: 'bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.6)]',
  detectada: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
  documento: 'bg-slate-400',
  agenda: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]',
};

export function CronologiaExpediente({
  items,
  titulo = 'Cronología',
  industry = 'legal',
}: {
  items: ItemCronologia[];
  titulo?: string;
  industry?: IndustryType;
}) {
  const isImmo = industry === 'inmobiliaria';
  const isEscr = industry === 'escribania';

  const origenIcon: Record<string, string> = {
    actuacion: isImmo ? '📍' : isEscr ? '✒️' : '⚖️',
    detectada: '🤖',
    documento: '📄',
    agenda: '📌',
  };

  const emptyText = isImmo
    ? 'Todavía no hay fechas para mostrar. Se irá armando sola con los movimientos, las fechas detectadas por la IA en los documentos y las cargas de archivos.'
    : isEscr
    ? 'Todavía no hay fechas para mostrar. Se irá armando sola con los hitos notariales, las fechas detectadas por la IA en los documentos y las cargas de archivos.'
    : 'Todavía no hay fechas para mostrar. Se irá armando sola con las actuaciones, las fechas detectadas por la IA en los documentos y las cargas de archivos.';

  const subtituloText = isImmo
    ? 'Todas las fechas de la operación unificadas y ordenadas: movimientos, fechas detectadas por la IA y cargas de documentos.'
    : isEscr
    ? 'Todas las fechas del legajo unificadas y ordenadas: hitos notariales, fechas detectadas por la IA y cargas de documentos.'
    : 'Todas las fechas del expediente unificadas y ordenadas: actuaciones, fechas detectadas por la IA y cargas de documentos.';

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="font-display text-lg font-semibold text-white">{titulo}</h2>
        <p className="mt-2 text-sm text-slate-400">{emptyText}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-display text-lg font-semibold text-white">{titulo}</h2>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-400">{pluralHito(items.length)}</span>
      </div>
      <p className="mb-5 text-sm text-slate-400">{subtituloText}</p>

      <ol className="relative space-y-5 border-l border-white/10 pl-6">
        {items.map((it, i) => {
          const tone = ORIGEN_TONE[it.origen] ?? 'neutral';
          const dot = ORIGEN_DOT[it.origen] ?? ORIGEN_DOT.documento;
          const icon = origenIcon[it.origen] ?? origenIcon.documento;

          return (
            <li key={i} className="relative">
              <span className={`absolute -left-[1.72rem] top-1 h-3 w-3 rounded-full ring-4 ring-[#0a1830] ${dot}`} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-white">{formatPlazoDate(it.fecha)}</span>
                <Badge tone={tone}>{icon} {it.etiquetaOrigen}</Badge>
                {it.esFuturo && (
                  <Badge tone="warning">Próxima</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-300">{it.titulo}</p>
              {it.detalle && <p className="mt-0.5 text-sm text-slate-500">{it.detalle}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
