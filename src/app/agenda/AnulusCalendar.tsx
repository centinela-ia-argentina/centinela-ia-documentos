'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CalendarX, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { FERIADOS_NACIONALES_2026 } from '@/lib/legal/config';
import type { AgendaLabels, IndustryTerms } from '@/lib/industries/uiLabels';
import type { AgendaEvento } from './AgendaClient';
import { getAgendaEventMeta } from './agendaPresentation';

export type CalendarView = 'hoy' | 'semana' | 'mes';

type Props = {
  eventos: AgendaEvento[];
  vista: CalendarView;
  agendaLabels: AgendaLabels;
  terms: IndustryTerms;
  onSelect: (evento: AgendaEvento) => void;
};

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const HOLIDAYS = new Set(FERIADOS_NACIONALES_2026);

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fromIso(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date): Date {
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -((date.getDay() + 6) % 7));
}

export function AnulusCalendar({ eventos, vista, agendaLabels, terms, onSelect }: Props) {
  const now = new Date();
  const today = iso(now);
  const reduceMotion = useReducedMotion();
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, AgendaEvento[]>();
    for (const event of eventos) grouped.set(event.fecha, [...(grouped.get(event.fecha) ?? []), event]);
    return grouped;
  }, [eventos]);

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = addDays(monthStart, -((monthStart.getDay() + 6) % 7));
  const monthCells = Array.from({ length: 42 }, (_, index) => iso(addDays(gridStart, index)));
  const weekStart = startOfWeek(now);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const todayEvents = eventsByDay.get(today) ?? [];
  const selectedEvents = eventsByDay.get(selectedDate) ?? [];
  const selectedLabel = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(fromIso(selectedDate));

  function changeMonth(delta: number) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    setCursor(next);
    setSelectedDate(iso(next));
  }

  function chooseDay(value: string) {
    const date = fromIso(value);
    setSelectedDate(value);
    if (date.getMonth() !== cursor.getMonth() || date.getFullYear() !== cursor.getFullYear()) {
      setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }

  const motionProps = {
    initial: reduceMotion ? false : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: reduceMotion ? undefined : { opacity: 0, y: -4 },
    transition: { duration: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#091411] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.18)] sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="font-ui text-xs font-semibold text-[#85E4D4]">Vista {vista}</p>
          <h2 className="mt-1 font-display text-2xl font-medium tracking-[-0.04em] text-[#F3F8F5]">
            {vista === 'hoy' ? new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now) : vista === 'semana' ? 'Esta semana' : `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`}
          </h2>
          {vista === 'mes' ? <span className="mt-2 inline-flex items-center gap-1.5 font-ui text-[10px] font-semibold text-amber-200/75"><CalendarX size={12} /> Feriado nacional</span> : null}
        </div>
        {vista === 'mes' ? (
          <div className="inline-flex overflow-hidden rounded-lg border border-white/12 bg-white/[0.018]">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior" className="grid h-10 w-10 place-items-center text-[#8FA19B] transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8FF62]"><CaretLeft size={16} /></button>
            <button type="button" onClick={() => { setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(today); }} className="h-10 border-x border-white/10 px-3.5 font-ui text-xs font-bold text-[#D7E2DE] transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8FF62]">Hoy</button>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente" className="grid h-10 w-10 place-items-center text-[#8FA19B] transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8FF62]"><CaretRight size={16} /></button>
          </div>
        ) : null}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {vista === 'mes' ? (
          <motion.div key={`month-${cursor.getFullYear()}-${cursor.getMonth()}`} {...motionProps}>
            <div className="hidden sm:block">
              <div className="grid grid-cols-7 px-1 pb-2 text-center font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-[#71857F]">
                {DAYS.map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1 rounded-xl bg-[#07110F] p-1.5">
                {monthCells.map((value) => {
                  const date = fromIso(value);
                  const dayEvents = eventsByDay.get(value) ?? [];
                  const holiday = HOLIDAYS.has(value);
                  const isToday = value === today;
                  const selected = value === selectedDate;
                  const currentMonth = date.getMonth() === cursor.getMonth();
                  return (
                    <div key={value} className={`min-h-[108px] rounded-lg p-2 transition-colors ${selected ? 'bg-[#85E4D4]/[0.075] ring-1 ring-inset ring-[#85E4D4]/25' : holiday ? 'bg-amber-300/[0.035]' : 'bg-white/[0.014] hover:bg-white/[0.03]'} ${currentMonth ? '' : 'opacity-35'}`}>
                      <div className="flex items-center justify-between gap-1">
                        <button type="button" onClick={() => chooseDay(value)} aria-pressed={selected} aria-label={`${date.getDate()} de ${MONTHS[date.getMonth()]}${holiday ? ', feriado nacional' : ''}${dayEvents.length ? `, ${dayEvents.length} eventos` : ', sin eventos'}`} className={`grid h-7 min-w-7 place-items-center rounded-md font-ui text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62] ${isToday ? 'bg-[#C8FF62] text-[#071110]' : selected ? 'bg-[#85E4D4]/12 text-[#DFFAF4]' : 'text-[#8FA19B] hover:bg-white/[0.06] hover:text-white'}`}>{date.getDate()}</button>
                        {holiday ? <span title="Feriado nacional" className="inline-flex h-6 w-6 items-center justify-center text-amber-200/80"><CalendarX size={13} /></span> : null}
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {dayEvents.slice(0, 2).map((event) => {
                          const meta = getAgendaEventMeta(event.tipo, agendaLabels.plazoLabel, terms);
                          return <button key={event.id} type="button" onClick={() => onSelect(event)} title={`${meta.label}: ${event.titulo}`} className="grid min-h-7 w-full grid-cols-[3px_minmax(0,1fr)] items-center gap-1.5 rounded-md px-1.5 text-left transition hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8FF62]"><span className="h-4 rounded-full" style={{ background: meta.color }} /><span className="truncate font-ui text-[10px] font-semibold text-[#D6E1DD]">{event.titulo}</span></button>;
                        })}
                        {dayEvents.length > 2 ? <button type="button" onClick={() => chooseDay(value)} className="block min-h-6 w-full px-1 text-left font-ui text-[9px] font-semibold text-[#71857F] hover:text-[#BFD0CA]">+{dayEvents.length - 2} más</button> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sm:hidden">
              <div className="grid grid-cols-7 px-1 pb-2 text-center font-ui text-[9px] font-bold uppercase text-[#71857F]">{DAYS.map((day) => <span key={day}>{day[0]}</span>)}</div>
              <div className="grid grid-cols-7 gap-1 rounded-xl bg-[#07110F] p-1.5">
                {monthCells.map((value) => {
                  const date = fromIso(value);
                  const dayEvents = eventsByDay.get(value) ?? [];
                  const holiday = HOLIDAYS.has(value);
                  const isToday = value === today;
                  const selected = value === selectedDate;
                  const currentMonth = date.getMonth() === cursor.getMonth();
                  return (
                    <button key={value} type="button" onClick={() => chooseDay(value)} aria-pressed={selected} aria-label={`${date.getDate()} de ${MONTHS[date.getMonth()]}, ${dayEvents.length} eventos`} className={`relative flex aspect-square min-h-11 flex-col items-center justify-center gap-1 rounded-lg font-ui text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62] ${selected ? 'bg-[#85E4D4]/12 text-white ring-1 ring-inset ring-[#85E4D4]/30' : holiday ? 'bg-amber-300/[0.045] text-[#B9C6C1]' : 'text-[#8FA19B] hover:bg-white/[0.04]'} ${currentMonth ? '' : 'opacity-30'}`}>
                      <span className={isToday ? 'grid h-6 w-6 place-items-center rounded-full bg-[#C8FF62] text-[#071110]' : ''}>{date.getDate()}</span>
                      <span className="flex h-1 items-center gap-0.5" aria-hidden="true">{dayEvents.slice(0, 3).map((event) => { const meta = getAgendaEventMeta(event.tipo, agendaLabels.plazoLabel, terms); return <span key={event.id} className="h-1 w-1 rounded-full" style={{ background: meta.color }} />; })}</span>
                      {holiday ? <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-amber-200" /> : null}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 rounded-xl bg-white/[0.022] p-3.5">
                <div className="flex items-center justify-between gap-3"><p className="font-ui text-xs font-bold capitalize text-[#DCE8E3]">{selectedLabel}</p><span className="font-ui text-[10px] text-[#71857F]">{selectedEvents.length} {selectedEvents.length === 1 ? 'evento' : 'eventos'}</span></div>
                <div className="mt-3 space-y-1">
                  {selectedEvents.map((event) => { const meta = getAgendaEventMeta(event.tipo, agendaLabels.plazoLabel, terms); return <button key={event.id} type="button" onClick={() => onSelect(event)} className="grid min-h-11 w-full grid-cols-[3px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"><span className="h-full min-h-7 rounded-full" style={{ background: meta.color }} /><span className="min-w-0"><span className="block truncate font-ui text-xs font-bold text-[#E7EFEC]">{event.titulo}</span><span className="mt-0.5 block truncate font-ui text-[10px] text-[#71857F]">{event.hora ? `${event.hora} · ` : ''}{meta.label}</span></span><ArrowRight size={15} className="text-[#85E4D4]" /></button>; })}
                  {!selectedEvents.length ? <p className="py-4 text-center font-ui text-xs text-[#60736D]">Sin eventos para esta fecha.</p> : null}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        {vista === 'semana' ? (
          <motion.div key="week" {...motionProps} className="grid gap-1 sm:grid-cols-7">
            {weekDays.map((day) => { const value = iso(day); const dayEvents = eventsByDay.get(value) ?? []; const isToday = value === today; return (
              <section key={value} className={`min-h-36 rounded-xl p-3 ${isToday ? 'bg-[#C8FF62]/[0.055] ring-1 ring-inset ring-[#C8FF62]/25' : 'bg-white/[0.018]'}`} aria-label={`${DAYS[(day.getDay() + 6) % 7]} ${day.getDate()}`}>
                <div className="flex items-center justify-between sm:block"><p className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-[#71857F]">{DAYS[(day.getDay() + 6) % 7]}</p><p className={`mt-1 font-display text-2xl font-semibold ${isToday ? 'text-[#C8FF62]' : 'text-[#F3F8F5]'}`}>{day.getDate()}</p></div>
                <div className="mt-3 space-y-1">{dayEvents.map((event) => { const meta = getAgendaEventMeta(event.tipo, agendaLabels.plazoLabel, terms); return <button key={event.id} type="button" onClick={() => onSelect(event)} className="grid min-h-9 w-full grid-cols-[3px_minmax(0,1fr)] items-start gap-2 rounded-md px-1.5 py-2 text-left transition hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8FF62]"><span className="h-full min-h-5 rounded-full" style={{ background: meta.color }} /><span className="min-w-0 font-ui text-[10px] leading-4 text-[#C9D5D1]"><span className="text-[#71857F]">{event.hora || 'Todo el día'}</span><br />{event.titulo}</span></button>; })}{!dayEvents.length ? <span className="block py-3 font-ui text-[10px] text-[#536760]">Sin eventos</span> : null}</div>
              </section>
            ); })}
          </motion.div>
        ) : null}

        {vista === 'hoy' ? (
          <motion.div key="today" {...motionProps} className="relative">
            {todayEvents.length ? <span className="absolute bottom-5 left-[61px] top-5 w-px bg-white/[0.08]" aria-hidden="true" /> : null}
            <div className="space-y-1">
              {todayEvents.map((event) => { const meta = getAgendaEventMeta(event.tipo, agendaLabels.plazoLabel, terms); return <button key={event.id} type="button" onClick={() => onSelect(event)} className="group relative grid min-h-16 w-full grid-cols-[48px_10px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-1 py-2 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"><span className="font-ui text-[10px] font-semibold text-[#71857F]">{event.hora || 'Todo el día'}</span><span className="z-10 h-2.5 w-2.5 rounded-full ring-4 ring-[#091411]" style={{ background: meta.color }} /><span className="min-w-0 pl-2"><span className="block truncate font-ui text-sm font-bold text-[#E7EFEC]">{event.titulo}</span><span className="mt-1 block truncate font-ui text-xs text-[#71857F]">{meta.label}{event.expedienteNombre ? ` · ${event.expedienteNombre}` : ''}</span></span><ArrowRight size={17} className="text-[#85E4D4] transition-transform group-hover:translate-x-0.5" /></button>; })}
              {!todayEvents.length ? <div className="rounded-xl bg-white/[0.018] px-5 py-14 text-center"><p className="font-display text-lg font-medium text-[#CAD7D2]">Día despejado</p><p className="mt-2 font-ui text-xs text-[#71857F]">No hay eventos para hoy con este filtro.</p></div> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
