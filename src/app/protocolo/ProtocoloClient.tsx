'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookText, Plus, X, Trash2, FileDown } from 'lucide-react';
import { registrarEscritura, eliminarEscritura } from './actions';

export type EscrituraProtocolo = {
  id: string;
  numero: number;
  anio: number;
  fecha_otorgamiento: string | null;
  tipo_acto: string | null;
  comparecientes: string | null;
  objeto: string | null;
  folio_desde: string | null;
  folio_hasta: string | null;
  observaciones: string | null;
  case_id: string | null;
};

const MESES = ['Todos','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function ProtocoloClient({ escrituras, cases, esAuditor }: { escrituras: EscrituraProtocolo[]; cases: { id: string; title: string }[]; esAuditor?: boolean }) {
  const router = useRouter();
  const anioActual = new Date().getFullYear();

  const aniosDisponibles = useMemo(() => {
    const s = new Set<number>(escrituras.map((e) => e.anio));
    s.add(anioActual);
    return Array.from(s).sort((a, b) => b - a);
  }, [escrituras, anioActual]);

  const [anio, setAnio] = useState(anioActual);
  const [mes, setMes] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [fecha, setFecha] = useState('');
  const [tipoActo, setTipoActo] = useState('');
  const [comparecientes, setComparecientes] = useState('');
  const [objeto, setObjeto] = useState('');
  const [folioDesde, setFolioDesde] = useState('');
  const [folioHasta, setFolioHasta] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [caseId, setCaseId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');

  const filtradas = useMemo(() => {
    return escrituras
      .filter((e) => e.anio === anio)
      .filter((e) => mes === 0 || (e.fecha_otorgamiento && Number(e.fecha_otorgamiento.slice(5, 7)) === mes))
      .sort((a, b) => b.numero - a.numero);
  }, [escrituras, anio, mes]);

  const proximoNumero = useMemo(() => {
    const max = escrituras.filter((e) => e.anio === anioActual).reduce((m, e) => Math.max(m, e.numero), 0);
    return max + 1;
  }, [escrituras, anioActual]);

  const guardar = async () => {
    if (!fecha) { setAviso('Completá la fecha de otorgamiento.'); return; }
    setGuardando(true);
    setAviso('');
    const res = await registrarEscritura({
      fechaOtorgamiento: fecha, tipoActo, comparecientes, objeto,
      folioDesde, folioHasta, observaciones, caseId: caseId || undefined,
    });
    setGuardando(false);
    if (res.ok) {
      setFecha(''); setTipoActo(''); setComparecientes(''); setObjeto(''); setFolioDesde(''); setFolioHasta(''); setObservaciones(''); setCaseId('');
      setShowForm(false);
      router.refresh();
    } else {
      setAviso(res.motivo === 'sin_permiso' ? 'No tenés permiso para registrar.' : (res.mensaje || 'No se pudo registrar.'));
    }
  };

  const borrar = async (id: string) => {
    if (!confirm('¿Eliminar esta escritura del protocolo?')) return;
    await eliminarEscritura(id);
    router.refresh();
  };

  const exportarIndicePDF = () => {
    const mesLabel = MESES[mes];
    const filas = filtradas.map((e) => `
      <tr>
        <td style="text-align:center;font-weight:bold;">${e.numero}</td>
        <td>${e.fecha_otorgamiento ? e.fecha_otorgamiento.split('-').reverse().join('/') : '-'}</td>
        <td>${escapeHtml(e.tipo_acto || '-')}</td>
        <td>${escapeHtml(e.comparecientes || '-')}</td>
        <td>${escapeHtml(e.objeto || '-')}</td>
        <td>${e.folio_desde || e.folio_hasta ? `${escapeHtml(e.folio_desde || '?')} – ${escapeHtml(e.folio_hasta || '?')}` : '-'}</td>
      </tr>`).join('');

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" />
      <title>Indice de escrituras ${anio}${mes ? ' - ' + mesLabel : ''}</title>
      <style>
        * { font-family: Arial, sans-serif; }
        body { margin: 32px; color: #111; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .sub { font-size: 12px; color: #555; margin: 0 0 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f3f3f3; }
        .foot { margin-top: 24px; font-size: 10px; color: #888; }
        @media print { body { margin: 12mm; } }
      </style></head>
      <body>
        <h1>Índice / Repertorio de Escrituras</h1>
        <p class="sub">Año ${anio}${mes ? ' — Mes: ' + mesLabel : ' — Todos los meses'} · ${filtradas.length} escritura(s)</p>
        <table>
          <thead><tr><th>N°</th><th>Fecha</th><th>Tipo de acto</th><th>Comparecientes</th><th>Objeto</th><th>Folios</th></tr></thead>
          <tbody>${filas || '<tr><td colspan="6" style="text-align:center;color:#888;">Sin escrituras</td></tr>'}</tbody>
        </table>
        <p class="foot">Generado el ${new Date().toLocaleString('es-AR')} · Centinela IA</p>
      </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Permití las ventanas emergentes para exportar el PDF.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/40">Herramientas notariales</p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><BookText className="h-6 w-6 text-amber-400" /> Índice / Repertorio</h1>
          <p className="mt-1 text-sm text-white/50">Registro correlativo de escrituras y actos, con índice por mes.</p>
        </div>
        {!esAuditor && (
          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Registrar escritura
          </button>
        )}
      </div>

      {showForm && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="mb-4 text-sm text-white/70">Próximo número sugerido para {anioActual}: <span className="font-semibold text-amber-300">N° {proximoNumero}</span></p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Fecha de otorgamiento *</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Tipo de acto</label>
              <input value={tipoActo} onChange={(e) => setTipoActo(e.target.value)} placeholder="Ej: Compraventa, Poder general" className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none placeholder-slate-500 focus:border-amber-400" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">Comparecientes</label>
              <input value={comparecientes} onChange={(e) => setComparecientes(e.target.value)} placeholder="Ej: Pérez, Juan y Gómez, María" className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none placeholder-slate-500 focus:border-amber-400" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">Objeto</label>
              <input value={objeto} onChange={(e) => setObjeto(e.target.value)} placeholder="Breve descripción del acto" className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none placeholder-slate-500 focus:border-amber-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Folio desde</label>
              <input value={folioDesde} onChange={(e) => setFolioDesde(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Folio hasta</label>
              <input value={folioHasta} onChange={(e) => setFolioHasta(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-amber-400" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">Expediente (opcional)</label>
              <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-amber-400">
                <option value="">Sin expediente</option>
                {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">Observaciones (opcional)</label>
              <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-amber-400" />
            </div>
          </div>
          <button onClick={guardar} disabled={guardando} className="mt-4 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {guardando ? 'Registrando…' : 'Registrar en el protocolo'}
          </button>
          {aviso && <p className="mt-2 text-sm text-amber-300">{aviso}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white">
          {aniosDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white">
          {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <span className="text-sm text-white/50">{filtradas.length} escritura(s)</span>
        <button onClick={exportarIndicePDF} className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white hover:bg-white/[0.06]">
          <FileDown className="h-4 w-4" /> Exportar PDF
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-white/50">
            <tr>
              <th className="px-3 py-2">N°</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Tipo de acto</th>
              <th className="px-3 py-2">Comparecientes</th>
              <th className="px-3 py-2">Folios</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-white/40">Sin escrituras registradas para este período.</td></tr>
            )}
            {filtradas.map((e) => (
              <tr key={e.id} className="border-t border-white/5">
                <td className="px-3 py-2 font-semibold text-amber-300">{e.numero}</td>
                <td className="px-3 py-2 text-white/70">{e.fecha_otorgamiento ? e.fecha_otorgamiento.split('-').reverse().join('/') : '-'}</td>
                <td className="px-3 py-2 text-white/80">{e.tipo_acto || '-'}</td>
                <td className="px-3 py-2 text-white/70">{e.comparecientes || '-'}</td>
                <td className="px-3 py-2 text-white/60">{e.folio_desde || e.folio_hasta ? `${e.folio_desde || '?'} – ${e.folio_hasta || '?'}` : '-'}</td>
                <td className="px-3 py-2 text-right">
                  {!esAuditor && (
                    <button onClick={() => borrar(e.id)} className="text-white/30 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
