import {
  CalendarBlank,
  ClockCountdown,
  FileText,
  FolderOpen,
  SealCheck,
  Signature,
} from '@phosphor-icons/react';
import type { IndustryTerms } from '@/lib/industries/uiLabels';
import type { AgendaEvento } from './AgendaClient';

export function getAgendaEventMeta(
  tipo: AgendaEvento['tipo'],
  plazoLabel: string,
  terms?: IndustryTerms,
) {
  if (tipo === 'documento') return { label: 'Documento', color: '#6FC3FF', Icon: FileText };
  if (tipo === 'firma') return { label: 'Firma', color: '#F39AAE', Icon: Signature };
  if (tipo === 'turno') return { label: 'Turno', color: '#65D6C3', Icon: CalendarBlank };
  if (tipo === 'evento') return { label: 'Recordatorio', color: '#C8FF62', Icon: SealCheck };
  if (tipo === 'plazo') return { label: plazoLabel, color: '#C8A7FF', Icon: ClockCountdown };
  return {
    label: terms ? `Fecha de ${terms.expedienteSingular.toLowerCase()}` : 'Fecha clave',
    color: '#EAC26B',
    Icon: FolderOpen,
  };
}

export function getAgendaEventActionLabel(event: AgendaEvento, terms: IndustryTerms) {
  if (event.tipo === 'documento') return 'Ver documento';
  if (event.caseId || event.tipo === 'expediente') {
    return `Ver ${terms.expedienteSingular.toLowerCase()}`;
  }
  return 'Abrir origen';
}
