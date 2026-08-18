'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, FileText, FolderKanban, CalendarClock, CalendarPlus, Plus, X, FileSignature } from 'lucide-react';
import { MotionCard } from '@/components/ui/MotionCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { guardarEventoManual, guardarTurno } from './actions';
import { FERIADOS_NACIONALES_2026 } from '@/lib/legal/config';
import type { IndustryType } from '@/lib/industries/documentTypes';
import { getAgendaLabels, getIndustryTerms } from '@/lib/industries/uiLabels';

export type AgendaEvento = {
  id: string;
  fecha: string; // 'YYYY-MM-DD'
  hora?: string; // 'HH:MM'
  titulo: string;
  tipo: 'documento' | 'expediente' | 'plazo' | 'evento' | 'turno' | 'firma';
  href: string;
  expedienteNombre?: string;
};

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const feriadosSet = new Set(FERIADOS_NACIONALES_2026);

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function AgendaClient({ eventos, cases, industry, puedeGuardar = true }: { eventos: AgendaEvento[]; cases: { id: string; title: string }[]; industry: IndustryType; puedeGuardar?: boolean }) {
  const agendaLabels = getAgendaLabels(industry);
  const terms = getIndustryTerms(industry);
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevoDetalle, setNuevoDetalle] = useState('');
  const [nuevoCaseId, setNuevoCaseId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<'evento' | 'turno' | 'firma'>('evento');
  const [nuevaHora, setNuevaHora] = useState('');

  const crearEvento = async () => {
    if (!nuevoTitulo.trim() || !nuevaFecha) {
      setAviso('Completá título y fecha.');
      return;
    }
    setGuardando(true);
    setAviso('');
    const res = nuevoTipo === 'evento'
      ? await guardarEventoManual({ titulo: nuevoTitulo, fecha: nuevaFecha, hora: nuevaHora || undefined, detalle: nuevoDetalle, caseId: nuevoCaseId || undefined })
      : await guardarTurno({ titulo: nuevoTitulo, fecha: nuevaFecha, hora: nuevaHora || undefined, tipo: nuevoTipo, detalle: nuevoDetalle, caseId: nuevoCaseId || undefined });
    setGuardando(false);
    if (res.ok) {
      if (res.existing) {
        setAviso('Ya en agenda.');
      } else {
        setNuevoTitulo(''); setNuevaFecha(''); setNuevoDetalle(''); setNuevoCaseId(''); setNuevaHora(''); setNuevoTipo('evento');
        setShowForm(false);
        router.refresh();
      }
    } else {
      setAviso(res.motivo === 'no_auth' ? 'Iniciá sesión para guardar.' : (res.mensaje || 'No se pudo guardar.'));
    }
  };

  const hoy = new Date();
  const [year, setYear] = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth());

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, AgendaEvento[]>();
    for (const ev of eventos) {
      const arr = map.get(ev.fecha) ?? [];
      arr.push(ev);
      map.set(ev.fecha, arr);
    }
    return map;
  }, [eventos]);

  const primerDia = new Date(year, month, 1);
  const offset = (primerDia.getDay() + 6) % 7; // lunes primero
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const hoyIso = iso(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const celdas: Array<number | null> = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);
  while (celdas.length % 7 !== 0) celdas.push(null);

  const irMes = (delta: number) => {
    const nuevo = new Date(year, month + delta, 1);
    setYear(nuevo.getFullYear());
    setMonth(nuevo.getMonth());
  };
  const irHoy = () => {
    setYear(hoy.getFullYear());
    setMonth(hoy.getMonth());
  };

  const eventosMes = eventos
    .filter((ev) => ev.fecha.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
    .sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
      if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo);
      if (a.titulo !== b.titulo) return a.titulo.localeCompare(b.titulo);
      return a.id.localeCompare(b.id);
    });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">{agendaLabels.eyebrow}</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Agenda</h1>
          <p className="mt-1 text-sm text-slate-400">{agendaLabels.subtitulo}</p>
        </div>
        {puedeGuardar && (
          <MotionButton
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-brandviolet px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            Nuevo evento
          </MotionButton>
        )}
      </div>

      {showForm && (
        <MotionCard index={0} className="p-5 max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Cargar evento manual</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Tipo</label>
              <select
                value={nuevoTipo}
                onChange={(e) => setNuevoTipo(e.target.value as 'evento' | 'turno' | 'firma')}
                className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              >
                <option value="evento">Recordatorio</option>
                <option value="turno">Turno</option>
                <option value="firma">Firma</option>
              </select>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-400">Fecha</span>
              <input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" />
            </label>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Hora (opcional)</label>
              <input
                type="time"
                value={nuevaHora}
                onChange={(e) => setNuevaHora(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              />
              <span className="mt-1 block text-[10px] text-slate-500">Se interpreta como America/Argentina/Buenos_Aires. Vacio = todo el día.</span>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-400">Título</span>
              <input type="text" value={nuevoTitulo} onChange={(e) => setNuevoTitulo(e.target.value)} placeholder={industry === 'inmobiliaria' ? 'Ej: Firma de boleto - Martina López' : industry === 'escribania' ? 'Ej: Firma de escritura - López' : 'Ej: Presentar escrito - Pérez c/ García'} className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none placeholder-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-400">Detalle (opcional)</span>
              <input type="text" value={nuevoDetalle} onChange={(e) => setNuevoDetalle(e.target.value)} placeholder="Descripción adicional" className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none placeholder-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">{terms.expedienteSingular} (opcional)</span>
              <select
                value={nuevoCaseId}
                onChange={(e) => setNuevoCaseId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              >
                <option value="">Sin {terms.expedienteSingular.toLowerCase()}</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </label>
            <MotionButton
              type="button"
              onClick={crearEvento}
              disabled={guardando}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </MotionButton>
            {aviso && <p className="text-center text-[11px] font-medium text-amber-500">{aviso}</p>}
          </div>
        </MotionCard>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Feriado</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Vencimiento documento</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Fecha de {terms.expedienteSingular.toLowerCase()}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> {agendaLabels.plazoLabel}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Recordatorio</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-teal-500" /> Turno</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Firma</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MotionCard index={1} className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold capitalize text-white">{MESES[month]} {year}</h2>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => irMes(-1)} className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:bg-white/[0.04]"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={irHoy} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.04]">Hoy</button>
              <button type="button" onClick={() => irMes(1)} className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:bg-white/[0.04]"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
            {DIAS.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {celdas.map((dia, idx) => {
              if (dia === null) return <div key={`e-${idx}`} className="min-h-[76px] rounded-xl" />;
              const fechaIso = iso(year, month, dia);
              const esFeriado = feriadosSet.has(fechaIso);
              const evs = eventosPorDia.get(fechaIso) ?? [];
              const esHoy = fechaIso === hoyIso;
              const bg = esFeriado ? 'bg-amber-500/10 border-amber-500/20' : 'bg-transparent border-white/5';

              return (
                <div key={fechaIso} className={`min-h-[76px] rounded-xl border p-1.5 text-left ${bg}`}>
                  <span className={`text-xs font-semibold ${esHoy ? 'flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-white shadow-sm shadow-cyan-500/50' : 'text-slate-400'}`}>{dia}</span>
                  {esFeriado && <p className="mt-0.5 truncate text-[10px] font-medium text-amber-400">Feriado</p>}
                  <div className="mt-0.5 space-y-0.5">
                    {evs.slice(0, 3).map((ev) => {
                      const bgColor = ev.tipo === 'documento' ? 'bg-sky-500/80 text-white'
                        : ev.tipo === 'evento' ? 'bg-emerald-500/80 text-white'
                        : ev.tipo === 'turno' ? 'bg-teal-500/80 text-white'
                        : ev.tipo === 'firma' ? 'bg-rose-500/80 text-white'
                        : 'bg-violet-500/80 text-white';
                      const content = ev.titulo;
                      const className = `block truncate rounded px-1 py-0.5 text-[10px] font-medium ${bgColor}`;
                      if (['plazo', 'evento', 'turno', 'firma'].includes(ev.tipo) && ev.href === '/agenda') {
                        return <div key={ev.id} title={ev.titulo} className={className}>{content}</div>;
                      }
                      return (
                        <Link key={ev.id} href={ev.href} title={ev.titulo} className={className}>
                          {content}
                        </Link>
                      );
                    })}
                    {evs.length > 3 && <span className="block text-[10px] text-slate-500">+{evs.length - 3} más</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </MotionCard>

        <MotionCard index={2} className="p-5">
          <h2 className="text-base font-semibold capitalize text-white">Eventos de {MESES[month]}</h2>
          <div className="mt-3 space-y-2">
            {eventosMes.length === 0 && <p className="text-sm text-slate-500">No hay vencimientos ni fechas cargadas este mes.</p>}
            {eventosMes.map((ev) => {
              const iconBg = ev.tipo === 'documento' ? 'bg-sky-500/20 text-sky-400'
                : ev.tipo === 'evento' ? 'bg-emerald-500/20 text-emerald-400'
                : ev.tipo === 'turno' ? 'bg-teal-500/20 text-teal-400'
                : ev.tipo === 'firma' ? 'bg-rose-500/20 text-rose-400'
                : 'bg-violet-500/20 text-violet-400';
              const Icon = ev.tipo === 'documento' ? FileText
                : ev.tipo === 'plazo' ? CalendarClock
                : ev.tipo === 'evento' ? CalendarPlus
                : ev.tipo === 'turno' ? CalendarClock
                : ev.tipo === 'firma' ? FileSignature
                : FolderKanban;
              const typeLabel = ev.tipo === 'documento' ? 'Vence documento'
                : ev.tipo === 'plazo' ? agendaLabels.plazoLabel
                : ev.tipo === 'evento' ? 'Recordatorio'
                : ev.tipo === 'turno' ? 'Turno'
                : ev.tipo === 'firma' ? 'Firma'
                : terms.expedienteSingular;
              const content = (
                <>
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-200">{ev.titulo}</span>
                    <span className="block text-xs text-slate-500">{ev.fecha.split('-').reverse().join('/')}{ev.hora ? ` · ${ev.hora}` : ''} · {typeLabel}</span>
                    {ev.expedienteNombre && <span className="block truncate text-[11px] text-slate-600">{ev.expedienteNombre}</span>}
                  </span>
                </>
              );
              const className = "flex items-start gap-2 rounded-xl border border-white/10 p-2.5 transition hover:bg-white/[0.04]";
              if (['plazo', 'evento', 'turno', 'firma'].includes(ev.tipo) && ev.href === '/agenda') {
                return <div key={ev.id} className={className}>{content}</div>;
              }
              return (
                <Link key={ev.id} href={ev.href} className={className}>
                  {content}
                </Link>
              );
            })}
          </div>
        </MotionCard>
      </div>
    </div>
  );
}
