'use client';

import { useMemo, useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import type { IndustryType } from '@/lib/industries/documentTypes';
import type { AgendaLabels, IndustryTerms } from '@/lib/industries/uiLabels';
import type { AgendaEvento } from './AgendaClient';
import { AnulusCalendar, type CalendarView } from './AnulusCalendar';
import { getAgendaEventMeta } from './agendaPresentation';
import { AppButton } from '@/components/ui/AppButton';
import styles from './Agenda.module.css';

type Vista = CalendarView;
type Filtro = 'todos' | AgendaEvento['tipo'];

type Props = {
  eventos: AgendaEvento[];
  industry: IndustryType;
  agendaLabels: AgendaLabels;
  terms: IndustryTerms;
  puedeGuardar: boolean;
  onCreate: () => void;
  onSelect: (evento: AgendaEvento) => void;
};

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fromIso(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function daysFromToday(value: string, today: Date): number {
  const target = fromIso(value);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(fromIso(value));
}

export function AgendaCommandCenter({
  eventos,
  industry,
  agendaLabels,
  terms,
  puedeGuardar,
  onCreate,
  onSelect,
}: Props) {
  const now = new Date();
  const todayIso = iso(now);
  const [vista, setVista] = useState<Vista>('mes');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const sortedEvents = useMemo(
    () => [...eventos].sort((a, b) => `${a.fecha}-${a.hora ?? ''}-${a.titulo}`.localeCompare(`${b.fecha}-${b.hora ?? ''}-${b.titulo}`)),
    [eventos],
  );

  const filteredEvents = useMemo(
    () => filtro === 'todos' ? sortedEvents : sortedEvents.filter((event) => event.tipo === filtro),
    [filtro, sortedEvents],
  );

  const expired = sortedEvents.filter((event) => event.fecha < todayIso).length;
  const nextSeven = sortedEvents.filter((event) => {
    const days = daysFromToday(event.fecha, now);
    return days >= 0 && days <= 7;
  }).length;
  const signatures = sortedEvents.filter((event) => event.tipo === 'firma' && event.fecha >= todayIso).length;
  const monthTotal = sortedEvents.filter((event) => event.fecha.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)).length;

  const priorityEvents = sortedEvents
    .filter((event) => daysFromToday(event.fecha, now) <= 30)
    .sort((a, b) => {
      const dayDiff = daysFromToday(a.fecha, now) - daysFromToday(b.fecha, now);
      if (dayDiff !== 0) return dayDiff;
      return a.titulo.localeCompare(b.titulo);
    })
    .slice(0, 7);

  const filters: Array<{ value: Filtro; label: string }> = [
    { value: 'todos', label: 'Todos' },
    { value: 'documento', label: 'Documentos' },
    { value: 'plazo', label: agendaLabels.plazoLabel },
    { value: 'firma', label: 'Firmas' },
    { value: 'turno', label: 'Turnos' },
    { value: 'evento', label: 'Recordatorios' },
  ];

  return <div className={styles.agenda}>
    <header className={styles.agendaHead}><div><p className={styles.eyebrow}>Control temporal · {agendaLabels.eyebrow}</p>
      <h1>Agenda operativa</h1><p>Organizá {terms.expedientePlural.toLowerCase()}, documentos, firmas y fechas clave desde un único calendario.</p></div>
      {puedeGuardar ? <AppButton onClick={onCreate}><Plus size={17} aria-hidden="true" />Nuevo evento</AppButton> : null}
    </header>
    <section className={styles.metrics} aria-label="Indicadores de agenda">
      {[
        ['Vencidas',expired,'Requieren revisión'],['Próximos 7 días',nextSeven,'Prioridad inmediata'],
        ['Firmas pendientes',signatures,industry === 'escribania' ? 'Actos por otorgar' : 'Por confirmar'],
        ['Este mes',monthTotal,'Eventos registrados'],
      ].map(([label,value,helper]) => <div key={String(label)} className={styles.metric}><span>{label}</span><strong>{String(value).padStart(2,'0')}</strong><small>{helper}</small></div>)}
    </section>
    <div className={styles.agendaTools}>
      <div className={styles.segments} role="group" aria-label="Vista de calendario">
        {(['hoy','semana','mes'] as Vista[]).map(item => <button key={item} type="button" onClick={() => setVista(item)} aria-pressed={vista === item}>{item === 'hoy' ? 'Hoy' : item === 'semana' ? 'Semana' : 'Mes'}</button>)}
      </div>
      <label className={styles.filterLabel}>Mostrar<select aria-label="Mostrar eventos" value={filtro} onChange={event => setFiltro(event.target.value as Filtro)}>
        {filters.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select></label>
    </div>
    <div className={styles.agendaGrid}>
      <AnulusCalendar eventos={filteredEvents} vista={vista} agendaLabels={agendaLabels} terms={terms} onSelect={onSelect} />
      <aside className={styles.priorities}><p className={styles.eyebrow}>Agenda priorizada</p><h2>Fechas para revisar</h2>
        <p>Cada símbolo identifica el origen y el tipo de evento.</p><p>{priorityEvents.length} {priorityEvents.length === 1 ? 'fecha' : 'fechas'}</p>
        <div className={styles.priorityList}>{priorityEvents.map(event => {
          const days=daysFromToday(event.fecha,now); const meta=getAgendaEventMeta(event.tipo,agendaLabels.plazoLabel,terms);const Icon=meta.Icon;
          const urgency=days < 0 ? `Vencido · ${Math.abs(days)} días` : days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`;
          return <button key={event.id} type="button" onClick={() => onSelect(event)} className={styles.priority}>
            <strong><Icon size={14} aria-hidden="true" /> {event.titulo}</strong>
            <small>{meta.label}{event.expedienteNombre ? ` · ${event.expedienteNombre}` : ''}</small>
            <span className={`${styles.when} ${days < 0 ? styles.late : ''}`}>{dateLabel(event.fecha)} · {urgency}</span>
          </button>;
        })}{!priorityEvents.length ? <p className={styles.empty}>No hay alertas próximas.</p> : null}</div>
        <p className={styles.zone}>America/Argentina/Buenos_Aires · {dateLabel(todayIso)}</p>
      </aside>
    </div>
  </div>;
}
