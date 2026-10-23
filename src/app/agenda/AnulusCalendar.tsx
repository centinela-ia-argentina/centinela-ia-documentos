'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CalendarX, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { FERIADOS_NACIONALES_2026 } from '@/lib/legal/config';
import type { AgendaLabels, IndustryTerms } from '@/lib/industries/uiLabels';
import type { AgendaEvento } from './AgendaClient';
import { getAgendaEventMeta } from './agendaPresentation';
import styles from './Agenda.module.css';

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
    initial: reduceMotion ? false : { opacity: 0 },
    animate: { opacity: 1 },
    exit: reduceMotion ? undefined : { opacity: 0 },
    transition: { duration: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  };

  function renderEventList(items: AgendaEvento[]) {
    return <div className={styles.dayList}>{items.map(event => {const meta=getAgendaEventMeta(event.tipo,agendaLabels.plazoLabel,terms); return <button key={event.id}
      type="button" className={styles.agendaEvent} onClick={() => onSelect(event)}><span>{event.hora || 'Todo el día'}</span>
      <span><strong>{event.titulo}</strong><small>{meta.label}{event.expedienteNombre ? ` · ${event.expedienteNombre}` : ''}</small></span><ArrowRight size={16} aria-hidden="true" /></button>;})}
      {!items.length ? <p className={styles.empty}>Sin eventos para esta fecha.</p> : null}</div>;
  }
  return <section className={styles.calendar} aria-label="Calendario">
    <header className={styles.calendarHead}><div><p className={styles.eyebrow}>Vista {vista}</p>
      <h2>{vista === 'hoy' ? new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'numeric',month:'long'}).format(now) : vista === 'semana' ? 'Esta semana' : `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`}</h2></div>
      {vista === 'mes' ? <div className={styles.monthControls}>
        <button type="button" aria-label="Mes anterior" onClick={() => changeMonth(-1)}><CaretLeft size={16} aria-hidden="true" /></button>
        <button type="button" onClick={() => {setCursor(new Date(now.getFullYear(),now.getMonth(),1));setSelectedDate(today);}}>Hoy</button>
        <button type="button" aria-label="Mes siguiente" onClick={() => changeMonth(1)}><CaretRight size={16} aria-hidden="true" /></button>
      </div> : null}
    </header>
    <AnimatePresence mode="wait" initial={false}>
      {vista === 'mes' ? <motion.div key={`month-${cursor.getFullYear()}-${cursor.getMonth()}`} {...motionProps}>
        <div className={styles.weekLabels} aria-hidden="true">{DAYS.map(day => <span key={day}>{day}</span>)}</div>
        <div className={styles.month}>{monthCells.map(value => {
          const date=fromIso(value); const dayEvents=eventsByDay.get(value) ?? [];const holiday=HOLIDAYS.has(value);const selected=value===selectedDate;
          const currentMonth=date.getMonth()===cursor.getMonth();
          return <div key={value} className={`${styles.day} ${!currentMonth ? styles.outside : ''} ${selected ? styles.chosen : ''} ${value === today ? styles.current : ''}`}>
            <button type="button" className={styles.dayNumber} onClick={() => chooseDay(value)} aria-pressed={selected}
              aria-label={`${date.getDate()} de ${MONTHS[date.getMonth()]}${holiday ? ', feriado nacional' : ''}, ${dayEvents.length} eventos`}>{date.getDate()}</button>
            {holiday ? <span title="Feriado nacional" className={styles.holidayIcon}><CalendarX size={12} aria-hidden="true" /></span> : null}
            <div className={styles.cellEvents}>{dayEvents.slice(0,2).map(event => {const meta=getAgendaEventMeta(event.tipo,agendaLabels.plazoLabel,terms);return <button key={event.id} type="button"
              className={styles.event} onClick={() => onSelect(event)} title={`${meta.label}: ${event.titulo}`}>{event.titulo}</button>;})}
              {dayEvents.length > 2 ? <button type="button" className={styles.more} onClick={() => chooseDay(value)}>+{dayEvents.length-2} más</button> : null}</div>
            <span className={styles.mobileDots} aria-hidden="true">{dayEvents.slice(0,3).map(event => <span key={event.id} className={styles.dot} />)}</span>
          </div>;
        })}</div>
        <div className={styles.calendarLegend}><CalendarX size={13} aria-hidden="true" /> Feriado nacional<span>Seleccioná una fecha para ver sus eventos.</span></div>
        <div className={styles.selectedDay}><h3>{selectedLabel}</h3>{renderEventList(selectedEvents)}</div>
      </motion.div> : null}
      {vista === 'semana' ? <motion.div key="week" {...motionProps} className={styles.weekly}>
        {weekDays.map(day => {const value=iso(day);const dayEvents=eventsByDay.get(value) ?? [];return <section key={value} className={styles.weekDay}
          aria-label={`${DAYS[(day.getDay()+6)%7]} ${day.getDate()}`}><h3>{DAYS[(day.getDay()+6)%7]} {day.getDate()}{value === today ? ' · Hoy' : ''}</h3>
          {dayEvents.map(event => {const meta=getAgendaEventMeta(event.tipo,agendaLabels.plazoLabel,terms);return <button key={event.id} type="button" onClick={() => onSelect(event)}>
            <small>{event.hora || 'Todo el día'} · {meta.label}</small><br />{event.titulo}</button>;})}
          {!dayEvents.length ? <p className={styles.empty}>Sin eventos</p> : null}</section>;})}
      </motion.div> : null}
      {vista === 'hoy' ? <motion.div key="today" {...motionProps}>
        {todayEvents.length ? renderEventList(todayEvents) : <div className={styles.empty}><h3>Día despejado</h3><p>No hay eventos para hoy con este filtro.</p></div>}
      </motion.div> : null}
    </AnimatePresence>
  </section>;
}
