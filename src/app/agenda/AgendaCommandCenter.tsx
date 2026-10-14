'use client';

import { useMemo, useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import type { IndustryType } from '@/lib/industries/documentTypes';
import type { AgendaLabels, IndustryTerms } from '@/lib/industries/uiLabels';
import type { AgendaEvento } from './AgendaClient';
import { AnulusCalendar, type CalendarView } from './AnulusCalendar';
import { getAgendaEventMeta } from './agendaPresentation';

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

  return (
    <div className="mx-auto max-w-6xl py-2 sm:py-3">
      <header className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-ui text-xs font-semibold text-[#85E4D4]">Control temporal · {agendaLabels.eyebrow}</p>
          <h1 className="mt-2 font-display text-[clamp(2.35rem,5vw,4.5rem)] font-medium leading-none tracking-[-0.06em] text-[#F3F8F5]">
            Agenda operativa
          </h1>
          <p className="mt-4 max-w-3xl font-ui text-sm font-medium leading-6 text-[#B8C6C1] sm:text-base">
            Organizá {terms.expedientePlural.toLowerCase()}, documentos, firmas y fechas clave desde un único calendario.
          </p>
        </div>
        {puedeGuardar ? (
          <button
            type="button"
            onClick={onCreate}
            className="group inline-flex min-h-12 w-fit items-center gap-3 rounded-md border border-white/60 bg-[#F3F8F5] px-5 font-ui text-sm font-bold text-[#071110] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(200,255,98,0.25),0_0_26px_rgba(200,255,98,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"
          >
            <Plus size={18} weight="bold" /> Nuevo evento
          </button>
        ) : null}
      </header>

      <section className="grid grid-cols-2 border-b border-white/10 sm:grid-cols-4">
        {[
          ['Vencidas', expired, 'Requieren revisión'],
          ['Próximos 7 días', nextSeven, 'Prioridad inmediata'],
          ['Firmas pendientes', signatures, industry === 'escribania' ? 'Actos por otorgar' : 'Por confirmar'],
          ['Este mes', monthTotal, 'Eventos registrados'],
        ].map(([label, value, helper], index) => (
          <div key={String(label)} className={`px-4 py-5 sm:px-5 ${index % 2 === 0 ? 'border-r border-white/10' : ''} ${index < 2 ? 'border-b border-white/10 sm:border-b-0' : ''} ${index === 1 ? 'sm:border-r' : ''} ${index === 2 ? 'sm:border-r' : ''}`}>
            <p className="font-ui text-[11px] font-semibold text-[#8FA19B]">{label}</p>
            <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.05em] text-[#F3F8F5]">{String(value).padStart(2, '0')}</p>
            <p className="mt-1 font-ui text-[10px] text-[#667A73]">{helper}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-3 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex w-fit rounded-md border border-white/10 bg-white/[0.025] p-1">
          {(['hoy', 'semana', 'mes'] as Vista[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setVista(item)}
              className={`min-h-9 rounded-[4px] px-4 font-ui text-xs font-bold capitalize transition-colors ${vista === item ? 'bg-[#F3F8F5] text-[#071110]' : 'text-[#91A39F] hover:bg-white/[0.05] hover:text-white'}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex w-fit max-w-full overflow-x-auto rounded-lg border border-white/12 bg-white/[0.018] p-1 lg:justify-end">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFiltro(item.value)}
              className={`min-h-9 shrink-0 rounded-md px-3.5 font-ui text-[11px] font-bold transition-[background-color,color,box-shadow] ${filtro === item.value ? 'bg-[#F3F8F5] text-[#071110] shadow-[0_1px_2px_rgba(0,0,0,0.2)]' : 'text-[#8FA19B] hover:bg-white/[0.045] hover:text-white'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
          <AnulusCalendar
            eventos={filteredEvents}
            vista={vista}
            agendaLabels={agendaLabels}
            terms={terms}
            onSelect={onSelect}
          />

          <aside className="rounded-xl border border-white/[0.08] bg-[linear-gradient(180deg,#0D1B17,#0A1512)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.18)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-ui text-xs font-semibold text-[#85E4D4]">Agenda priorizada</p>
                <h2 className="mt-1 font-display text-2xl font-medium tracking-[-0.04em] text-[#F3F8F5]">Fechas para revisar</h2>
                <p className="mt-2 font-ui text-xs leading-5 text-[#81948E]">Cada símbolo identifica el origen y el tipo de evento.</p>
              </div>
              <span className="shrink-0 font-ui text-xs font-bold text-[#9FB0AB]">
                {priorityEvents.length} {priorityEvents.length === 1 ? 'fecha' : 'fechas'}
              </span>
            </div>

            <div className="mt-5 divide-y divide-white/[0.07]">
              {priorityEvents.map((event) => {
                const days = daysFromToday(event.fecha, now);
                const meta = getAgendaEventMeta(event.tipo, agendaLabels.plazoLabel, terms);
                const urgency = days < 0 ? `Vencido · ${Math.abs(days)} días` : days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelect(event)}
                    className="group grid w-full grid-cols-[3px_minmax(0,1fr)] gap-3 py-4 text-left transition hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8FF62]"
                  >
                    <span className="h-full min-h-10 rounded-full" style={{ background: meta.color }} />
                    <span className="min-w-0">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate font-ui text-xs font-bold text-[#E5EEEA] group-hover:text-white">{event.titulo}</span>
                        <span className={`shrink-0 font-ui text-[9px] font-bold ${days < 0 ? 'text-rose-300' : days <= 7 ? 'text-amber-200' : 'text-[#8FA19B]'}`}>{urgency}</span>
                      </span>
                      <span className="mt-1 block truncate font-ui text-[10px] text-[#71857F]">{meta.label}{event.expedienteNombre ? ` · ${event.expedienteNombre}` : ''}</span>
                    </span>
                  </button>
                );
              })}
              {!priorityEvents.length ? <p className="py-8 text-center font-ui text-xs text-[#71857F]">No hay alertas próximas.</p> : null}
            </div>

            <div className="mt-4 flex items-center justify-between font-ui text-[10px] text-[#60736D]">
              <span>America/Argentina/Buenos_Aires</span>
              <span>{dateLabel(todayIso)}</span>
            </div>
          </aside>
      </section>
    </div>
  );
}
