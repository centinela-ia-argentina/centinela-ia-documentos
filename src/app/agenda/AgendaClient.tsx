'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { MotionCard } from '@/components/ui/MotionCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { guardarEventoManual, guardarTurno, eliminarEventoAgenda, editarEventoAgenda } from './actions';
import type { IndustryType } from '@/lib/industries/documentTypes';
import { getAgendaLabels, getIndustryTerms } from '@/lib/industries/uiLabels';
import { AgendaCommandCenter } from './AgendaCommandCenter';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                  {eventoDetalle.tipo.toUpperCase()}
                </span>
                <h3 className="mt-1 text-lg font-bold text-white">
                  {editando ? 'Editar evento' : eventoDetalle.titulo}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setEventoDetalle(null); setEditando(false); }}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editando ? (
              <div className="space-y-3 border-t border-white/10 pt-3">
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
                <div className="space-y-2 text-sm text-slate-300 border-t border-white/10 pt-3">
                  <p>
                    <strong className="text-white">Fecha:</strong> {eventoDetalle.fecha.split('-').reverse().join('/')}
                    {eventoDetalle.hora ? ` · ${eventoDetalle.hora} hs` : ''}
                  </p>
                  <p className="text-xs text-slate-400">
                    Zona horaria: America/Argentina/Buenos_Aires (UTC-3)
                  </p>
                  {eventoDetalle.detalle && (
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-slate-300 whitespace-pre-wrap">
                      {eventoDetalle.detalle}
                    </div>
                  )}
                  {eventoDetalle.expedienteNombre && (
                    <p>
                      <strong className="text-white">{terms.expedienteSingular}:</strong> {eventoDetalle.expedienteNombre}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                  {eventoDetalle.href && eventoDetalle.href !== '/agenda' ? (
                    <Link
                      href={eventoDetalle.href}
                      className="rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/30"
                    >
                      Ver {terms.expedienteSingular.toLowerCase()} →
                    </Link>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    {eventoDetalle.rawId && puedeGuardar && (
                      <>
                        <button
                          type="button"
                          onClick={() => iniciarEdicion(eventoDetalle)}
                          data-testid="agenda-editar-btn"
                          className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={eliminando}
                          onClick={() => eventoDetalle.rawId && eliminar(eventoDetalle.rawId)}
                          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          {eliminando ? 'Borrando…' : 'Eliminar de agenda'}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => { setEventoDetalle(null); setEditando(false); }}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
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
