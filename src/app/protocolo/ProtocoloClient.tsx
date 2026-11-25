'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookText, Plus, X, Trash2, FileDown } from 'lucide-react';
import { registrarEscritura, eliminarEscritura } from './actions';
import { SelectField } from '@/components/ui/SelectField';

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

const ACTOS_NOTARIALES_FRECUENTES = [
  'Compraventa inmobiliaria',
  'Poder especial',
  'Poder general de administración y disposición',
  'Acta de constatación',
  'Certificación de firmas',
  'Cesión de derechos hereditarios',
  'Donación',
  'Hipoteca / Cancelación de gravamen',
  'Constitución de sociedad',
  'Autorización de viaje',
  'Reglamento de copropiedad',
];

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const inputClass =
  'w-full rounded-[8px] border border-[#d9d9d6] bg-white px-3 py-2 text-sm text-[#25272a] outline-none placeholder:text-[#8a8f94] focus:border-[#415a71]';

export function ProtocoloClient({ escrituras, cases }: { escrituras: EscrituraProtocolo[]; cases: { id: string; title: string }[] }) {
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

  // Riel anual del ledger: escrituras del año, movimiento del mes y folios consumidos.
  const escriturasAnio = useMemo(() => escrituras.filter((e) => e.anio === anio), [escrituras, anio]);
  const escriturasMesObjetivo = useMemo(() => {
    const mesObjetivo = mes !== 0 ? mes : new Date().getMonth() + 1;
    return escriturasAnio.filter((e) => e.fecha_otorgamiento && Number(e.fecha_otorgamiento.slice(5, 7)) === mesObjetivo).length;
  }, [escriturasAnio, mes]);
  const folios = useMemo(() => {
    let consumidos = 0;
    let actual = 0;
    for (const e of escriturasAnio) {
      const desde = Number(e.folio_desde);
      const hasta = Number(e.folio_hasta);
      if (Number.isFinite(desde) && Number.isFinite(hasta) && hasta >= desde) consumidos += hasta - desde + 1;
      if (Number.isFinite(hasta) && hasta > actual) actual = hasta;
    }
    return { consumidos, actual };
  }, [escriturasAnio]);
  const ultimaFecha = useMemo(() => {
    const fechas = escriturasAnio.map((e) => e.fecha_otorgamiento).filter((v): v is string => Boolean(v)).sort();
    return fechas.length > 0 ? fechas[fechas.length - 1].split('-').reverse().join('/') : null;
  }, [escriturasAnio]);
  const mesRailLabel = mes !== 0 ? MESES[mes].toUpperCase() : MESES[new Date().getMonth() + 1].toUpperCase();

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
        <p class="foot">Generado el ${new Date().toLocaleString('es-AR')} · Anulus AI</p>
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
          <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#626b73]">Herramientas notariales</p>
          <h1 className="mt-2 flex items-center gap-2 text-[26px] font-semibold tracking-[-.02em] text-[#25272a]"><BookText className="h-6 w-6 text-[#626b73]" strokeWidth={1.7} aria-hidden="true" /> Índice / Repertorio</h1>
          <p className="mt-1 text-xs text-[#626b73]">Registro correlativo de escrituras y actas, con índice por mes.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#2c2c2b] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#424242]">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Registrar escritura o acta
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 border-y border-[#d5d5d2] sm:grid-cols-3">
        <div className="px-0 py-5 sm:px-6 sm:first:pl-0">
          <div className="flex items-center justify-between text-[13px] text-[#626b73]"><span>Escrituras {anio}</span></div>
          <div className="mt-1.5 text-[34px] font-medium tracking-[-1px] text-[#25272a]">{escriturasAnio.length}</div>
          <div className="mt-1 text-[11px] text-[#8a8f94]">Próximo N°: {proximoNumero}</div>
        </div>
        <div className="px-0 py-5 sm:px-6 sm:border-l sm:border-[#d5d5d2]">
          <div className="flex items-center justify-between text-[13px] text-[#626b73]"><span>Este mes</span><span className="text-[10px] font-bold text-[#626b73]">{mesRailLabel}</span></div>
          <div className="mt-1.5 text-[34px] font-medium tracking-[-1px] text-[#25272a]">{escriturasMesObjetivo}</div>
          <div className="mt-1 text-[11px] text-[#8a8f94]">{ultimaFecha ? `Última: ${ultimaFecha}` : 'Sin otorgamientos'}</div>
        </div>
        <div className="px-0 py-5 sm:px-6 sm:border-l sm:border-[#d5d5d2]">
          <div className="flex items-center justify-between text-[13px] text-[#626b73]"><span>Folios consumidos</span></div>
          <div className="mt-1.5 text-[34px] font-medium tracking-[-1px] text-[#25272a]">{folios.consumidos}</div>
          <div className="mt-1 text-[11px] text-[#8a8f94]">{folios.actual > 0 ? `Folio actual: ${folios.actual}` : 'Sin folios registrados'}</div>
        </div>
      </div>

      {showForm && (
        <div className="rounded-[10px] border border-[#d9d9d6] bg-white p-5">
          <p className="mb-4 text-xs text-[#626b73]">Próximo número sugerido para {anioActual}: <span className="font-semibold text-[#25272a]">N° {proximoNumero}</span></p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-[#626b73]">Fecha de otorgamiento *</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#626b73]">Tipo de acto</label>
              <input
                list="tipos-actos-list"
                value={tipoActo}
                onChange={(e) => setTipoActo(e.target.value)}
                placeholder="Seleccioná o escribí (ej: Compraventa, Poder especial)"
                className={inputClass}
              />
              <datalist id="tipos-actos-list">
                {ACTOS_NOTARIALES_FRECUENTES.map((acto) => (
                  <option key={acto} value={acto} />
                ))}
              </datalist>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-[#626b73]">Comparecientes</label>
              <input value={comparecientes} onChange={(e) => setComparecientes(e.target.value)} placeholder="Ej: Pérez, Juan y Gómez, María" className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-[#626b73]">Objeto</label>
              <input value={objeto} onChange={(e) => setObjeto(e.target.value)} placeholder="Breve descripción del acto" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#626b73]">Folio desde</label>
              <input value={folioDesde} onChange={(e) => setFolioDesde(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#626b73]">Folio hasta</label>
              <input value={folioHasta} onChange={(e) => setFolioHasta(e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-[#626b73]">Expediente (opcional)</label>
              <SelectField name="protocolo-case" label="Expediente (opcional)" value={caseId} placeholder="Sin expediente" onChange={setCaseId} options={[{value:'',label:'Sin expediente'},...cases.map((c) => ({value:c.id,label:c.title}))]} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-[#626b73]">Observaciones (opcional)</label>
              <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={inputClass} />
            </div>
          </div>
          <button onClick={guardar} disabled={guardando} className="mt-4 rounded-[6px] bg-[#2c2c2b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#424242] disabled:opacity-50">
            {guardando ? 'Registrando…' : 'Registrar escritura o acta'}
          </button>
          {aviso && <p className="mt-2 text-xs text-[#a63d33]">{aviso}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SelectField name="protocolo-anio" label="Año" value={String(anio)} placeholder="Año" onChange={(v) => setAnio(Number(v))} options={aniosDisponibles.map((a) => ({value:String(a),label:String(a)}))} />
        <SelectField name="protocolo-mes" label="Mes" value={String(mes)} placeholder="Mes" onChange={(v) => setMes(Number(v))} options={MESES.map((m, i) => ({value:String(i),label:m}))} />
        <span className="text-xs text-[#626b73]">{filtradas.length} escritura(s) y acta(s)</span>
        <button onClick={exportarIndicePDF} className="ml-auto inline-flex items-center gap-1.5 rounded-[6px] border border-[#92928f] bg-white px-3 py-2 text-xs font-semibold text-[#303030] hover:bg-[#f1f1ef]">
          <FileDown className="h-4 w-4" /> Exportar PDF
        </button>
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-[#d9d9d6] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#fafaf9] text-left">
            <tr>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[.06em] text-[#626b73]">N°</th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[.06em] text-[#626b73]">Fecha</th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[.06em] text-[#626b73]">Tipo de acto</th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[.06em] text-[#626b73]">Comparecientes</th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[.06em] text-[#626b73]">Folios</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-[#8a8f94]">Sin escrituras ni actas registradas para este período.</td></tr>
            )}
            {filtradas.map((e) => (
              <tr key={e.id} className="border-t border-[#e4e5e3]">
                <td className="px-3 py-2 text-[19px] font-semibold tracking-[-.02em] text-[#25272a]" style={{ fontVariantNumeric: 'tabular-nums' }}>{e.numero}</td>
                <td className="px-3 py-2 text-[#25272a]" style={{ fontVariantNumeric: 'tabular-nums' }}>{e.fecha_otorgamiento ? e.fecha_otorgamiento.split('-').reverse().join('/') : '-'}</td>
                <td className="px-3 py-2 text-[#40403e]">{e.tipo_acto || '-'}</td>
                <td className="px-3 py-2 text-[#40403e]">{e.comparecientes || '-'}</td>
                <td className="px-3 py-2 text-[#626b73]">{e.folio_desde || e.folio_hasta ? `${e.folio_desde || '?'} – ${e.folio_hasta || '?'}` : '-'}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => borrar(e.id)} className="text-[#8a8f94] hover:text-[#a63d33]" aria-label={`Eliminar escritura N° ${e.numero}`}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
