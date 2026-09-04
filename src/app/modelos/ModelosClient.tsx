'use client';

import { useMemo, useRef, useState } from 'react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { ArrowLeft, Copy, Check, Download, FileSignature, Search, FolderKanban, FileDown, Sparkles, Loader2 } from 'lucide-react';
import { MODELOS, type ModeloEscrito } from '@/lib/legal/modelos';
import { Reveal } from '@/components/ui/Reveal';
import { MotionCard } from '@/components/ui/MotionCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { Badge } from '@/components/ui/Badge';
import { redactarEscritoIA, extraerDatosParaModelo } from './actions';
import { AiDisclaimer } from '@/lib/industries/disclaimers';

export type ExpedienteLite = {
  id: string;
  title: string;
  client_name: string | null;
  case_type: string | null;
  metadata: Record<string, string> | null;
};

function datosDeExpediente(exp: ExpedienteLite): Record<string, string> {
  const meta = (exp.metadata as Record<string, string>) ?? {};
  const posibles: Record<string, string | null | undefined> = {
    ...meta,
    caratula: meta.caratula ?? exp.title,
    nombre_parte: exp.client_name,
    parte: exp.client_name,
    destinatario: exp.client_name,
    numero_expediente: meta.numero_expediente ?? meta.expediente,
    juzgado: meta.juzgado,
    fuero: meta.fuero,
    parte_contraria: meta.parte_contraria,
    domicilio_destinatario: meta.domicilio ?? meta.domicilio_destinatario,
    domicilio_fisico: meta.domicilio ?? meta.domicilio_fisico,

    // Inmobiliaria fallbacks
    direccion_inmueble: meta.direccion_inmueble ?? meta.direccion ?? meta.ubicacion ?? meta.inmueble,
    tipo_inmueble: meta.tipo_inmueble ?? meta.tipo,
    moneda: meta.moneda ?? meta.divisa,
    precio: meta.precio ?? meta.valor,
    vendedor: meta.vendedor ?? (exp.case_type?.toLowerCase().includes('venta') ? exp.client_name : undefined),
    comprador: meta.comprador,
    locador: meta.locador ?? (exp.case_type?.toLowerCase().includes('alquiler') ? exp.client_name : undefined),
    locatario: meta.locatario,
    propietario: meta.propietario ?? meta.titular ?? exp.client_name,
  };
  return Object.fromEntries(
    Object.entries(posibles).filter(([, v]) => typeof v === 'string' && v.trim() !== '')
  ) as Record<string, string>;
}

function humanize(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractVars(cuerpo: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([\w-]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cuerpo)) !== null) set.add(m[1]);
  return Array.from(set);
}

function fillTemplate(cuerpo: string, values: Record<string, string>): string {
  return cuerpo.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_match, k: string) => {
    const v = values[k]?.trim();
    return v ? v : `[${humanize(k)}]`;
  });
}

type ProvinciaFiltro = 'todas' | 'Nacional' | 'Corrientes' | 'Buenos Aires';

function provinciaDeModelo(m: ModeloEscrito): 'Nacional' | 'Corrientes' | 'Buenos Aires' {
	const t = m.titulo.toLowerCase();
	if (t.includes('(corrientes)')) return 'Corrientes';
	if (t.includes('buenos aires')) return 'Buenos Aires';
	return 'Nacional';
}

