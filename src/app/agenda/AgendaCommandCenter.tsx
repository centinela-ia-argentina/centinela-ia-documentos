'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarX,
  CaretLeft,
  CaretRight,
  Plus,
} from '@phosphor-icons/react';
import { FERIADOS_NACIONALES_2026 } from '@/lib/legal/config';
import type { IndustryType } from '@/lib/industries/documentTypes';
import type { AgendaLabels, IndustryTerms } from '@/lib/industries/uiLabels';
import type { AgendaEvento } from './AgendaClient';
import { getAgendaEventMeta } from './agendaPresentation';

type Vista = 'hoy' | 'semana' | 'mes';
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

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const feriadosSet = new Set(FERIADOS_NACIONALES_2026);

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fromIso(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
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
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));

  const sortedEvents = useMemo(
    () => [...eventos].sort((a, b) => `${a.fecha}-${a.hora ?? ''}-${a.titulo}`.localeCompare(`${b.fecha}-${b.hora ?? ''}-${b.titulo}`)),
    [eventos],
  );

  const filteredEvents = useMemo(
    () => filtro === 'todos' ? sortedEvents : sortedEvents.filter((event) => event.tipo === filtro),
    [filtro, sortedEvents],
  );

  const monthPrefix = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
  const weekStart = startOfWeek(now);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekEndIso = iso(weekDays[6]);

  const visibleEvents = filteredEvents.filter((event) => {
    if (vista === 'hoy') return event.fecha === todayIso;
    if (vista === 'semana') return event.fecha >= iso(weekStart) && event.fecha <= weekEndIso;
    return event.fecha.startsWith(monthPrefix);
  });

  const eventsByDay = useMemo(() => {
    const result = new Map<string, AgendaEvento[]>();
    for (const event of filteredEvents) {
      const list = result.get(event.fecha) ?? [];
      list.push(event);
      result.set(event.fecha, list);
    }
    return result;
  }, [filteredEvents]);

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

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const monthCells: Array<string | null> = [];
  for (let index = 0; index < offset; index++) monthCells.push(null);
  for (let day = 1; day <= daysInMonth; day++) monthCells.push(iso(new Date(cursor.getFullYear(), cursor.getMonth(), day)));
  while (monthCells.length % 7 !== 0) monthCells.push(null);

  function navigate(delta: number) {
    if (vista === 'mes') {
      setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    }
  }

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
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#091411] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.18)] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="font-ui text-xs font-semibold text-[#85E4D4]">Vista {vista}</p>
                <h2 className="mt-1 font-display text-2xl font-medium tracking-[-0.04em] text-[#F3F8F5]">
                  {vista === 'hoy' ? new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now) : vista === 'semana' ? 'Esta semana' : `${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`}
                </h2>
                {vista === 'mes' ? (
                  <span className="mt-2 inline-flex items-center gap-1.5 font-ui text-[10px] font-semibold text-amber-200/75">
                    <CalendarX size={12} /> Feriado nacional
                  </span>
                ) : null}
              </div>
              {vista === 'mes' ? (
                <div className="inline-flex overflow-hidden rounded-lg border border-white/12 bg-white/[0.018]">
                  <button type="button" onClick={() => navigate(-1)} aria-label="Mes anterior" className="grid h-10 w-10 place-items-center text-[#8FA19B] transition hover:bg-white/[0.05] hover:text-white"><CaretLeft size={16} /></button>
                  <button type="button" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))} className="h-10 border-x border-white/10 px-3.5 font-ui text-xs font-bold text-[#D7E2DE] transition hover:bg-white/[0.05]">Hoy</button>
                  <button type="button" onClick={() => navigate(1)} aria-label="Mes siguiente" className="grid h-10 w-10 place-items-center text-[#8FA19B] transition hover:bg-white/[0.05] hover:text-white"><CaretRight size={16} /></button>
                </div>
              ) : null}
            </div>

            {vista === 'mes' ? (
              <>
                <div className="grid grid-cols-7 rounded-lg bg-white/[0.025] py-2.5 text-center font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-[#71857F]">
                  {DIAS.map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {monthCells.map((value, index) => {
                    if (!value) return <div key={`empty-${index}`} className="min-h-24 rounded-md bg-black/[0.035]" />;
                    const dayEvents = eventsByDay.get(value) ?? [];
                    const holiday = feriadosSet.has(value);
                    const isToday = value === todayIso;
                    return (
                      <div key={value} className={`min-h-24 rounded-md p-1.5 transition-colors hover:bg-white/[0.025] sm:min-h-28 sm:p-2 ${holiday ? 'bg-amber-300/[0.045]' : ''}`}>
                        <div className="flex items-center justify-between">
                          <span className={`grid h-6 min-w-6 place-items-center rounded-full font-ui text-[11px] font-bold ${isToday ? 'bg-[#C8FF62] text-[#071110]' : 'text-[#8FA19B]'}`}>{fromIso(value).getDate()}</span>
                          {holiday ? (
                            <span
                              title="Feriado nacional"
                              aria-label="Feriado nacional"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-amber-300/20 bg-amber-300/[0.08] text-amber-200"
                            >
                              <CalendarX size={13} weight="regular" />
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 space-y-1">
                          {dayEvents.slice(0, 2).map((event) => {
                            const meta = getAgendaEventMeta(event.tipo, agendaLabels.plazoLabel, terms);
                            return (
                              <button
                                key={event.id}
                                type="button"
                                onClick={() => onSelect(event)}
                                title={`${meta.label}: ${event.titulo}`}
                                className="group/event flex min-h-7 w-full items-center gap-1.5 rounded-[4px] px-1.5 py-1 text-left transition hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8FF62]"
                              >
                                <span className="h-4 w-0.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                                <span className="truncate font-ui text-[9px] font-semibold text-[#D6E1DD] sm:text-[10px]">{event.titulo}</span>
                              </button>
                            );
                          })}
                          {dayEvents.length > 2 ? <span className="block pl-1 font-ui text-[9px] text-[#60736D]">+{dayEvents.length - 2} más</span> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}

            {vista === 'semana' ? (
              <div className="grid gap-2 sm:grid-cols-7">
                {weekDays.map((day) => {
                  const value = iso(day);
                  const dayEvents = eventsByDay.get(value) ?? [];
                  return (
                    <div key={value} className={`min-h-32 rounded-xl border p-3 ${value === todayIso ? 'border-[#C8FF62]/35 bg-[#C8FF62]/[0.045]' : 'border-white/10 bg-white/[0.015]'}`}>
                      <p className="font-ui text-[10px] font-bold uppercase text-[#71857F]">{DIAS[(day.getDay() + 6) % 7]}</p>
                      <p className="mt-1 font-display text-2xl font-semibold text-[#F3F8F5]">{day.getDate()}</p>
                      <div className="mt-3 space-y-1.5">
                        {dayEvents.map((event) => {
                          const meta = getAgendaEventMeta(event.tipo, agendaLabels.plazoLabel, terms);
                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => onSelect(event)}
                              className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left font-ui text-[10px] text-[#C9D5D1] hover:bg-white/[0.04]"
                            >
                              <span className="mt-0.5 h-3.5 w-0.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                              <span>{event.hora ? `${event.hora} · ` : ''}{event.titulo}</span>
                            </button>
                          );
                        })}
                        {!dayEvents.length ? <span className="font-ui text-[10px] text-[#536760]">Sin eventos</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {vista === 'hoy' ? (
              <div className="space-y-2">
                {visibleEvents.map((event) => {
                  const meta = getAgendaEventMeta(event.tipo, agendaLabels.plazoLabel, terms);
                  return (
                    <button key={event.id} type="button" onClick={() => onSelect(event)} className="group grid w-full grid-cols-[3px_minmax(0,1fr)_auto] items-center gap-4 rounded-lg px-3 py-4 text-left transition hover:bg-white/[0.035]">
                      <span className="h-full min-h-10 rounded-full" style={{ background: meta.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-ui text-sm font-bold text-[#E7EFEC]">{event.titulo}</span>
                        <span className="mt-1 block font-ui text-xs text-[#71857F]">{event.hora ? `${event.hora} · ` : ''}{meta.label}{event.expedienteNombre ? ` · ${event.expedienteNombre}` : ''}</span>
                      </span>
                      <ArrowRight size={17} className="text-[#85E4D4] transition-transform group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
                {!visibleEvents.length ? <div className="rounded-xl border border-dashed border-white/10 py-14 text-center font-ui text-sm text-[#71857F]">No hay eventos para hoy con este filtro.</div> : null}
              </div>
            ) : null}
          </div>

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
