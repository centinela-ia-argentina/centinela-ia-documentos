'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CalendarBlank,
  Clock,
  PencilSimple,
  Trash,
  X,
} from '@phosphor-icons/react';
import { MotionCard } from '@/components/ui/MotionCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { guardarEventoManual, guardarTurno, eliminarEventoAgenda, editarEventoAgenda } from './actions';
import type { IndustryType } from '@/lib/industries/documentTypes';
import { getAgendaLabels, getIndustryTerms } from '@/lib/industries/uiLabels';
import { AgendaCommandCenter } from './AgendaCommandCenter';
import { getAgendaEventActionLabel, getAgendaEventMeta } from './agendaPresentation';

export type AgendaEvento = {
  id: string;
  rawId?: string;
  fecha: string; // 'YYYY-MM-DD'
  hora?: string; // 'HH:MM'
  titulo: string;
  detalle?: string | null;
  tipo: 'documento' | 'expediente' | 'plazo' | 'evento' | 'turno' | 'firma';
  href: string;
  expedienteNombre?: string;
  caseId?: string;
};

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
  const [eventoDetalle, setEventoDetalle] = useState<AgendaEvento | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Estado de edición dentro del modal
  const [editando, setEditando] = useState(false);
  const [editTitulo, setEditTitulo] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [editHora, setEditHora] = useState('');
  const [editTipo, setEditTipo] = useState<'evento' | 'turno' | 'firma' | 'plazo'>('evento');
  const [editDetalle, setEditDetalle] = useState('');
  const [editCaseId, setEditCaseId] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const iniciarEdicion = (ev: AgendaEvento) => {
    setEditTitulo(ev.titulo);
    setEditFecha(ev.fecha);
    setEditHora(ev.hora || '');
    setEditTipo(ev.tipo === 'turno' ? 'turno' : ev.tipo === 'firma' ? 'firma' : ev.tipo === 'plazo' ? 'plazo' : 'evento');
    setEditDetalle(ev.detalle || '');
    setEditCaseId(ev.caseId || '');
    setErrorEdicion(null);
    setEditando(true);
  };

  const guardarEdicion = async () => {
    if (!eventoDetalle?.rawId) return;
    if (!editTitulo.trim() || !editFecha) {
      setErrorEdicion('Completá título y fecha.');
      return;
    }
    setGuardandoEdicion(true);
    setErrorEdicion(null);

    const categoria =
      editTipo === 'turno' ? 'turno'
      : editTipo === 'firma' ? 'firma'
      : editTipo === 'plazo' ? 'plazo'
      : 'manual';

    const res = await editarEventoAgenda({
      id: eventoDetalle.rawId,
      titulo: editTitulo.trim(),
      fecha: editFecha,
      hora: editHora.trim() || null,
      categoria,
      detalle: editDetalle.trim() || null,
      caseId: editCaseId || null,
    });

    setGuardandoEdicion(false);
    if (res.ok) {
      const caseNombre = cases.find((c) => c.id === editCaseId)?.title;
      setEventoDetalle((prev) => prev ? {
        ...prev,
        titulo: editTitulo.trim(),
        fecha: editFecha,
        hora: editHora.trim() || undefined,
        tipo: editTipo,
        detalle: editDetalle.trim() || null,
        caseId: editCaseId || undefined,
        expedienteNombre: caseNombre,
        href: editCaseId ? `/expedientes/${editCaseId}` : '/agenda',
      } : null);
      setEditando(false);
      router.refresh();
    } else {
      setErrorEdicion(res.mensaje || 'Error al guardar los cambios.');
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este evento de la agenda?')) return;
    setEliminando(true);
    const res = await eliminarEventoAgenda(id);
    setEliminando(false);
    if (res.ok) {
      setEventoDetalle(null);
      setEditando(false);
      router.refresh();
    } else {
      alert(res.mensaje || 'No se pudo eliminar');
    }
  };

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

  const selectedMeta = eventoDetalle
    ? getAgendaEventMeta(eventoDetalle.tipo, agendaLabels.plazoLabel, terms)
    : null;
  const SelectedIcon = selectedMeta?.Icon;

  return (
    <div className="space-y-6">
      <AgendaCommandCenter
        eventos={eventos}
        industry={industry}
        agendaLabels={agendaLabels}
        terms={terms}
        puedeGuardar={puedeGuardar}
        onCreate={() => setShowForm((current) => !current)}
        onSelect={setEventoDetalle}
      />

      {showForm && (
        <MotionCard index={0} className="p-5 max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Cargar evento manual</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-400">Categoría</span>
              <select value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value as any)} className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" data-testid="agenda-categoria">
                <option value="plazo">{agendaLabels.plazoLabel}</option>
                <option value="evento">Recordatorio</option>
                <option value="turno">Turno</option>
                <option value="firma">Firma</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-400">Fecha</span>
              <input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" data-testid="agenda-fecha" />
            </label>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Hora (opcional)</label>
              <input
                type="time"
                value={nuevaHora}
                onChange={(e) => setNuevaHora(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                data-testid="agenda-hora"
              />
              <span className="mt-1 block text-[10px] text-slate-500">Se interpreta como America/Argentina/Buenos_Aires. Vacio = todo el día.</span>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-400">Título</span>
              <input type="text" value={nuevoTitulo} onChange={(e) => setNuevoTitulo(e.target.value)} placeholder={industry === 'inmobiliaria' ? 'Ej: Firma de boleto - Martina López' : industry === 'escribania' ? 'Ej: Firma de escritura - López' : 'Ej: Presentar escrito - Pérez c/ García'} className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none placeholder-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" data-testid="agenda-titulo" />
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
                data-testid="agenda-case-select"
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
              data-testid="agenda-submit"
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </MotionButton>
            {aviso && <p className="text-center text-[11px] font-medium text-amber-500">{aviso}</p>}
          </div>
        </MotionCard>
      )}

      {eventoDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020806]/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg overflow-hidden rounded-[24px] border border-[#85E4D4]/15 bg-[#0A1512] shadow-[0_32px_100px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                {SelectedIcon && selectedMeta ? (
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border"
                    style={{ color: selectedMeta.color, background: `${selectedMeta.color}12`, borderColor: `${selectedMeta.color}28` }}
                  >
                    <SelectedIcon size={21} weight="fill" />
                  </span>
                ) : null}
                <div className="min-w-0">
                  <span className="font-ui text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: selectedMeta?.color }}>
                    {selectedMeta?.label}
                  </span>
                  <h3 className="mt-1 font-display text-xl font-medium leading-tight tracking-[-0.035em] text-[#F3F8F5]">
                  {editando ? 'Editar evento' : eventoDetalle.titulo}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setEventoDetalle(null); setEditando(false); }}
                aria-label="Cerrar detalle"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 text-[#8FA19B] transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"
              >
                <X size={18} />
              </button>
            </div>

            {editando ? (
              <div className="space-y-3 px-5 py-5 sm:px-6">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-400">Categoría</span>
                  <select
                    value={editTipo}
                    onChange={(e) => setEditTipo(e.target.value as any)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                    data-testid="agenda-edit-categoria"
                  >
                    <option value="plazo">{agendaLabels.plazoLabel}</option>
                    <option value="evento">Recordatorio</option>
                    <option value="turno">Turno</option>
                    <option value="firma">Firma</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-400">Fecha</span>
                    <input
                      type="date"
                      value={editFecha}
                      onChange={(e) => setEditFecha(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                      data-testid="agenda-edit-fecha"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-400">Hora</span>
                    <input
                      type="time"
                      value={editHora}
                      onChange={(e) => setEditHora(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                      data-testid="agenda-edit-hora"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-400">Título</span>
                  <input
                    type="text"
                    value={editTitulo}
                    onChange={(e) => setEditTitulo(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                    data-testid="agenda-edit-titulo"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-400">Detalle (opcional)</span>
                  <input
                    type="text"
                    value={editDetalle}
                    onChange={(e) => setEditDetalle(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                    data-testid="agenda-edit-detalle"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-400">{terms.expedienteSingular} (opcional)</span>
                  <select
                    value={editCaseId}
                    onChange={(e) => setEditCaseId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                    data-testid="agenda-edit-case-select"
                  >
                    <option value="">Sin {terms.expedienteSingular.toLowerCase()}</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </label>

                {errorEdicion && <p className="text-xs text-amber-400">{errorEdicion}</p>}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditando(false)}
                    className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={guardandoEdicion}
                    onClick={guardarEdicion}
                    data-testid="agenda-edit-submit"
                    className="rounded-xl bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                  >
                    {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4 px-5 py-5 sm:px-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.018] p-3.5">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#85E4D4]/10 text-[#85E4D4]">
                        <CalendarBlank size={18} weight="regular" />
                      </span>
                      <span>
                        <span className="block font-ui text-[10px] font-semibold text-[#71857F]">Fecha</span>
                        <span className="mt-0.5 block font-ui text-sm font-bold text-[#E7EFEC]">{eventoDetalle.fecha.split('-').reverse().join('/')}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.018] p-3.5">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#C8FF62]/[0.08] text-[#C8FF62]">
                        <Clock size={18} weight="regular" />
                      </span>
                      <span>
                        <span className="block font-ui text-[10px] font-semibold text-[#71857F]">Horario</span>
                        <span className="mt-0.5 block font-ui text-sm font-bold text-[#E7EFEC]">{eventoDetalle.hora ? `${eventoDetalle.hora} hs` : 'Todo el día'}</span>
                      </span>
                    </div>
                  </div>

                  {eventoDetalle.detalle && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.018] p-4">
                      <p className="font-ui text-[10px] font-semibold text-[#71857F]">Detalle</p>
                      <p className="mt-2 whitespace-pre-wrap font-ui text-sm leading-6 text-[#C9D5D1]">{eventoDetalle.detalle}</p>
                    </div>
                  )}
                  {eventoDetalle.expedienteNombre && (
                    <div className="rounded-xl border border-[#EAC26B]/20 bg-[#EAC26B]/[0.055] p-4">
                      <p className="font-ui text-[10px] font-semibold text-[#B79B62]">{terms.expedienteSingular} asociado</p>
                      <p className="mt-1 font-ui text-sm font-bold text-[#EEE5D2]">{eventoDetalle.expedienteNombre}</p>
                    </div>
                  )}
                  <p className="font-ui text-[10px] text-[#60736D]">America/Argentina/Buenos_Aires · UTC-3</p>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-black/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  {eventoDetalle.href && eventoDetalle.href !== '/agenda' ? (
                    <Link
                      href={eventoDetalle.href}
                      className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#F3F8F5] px-4 font-ui text-sm font-bold text-[#071110] transition hover:-translate-y-px hover:shadow-[0_0_24px_rgba(200,255,98,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"
                    >
                      {getAgendaEventActionLabel(eventoDetalle, terms)}
                      <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  ) : <span />}

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {eventoDetalle.rawId && puedeGuardar && (
                      <>
                        <button
                          type="button"
                          onClick={() => iniciarEdicion(eventoDetalle)}
                          data-testid="agenda-editar-btn"
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#85E4D4]/25 bg-[#85E4D4]/[0.06] px-3 font-ui text-xs font-bold text-[#9AF0E2] hover:bg-[#85E4D4]/10"
                        >
                          <PencilSimple size={14} /> Editar
                        </button>
                        <button
                          type="button"
                          disabled={eliminando}
                          onClick={() => eventoDetalle.rawId && eliminar(eventoDetalle.rawId)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-400/20 bg-rose-400/[0.055] px-3 font-ui text-xs font-bold text-rose-300 hover:bg-rose-400/10 disabled:opacity-50"
                        >
                          <Trash size={14} /> {eliminando ? 'Borrando…' : 'Eliminar'}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => { setEventoDetalle(null); setEditando(false); }}
                      className="min-h-10 rounded-lg border border-white/12 px-4 font-ui text-xs font-bold text-[#D7E2DE] hover:bg-white/[0.05]"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