export function ModelosClient({
  expedientes,
  modeloInicialId = null,
  expedienteInicialId = null,
  industria = 'legal',
  puedeIA = true,
}: {
  expedientes: ExpedienteLite[];
  modeloInicialId?: string | null;
  expedienteInicialId?: string | null;
  industria?: string;
  puedeIA?: boolean;
}) {
  const expInicial = expedientes.find((e) => e.id === expedienteInicialId) ?? null;
  const idInicial =
    modeloInicialId && MODELOS.some((m) => m.id === modeloInicialId)
      ? modeloInicialId
      : null;
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(idInicial);
  const [busqueda, setBusqueda] = useState('');
  const [provincia, setProvincia] = useState<ProvinciaFiltro>('todas');
  const [valores, setValores] = useState<Record<string, string>>(expInicial ? datosDeExpediente(expInicial) : {});
  const [copiado, setCopiado] = useState(false);
  const [expedienteId, setExpedienteId] = useState(expInicial?.id ?? '');
  const [cargandoPrellenado, setCargandoPrellenado] = useState(false);
  const [errorPrellenado, setErrorPrellenado] = useState<string | null>(null);
  const solicitudPrellenadoRef = useRef(0);
  const [instruccion, setInstruccion] = useState('');
  const [textoIA, setTextoIA] = useState<string | null>(null);
  const [redactando, setRedactando] = useState(false);
  const [avisoIA, setAvisoIA] = useState<string | null>(null);

  const seleccionado = MODELOS.find((m) => m.id === seleccionadoId) ?? null;

  const esEscribania = industria === 'escribania';
  const esInmobiliaria = industria === 'inmobiliaria';
  const placeholderIA = esEscribania
    ? 'Contale a la IA qué necesitás. Ej: escritura de compraventa entre Juan Pérez (vendedor) y Ana Gómez (compradora) sobre el inmueble de calle Falsa 123, por un valor de USD 100.000…'
    : esInmobiliaria
    ? 'Contale a la IA qué necesitás. Ej: boleto de compraventa entre Juan Pérez (vendedor) y Ana Gómez (compradora) sobre el depto de calle Falsa 123, precio USD 100.000, seña del 30%, escrituración en 60 días…'
    : 'Contale a la IA qué necesitás. Ej: demanda por despido sin causa, reclama indemnización art. 245 LCT; ingresó el 01/2020, categoría vendedor…';
  const textoDisclaimer = esEscribania
    ? 'Modelos orientativos y editables. Revisá y adaptá cada instrumento a tu jurisdicción, normativa notarial y registral y a cada caso antes de otorgarlo.'
    : esInmobiliaria
    ? 'Modelos orientativos y editables. Revisá y adaptá cada instrumento a la normativa vigente y a cada operación antes de firmarlo. No constituye asesoramiento legal.'
    : 'Modelos orientativos y editables. Revisá y adaptá cada escrito a tu jurisdicción, fuero y caso antes de presentarlo.';

  const categorias = useMemo(() => {
    const filtro = busqueda.trim().toLowerCase();
    const filtrados = MODELOS.filter((m) => {
      const coincideTexto =
        !filtro ||
        m.titulo.toLowerCase().includes(filtro) ||
        m.descripcion.toLowerCase().includes(filtro) ||
        m.categoria.toLowerCase().includes(filtro);
      const coincideProvincia =
        provincia === 'todas' || provinciaDeModelo(m) === provincia;
      const coincideIndustria = (m.industries ?? ['legal']).includes(industria);
      return coincideTexto && coincideProvincia && coincideIndustria;
    });
    const grupos = new Map<string, ModeloEscrito[]>();
    for (const m of filtrados) {
      const arr = grupos.get(m.categoria) ?? [];
      arr.push(m);
      grupos.set(m.categoria, arr);
    }
    return Array.from(grupos.entries());
  }, [busqueda, provincia, industria]);

  const isOutdatedOrRetired =
    seleccionado?.reviewStatus === 'outdated' || seleccionado?.reviewStatus === 'retired';
  const variables = seleccionado && !isOutdatedOrRetired ? extractVars(seleccionado.cuerpo) : [];
  const textoFinal = seleccionado ? fillTemplate(seleccionado.cuerpo, valores) : '';
  const textoParaMostrar = isOutdatedOrRetired
    ? `[FICHA HISTÓRICA — MODELO FUERA DE USO PRODUCTIVO]\n\n${seleccionado?.cuerpo ?? ''}`
    : (textoIA ?? textoFinal);

  const redactarIA = async () => {
    if (!puedeIA) return;
    if (!seleccionado || isOutdatedOrRetired) return;
    setRedactando(true);
    setAvisoIA(null);
    try {
      const r = await redactarEscritoIA({
        modeloId: seleccionado.id,
        valores,
        instruccion,
      });
      if (r.ok) {
        setTextoIA(r.texto);
      } else if (r.motivo === 'sin_key') {
        setAvisoIA('La redacción con IA todavía no está activada en este entorno. Podés seguir usando el relleno manual; se activa cargando la clave cuando quieras.');
      } else if (r.motivo === 'sin_permiso') {
        setAvisoIA('Tu rol no tiene acceso a la redacción con IA.');
      } else {
        setAvisoIA('No se pudo generar el borrador. Probá de nuevo en unos segundos.');
      }
    } catch {
      setAvisoIA('No se pudo generar el borrador. Probá de nuevo en unos segundos.');
    } finally {
      setRedactando(false);
    }
  };

  const abrir = (m: ModeloEscrito) => {
    setSeleccionadoId(m.id);
    const isOut = m.reviewStatus === 'outdated' || m.reviewStatus === 'retired';
    const exp = expedientes.find((e) => e.id === expedienteId);
    setValores(!isOut && exp ? datosDeExpediente(exp) : {});
    setCopiado(false);
    setTextoIA(null);
    setInstruccion('');
    setAvisoIA(null);
  };

  const aplicarExpediente = async (id: string) => {
    const solicitudActual = ++solicitudPrellenadoRef.current;

    setExpedienteId(id);
    setErrorPrellenado(null);

    if (!id || isOutdatedOrRetired) {
      setCargandoPrellenado(false);
      setValores({});
      return;
    }

    const exp = expedientes.find((e) => e.id === id);

    if (!exp) {
      setCargandoPrellenado(false);
      setValores({});
      setErrorPrellenado(`No pudimos encontrar ${esInmobiliaria ? 'la operación' : esEscribania ? 'el legajo' : 'el expediente'} seleccionado.`);
      return;
    }

    setValores(datosDeExpediente(exp));

    if (!puedeIA || (seleccionado && (seleccionado.reviewStatus === 'outdated' || seleccionado.reviewStatus === 'retired'))) {
      setCargandoPrellenado(false);
      return;
    }

    setCargandoPrellenado(true);

    try {
      const extr = await extraerDatosParaModelo(id, seleccionadoId);

      if (solicitudActual !== solicitudPrellenadoRef.current) return;

      setValores((prev) => {
        const next = { ...prev };

        for (const [k, v] of Object.entries(extr)) {
          if (v) next[k] = v;
        }

        return next;
      });
    } catch {
      if (solicitudActual !== solicitudPrellenadoRef.current) return;

      setErrorPrellenado(
        'No pudimos completar los datos del legajo. Podés reintentar o continuar manualmente.'
      );
    } finally {
      if (solicitudActual === solicitudPrellenadoRef.current) {
        setCargandoPrellenado(false);
      }
    }
  };

  const volver = () => {
    setSeleccionadoId(null);
    setValores({});
    setCopiado(false);
    setTextoIA(null);
    setInstruccion('');
    setAvisoIA(null);
  };

  const copiar = async () => {
    if (isOutdatedOrRetired) return;
    try {
      await navigator.clipboard.writeText(textoParaMostrar);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  const descargar = () => {
    if (!seleccionado || isOutdatedOrRetired) return;
    const blob = new Blob([textoParaMostrar], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${seleccionado.titulo}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const descargarDocx = async () => {
    if (!seleccionado || isOutdatedOrRetired) return;
    const parrafos = textoParaMostrar.split('\n').map(
      (linea) =>
        new Paragraph({
          children: [new TextRun({ text: linea, font: 'Times New Roman', size: 24 })],
        })
    );
    const doc = new Document({ sections: [{ children: parrafos }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${seleccionado.titulo}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <MotionCard index={0} className="p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
          {industria === 'escribania' ? 'Herramientas notariales' : industria === 'inmobiliaria' ? 'Herramientas inmobiliarias' : 'Herramientas jurídicas'}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">
          {industria === 'escribania' ? 'Modelos notariales' : industria === 'inmobiliaria' ? 'Modelos inmobiliarios' : 'Modelos de escritos'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">Elegí un modelo, completá los datos y copialo o descargalo.</p>
      </MotionCard>

      {!seleccionado && (
        <>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar modelo…"
              className="w-full rounded-xl border border-white/10 bg-white/[0.02] py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
          </div>

          {industria === 'legal' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                { id: 'todas', label: 'Todas' },
                { id: 'Nacional', label: 'Nacional' },
                { id: 'Corrientes', label: 'Corrientes' },
                { id: 'Buenos Aires', label: 'Buenos Aires' },
              ] as { id: ProvinciaFiltro; label: string }[]).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvincia(p.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    provincia === p.id
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'border border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.04]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {categorias.length === 0 && <p className="text-sm text-slate-500">No encontramos modelos para “{busqueda}”.</p>}

          <div className="space-y-6">
            {categorias.map(([categoria, modelos], idx) => (
              <Reveal key={categoria} delay={idx * 0.1}>
                <div>
                  <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{categoria}</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {modelos.map((m, i) => (
                      <MotionCard key={m.id} index={i} className="group p-0 overflow-hidden hover:border-accent/40 hover:bg-white/[0.05]">
                        <button
                          type="button"
                          onClick={() => abrir(m)}
                          className="flex h-full w-full flex-col items-start p-5 text-left transition-all"
                        >
                          <div className="mb-3 flex w-full items-center justify-between">
                            <div className="inline-flex rounded-xl border border-accent/20 bg-accent/[0.08] p-2 text-accent-soft">
                              <FileSignature className="h-5 w-5" />
                            </div>
                            {m.reviewStatus === 'outdated' ? (
                              <Badge tone="danger">Desactualizado</Badge>
                            ) : m.reviewStatus === 'verified' ? (
                              <Badge tone="success">Verificado</Badge>
                            ) : (
                              <Badge tone="warning">Pendiente revisión</Badge>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-white">{m.titulo}</span>
                          <span className="mt-1 text-xs text-slate-400">{m.descripcion}</span>
                          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                            <span className="rounded bg-white/5 px-1.5 py-0.5 font-medium">{m.jurisdiction ?? 'Nacional'}</span>
                            <span>•</span>
                            <span>v{m.version ?? '1.0'}</span>
                            {m.lastVerifiedAt && (
                              <>
                                <span>•</span>
                                <span>Rev: {m.lastVerifiedAt}</span>
                              </>
                            )}
                          </div>
                        </button>
                      </MotionCard>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </>
      )}

      {seleccionado && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={volver}
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al catálogo
          </button>

          <div className="grid gap-4 lg:grid-cols-2">
            <MotionCard index={1} className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-white">{seleccionado.titulo}</h2>
              {isOutdatedOrRetired ? (
                <div className="space-y-4" data-testid="ficha-historica-outdated">
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <div className="flex items-center gap-2">
                      <Badge tone="danger">Modelo fuera de uso productivo</Badge>
                      <span className="text-xs text-red-300 font-semibold uppercase tracking-wide">
                        {seleccionado.reviewStatus === 'outdated' ? 'Desactualizado' : 'Retirado'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-red-200">
                      {seleccionado.professionalDisclaimer ||
                        'La Ley 27.742 derogó el régimen sancionatorio de la Ley 24.013 y del art. 80 LCT. Este modelo se conserva en la biblioteca exclusivamente con fines históricos y de trazabilidad.'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs space-y-2.5 text-slate-300">
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-slate-400">Jurisdicción:</span>
                      <span className="font-semibold text-white">{seleccionado.jurisdiction ?? 'Nacional'}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-slate-400">Estado normativo:</span>
                      <span className="font-semibold text-red-400">Bloqueado para uso productivo</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-slate-400">Versión de catálogo:</span>
                      <span className="font-semibold text-white">v{seleccionado.version ?? '1.0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Última revisión:</span>
                      <span className="font-semibold text-white">{seleccionado.lastVerifiedAt ?? 'No registrada'}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-200 leading-relaxed">
                    🔒 <strong>Ficha histórica restringida:</strong> No se admite edición manual, carga de variables, prellenado desde legajo, redacción asistida con IA ni exportación (TXT / Word). Este escrito se mantiene exclusivamente para fines de consulta histórica.
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {expedientes.length > 0 && (
                    <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                      <label className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                        <FolderKanban className="h-3.5 w-3.5" />
                        Prellenar desde {industria === 'inmobiliaria' ? 'una operación' : industria === 'escribania' ? 'un legajo' : 'un expediente'}
                      </label>
                      <select
                        value={expedienteId}
                        onChange={(e) => aplicarExpediente(e.target.value)}
                        disabled={cargandoPrellenado}
                        aria-busy={cargandoPrellenado}
                        data-testid="modelos-expediente-select"
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:cursor-wait disabled:opacity-60"
                      >
                        <option value="" className="text-slate-900">— Sin selección (completar a mano) —</option>
                        {expedientes.map((exp) => (
                          <option key={exp.id} value={exp.id} className="text-slate-900">
                            {exp.title || 'Sin título'}{exp.client_name ? ` — ${exp.client_name}` : ''}
                          </option>
                        ))}
                      </select>
                      {expedienteId ? (
                        cargandoPrellenado ? (
                          <div
                            className="mt-2 flex items-center gap-2 text-[11px] text-cyan-300"
                            role="status"
                            aria-live="polite"
                          >
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>
                              Analizando los documentos y preparando el modelo… Esto puede demorar unos segundos.
                            </span>
                          </div>
                        ) : errorPrellenado ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-amber-400">
                            <span>{errorPrellenado}</span>
                            <button
                              type="button"
                              onClick={() => aplicarExpediente(expedienteId)}
                              className="font-semibold underline hover:text-amber-300"
                            >
                              Reintentar
                            </button>
                          </div>
                        ) : (() => {
                          const filledCount = variables.filter(
                            (key) => valores[key] && valores[key].trim() !== ''
                          ).length;

                          if (filledCount === 0) {
                            return (
                              <p className="mt-1.5 text-[11px] text-amber-400">
                                No encontramos datos suficientes para prellenar este modelo. Podés completarlo manualmente.
                              </p>
                            );
                          }

                          if (filledCount < variables.length) {
                            return (
                              <p className="mt-1.5 text-[11px] text-emerald-400">
                                Se completaron los datos disponibles. Revisá y completá los campos pendientes.
                              </p>
                            );
                          }

                          return (
                            <p className="mt-1.5 text-[11px] text-emerald-400">
                              Se completaron todos los campos requeridos con éxito.
                            </p>
                          );
                        })()
                      ) : (
                        <p className="mt-1.5 text-[11px] text-slate-400">
                          Completa carátula, parte y datos disponibles automáticamente. Podés editar todo abajo.
                        </p>
                      )}
                    </div>
                  )}
                  {variables.length === 0 && <p className="text-sm text-slate-500">Este modelo no tiene campos para completar.</p>}
                  {variables.map((key) => {
                    const datosBase = expedienteId ? expedientes.find(e => e.id === expedienteId) : null;
                    const extracted = datosBase ? datosDeExpediente(datosBase) : {};
                    const isPreloaded = !!extracted[key];
                    const hasValue = !!valores[key];

                    return (
                      <label key={key} className="block relative">
                        <div className="flex justify-between items-end mb-1">
                          <span className="block text-xs font-semibold text-slate-400">{humanize(key)}</span>
                          {isPreloaded ? (
                            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">Precargado</span>
                          ) : !hasValue ? (
                            <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">Faltante</span>
                          ) : null}
                        </div>
                        <input
                          value={valores[key] ?? ''}
                          onChange={(e) => setValores((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={`Completar ${humanize(key).toLowerCase()}`}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                        />
                      </label>
                    );
                  })}

                  {puedeIA && (
                    <div className="mt-4 rounded-xl border border-brandviolet/20 bg-brandviolet/10 p-3">
                      <label className="flex items-center gap-2 text-xs font-semibold text-brandviolet">
                        <Sparkles className="h-3.5 w-3.5" />
                        Redactar con IA (opcional)
                      </label>
                      <textarea
                        value={instruccion}
                        onChange={(e) => setInstruccion(e.target.value)}
                        rows={3}
                        placeholder={placeholderIA}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brandviolet focus:ring-1 focus:ring-brandviolet"
                      />
                      <MotionButton
                        type="button"
                        onClick={redactarIA}
                        disabled={redactando}
                        data-testid="btn-redactar-ia"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-brandviolet px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-60"
                      >
                        {redactando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {redactando ? 'Redactando…' : 'Redactar con IA'}
                      </MotionButton>
                      {avisoIA && <p className="mt-2 text-[11px] text-amber-500">{avisoIA}</p>}
                      {textoIA && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-brandviolet">✨ Borrador generado con IA — {esEscribania ? 'revisalo antes de otorgar o firmar.' : esInmobiliaria ? 'revisalo antes de utilizarlo.' : 'revisalo antes de presentar.'}</span>
                            <button type="button" onClick={() => setTextoIA(null)} className="shrink-0 text-[11px] font-semibold text-slate-400 hover:text-white underline">
                              Volver al relleno manual
                            </button>
                          </div>
                          <AiDisclaimer industry={industria} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </MotionCard>

            <MotionCard index={2} className="flex flex-col">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold text-white">Vista previa</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copiar}
                    disabled={isOutdatedOrRetired}
                    data-testid="btn-copiar-modelo"
                    title={isOutdatedOrRetired ? 'Bloqueado para uso productivo' : 'Copiar'}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      isOutdatedOrRetired
                        ? 'border-white/5 bg-white/[0.01] text-slate-500 cursor-not-allowed opacity-50'
                        : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    {copiado ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                  <button
                    type="button"
                    onClick={descargar}
                    disabled={isOutdatedOrRetired}
                    data-testid="btn-descargar-txt"
                    title={isOutdatedOrRetired ? 'Bloqueado para uso productivo' : 'Descargar .txt'}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      isOutdatedOrRetired
                        ? 'border-white/5 bg-white/[0.01] text-slate-500 cursor-not-allowed opacity-50'
                        : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Download className="h-3.5 w-3.5" /> Descargar .txt
                  </button>
                  <MotionButton
                    type="button"
                    onClick={descargarDocx}
                    disabled={isOutdatedOrRetired}
                    data-testid="btn-descargar-docx"
                    title={isOutdatedOrRetired ? 'Bloqueado para uso productivo' : 'Descargar Word'}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      isOutdatedOrRetired
                        ? 'border-white/5 bg-white/[0.01] text-slate-500 cursor-not-allowed opacity-50'
                        : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20'
                    }`}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Word (.docx)
                  </MotionButton>
                </div>
              </div>
              <pre className="mt-4 max-h-[520px] flex-1 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-white/[0.01] p-4 font-sans text-sm leading-relaxed text-slate-300">{textoParaMostrar}</pre>
            </MotionCard>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-xs text-amber-200">
              ⚠️ {textoDisclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
