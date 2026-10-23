'use client';

import { useEffect, useMemo, useRef, useState, useId, type ReactNode } from 'react';
import styles from './ModelosWorkspace.module.css';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { ArrowLeft, Copy, Check, Download, FileSignature, Search, FolderKanban, FileDown, Sparkles, Loader2 } from 'lucide-react';
import { MODELOS, type ModeloEscrito } from '@/lib/legal/modelos';
import { MotionButton } from '@/components/ui/MotionButton';
import { Badge } from '@/components/ui/Badge';
import { redactarEscritoIA, extraerDatosParaModelo } from './actions';
import { AiDisclaimer } from '@/lib/industries/disclaimers';
import type { IndustryType } from '@/lib/industries/documentTypes';

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
    moneda: meta.moneda_operacion ?? meta.moneda ?? meta.divisa,
    precio: meta.valor_operacion ?? meta.precio ?? meta.valor,
    precio_mensual: meta.valor_operacion ?? meta.precio ?? meta.valor,
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
  review,
}: {
  expedientes: ExpedienteLite[];
  modeloInicialId?: string | null;
  expedienteInicialId?: string | null;
  industria?: IndustryType;
  puedeIA?: boolean;
  review?: ReactNode;
}) {
  const expInicial = expedientes.find((e) => e.id === expedienteInicialId) ?? null;
  const idInicial =
    modeloInicialId &&
    MODELOS.some(
      (m) =>
        m.id === modeloInicialId &&
        (m.industries ?? ['legal']).includes(industria)
    )
      ? modeloInicialId
      : null;
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(idInicial);
  const [step, setStep] = useState<'datos' | 'borrador'>('datos');
  const stepId = useId();
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
  const placeholderIA = useMemo(() => {
    if (esEscribania) {
      if (seleccionadoId === 'notarial-poder-especial') {
        return 'Contale a la IA qué necesitás. Ej: poder especial para escriturar el inmueble de Av. Corrientes 1234, CABA, facultando al apoderado a otorgar la escritura traslativa de dominio y percibir el saldo…';
      }
      if (seleccionadoId === 'notarial-certificacion-firmas') {
        return 'Contale a la IA qué necesitás. Ej: certificación notarial de firmas puestas en mi presencia en contrato de locación entre partes individualizadas…';
      }
      if (seleccionadoId === 'notarial-acta-constatacion') {
        return 'Contale a la IA qué necesitás. Ej: acta de constatación del estado físico de la unidad funcional sita en Av. Santa Fe 2000 a requerimiento de parte…';
      }
      if (seleccionadoId === 'notarial-cesion-derechos-hereditarios') {
        return 'Contale a la IA qué necesitás. Ej: cesión onerosa de derechos y acciones hereditarios de los autos sucesorios Martínez s/ Sucesión…';
      }
      return 'Contale a la IA qué necesitás. Ej: escritura de compraventa entre Juan Pérez (vendedor) y Ana Gómez (compradora) sobre el inmueble de calle Falsa 123, por un valor de USD 100.000…';
    }
    if (esInmobiliaria) {
      return 'Contale a la IA qué necesitás. Ej: boleto de compraventa entre Juan Pérez (vendedor) y Ana Gómez (compradora) sobre el depto de calle Falsa 123, precio USD 100.000, seña del 30%, escrituración en 60 días…';
    }
    return 'Contale a la IA qué necesitás. Ej: demanda por despido sin causa, reclama indemnización art. 245 LCT; ingresó el 01/2020, categoría vendedor…';
  }, [esEscribania, esInmobiliaria, seleccionadoId]);
  const textoDisclaimer = esEscribania
    ? 'Modelos orientativos y editables. Revisá y adaptá cada instrumento a tu jurisdicción, normativa notarial y registral y a cada caso antes de otorgarlo.'
    : esInmobiliaria
    ? 'Modelos orientativos y editables. Revisá y adaptá cada instrumento a la normativa vigente y a cada operación antes de firmarlo. No constituye asesoramiento legal.'
    : 'Modelos orientativos y editables. Revisá y adaptá cada escrito a tu jurisdicción, fuero y caso antes de presentarlo.';

  const categorias = useMemo(() => {
    const filtro = busqueda.trim().toLowerCase();
    const filtrados = MODELOS.filter((m) => {
      // Excluir modelos obsoletos o retirados del catálogo general y búsquedas
      if (m.reviewStatus === 'outdated' || m.reviewStatus === 'retired') {
        return false;
      }
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
        `No pudimos completar los datos ${
          esInmobiliaria ? 'de la operación' : esEscribania ? 'del legajo' : 'del expediente'
        }. Podés reintentar o continuar manualmente.`
      );
    } finally {
      if (solicitudActual === solicitudPrellenadoRef.current) {
        setCargandoPrellenado(false);
      }
    }
  };

  useEffect(() => {
    if (!expedienteInicialId || !seleccionadoId) return;
    let activo = true;
    void Promise.resolve().then(async () => {
      if (!activo) return;
      await aplicarExpediente(expedienteInicialId);
    });
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expedienteInicialId, seleccionadoId]);

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

  return <div className={styles.root}>
    <header className={styles.modelsHead}><div><p className={styles.eyebrow}>{industria === 'escribania' ? 'Herramientas notariales' : industria === 'inmobiliaria' ? 'Herramientas inmobiliarias' : 'Herramientas jurídicas'}</p><h1>{industria === 'escribania' ? 'Modelos notariales' : industria === 'inmobiliaria' ? 'Modelos inmobiliarios' : 'Modelos de escritos'}</h1><p>Elegí un modelo, completá los datos y revisá el borrador antes de usarlo.</p></div><aside className={styles.orientationNote}>Modelos orientativos. No sustituyen la revisión profesional ni garantizan adecuación a tu caso.</aside></header>
    <div className={styles.modelsLayout}>
      <aside className={styles.modelCatalog} aria-label="Catálogo de modelos"><div className={styles.catalogTop}><h2>Biblioteca de modelos</h2><label className={styles.searchField}><Search size={18} aria-hidden/><input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar modelo…" aria-label="Buscar modelo"/></label>
      {industria==='legal'&&<div className={styles.filterChips} aria-label="Jurisdicción">{(['todas','Nacional','Corrientes','Buenos Aires'] as ProvinciaFiltro[]).map(p=><button key={p} type="button" aria-pressed={provincia===p} onClick={()=>setProvincia(p)}>{p==='todas'?'Todas':p}</button>)}</div>}</div>
      <div className={styles.catalogList}>{categorias.length===0&&<p className={styles.noResults}>No encontramos modelos para “{busqueda}”.</p>}{categorias.map(([categoria,modelos])=><div key={categoria}><h3 className={styles.categoryLabel}>{categoria}</h3>{modelos.map(m=><button key={m.id} type="button" className={styles.modelItem} aria-current={seleccionadoId===m.id?'true':undefined} onClick={()=>{abrir(m);setStep('datos');}}><FileSignature size={19} aria-hidden/><span><strong>{m.titulo}</strong><small>{m.descripcion}</small><small>{m.jurisdiction??'Nacional'} · v{m.version??'1.0'} · {m.reviewStatus==='verified'?'Modelo auditado con fuente oficial':'Modelo orientativo editable'}</small><small>Requiere revisión profesional</small></span><span aria-hidden>›</span></button>)}</div>)}</div></aside>
      <div className={styles.modelWorkspace}>
      {!seleccionado?<div className={styles.emptyWorkspace}><FileSignature size={36} aria-hidden/><h2>Un modelo, tu próximo borrador.</h2><p>Seleccioná un modelo de la biblioteca para completar los datos y revisar el resultado.</p></div>:<>
      <header className={styles.workspaceHeader}><p className={styles.eyebrow}>MODELO SELECCIONADO</p><button type="button" onClick={volver}><ArrowLeft size={16} aria-hidden/> Volver al catálogo</button></header>
      <div className={styles.stepTabs} role="tablist" aria-label="Pasos del modelo">{(['datos','borrador'] as const).map((tab,index)=><button key={tab} id={`${stepId}-${tab}`} role="tab" type="button" aria-selected={step===tab} tabIndex={step===tab?0:-1} aria-controls={`${stepId}-${tab}-panel`} onClick={()=>setStep(tab)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'datos':e.key==='End'?'borrador':tab==='datos'?'borrador':'datos';setStep(next);document.getElementById(`${stepId}-${next}`)?.focus();}}}>{index+1}. {tab==='datos'?'Completar datos':'Revisar borrador'}</button>)}</div>
      <div className={styles.workspaceBody}>
      <div id={`${stepId}-datos-panel`} role="tabpanel" aria-labelledby={`${stepId}-datos`} hidden={step!=='datos'}><section className={styles.editor}>
              <h2>{seleccionado.titulo}</h2>
              {isOutdatedOrRetired ? (
                <div data-testid="ficha-historica-outdated">
                  <div>
                    <div>
                      <Badge tone="danger">Modelo fuera de uso productivo</Badge>
                      <span>
                        {seleccionado.reviewStatus === 'outdated' ? 'Desactualizado' : 'Retirado'}
                      </span>
                    </div>
                    <p>
                      {seleccionado.professionalDisclaimer ||
                        'La Ley 27.742 derogó el régimen sancionatorio de la Ley 24.013 y del art. 80 LCT. Este modelo se conserva en la biblioteca exclusivamente con fines históricos y de trazabilidad.'}
                    </p>
                  </div>

                  <div>
                    <div>
                      <span>Jurisdicción:</span>
                      <span>{seleccionado.jurisdiction ?? 'Nacional'}</span>
                    </div>
                    <div>
                      <span>Estado normativo:</span>
                      <span>Bloqueado para uso productivo</span>
                    </div>
                    <div>
                      <span>Versión de catálogo:</span>
                      <span>v{seleccionado.version ?? '1.0'}</span>
                    </div>
                    <div>
                      <span>Última revisión:</span>
                      <span>{seleccionado.lastVerifiedAt ?? 'No registrada'}</span>
                    </div>
                  </div>

                  <div>
                    🔒 <strong>Ficha histórica restringida:</strong> No se admite edición manual, carga de variables, prellenado desde legajo, redacción asistida con IA ni exportación (TXT / Word). Este escrito se mantiene exclusivamente para fines de consulta histórica.
                  </div>
                </div>
              ) : (
                <div>
                  <div>
                    <div>
                      <span>Estado normativo:</span>
                      {seleccionado.reviewStatus === 'verified' ? (
                        <span>Modelo auditado con fuente oficial</span>
                      ) : (
                        <span>Modelo orientativo editable</span>
                      )}
                    </div>
                    <div>
                      <span>Jurisdicción:</span>
                      <span>{seleccionado.jurisdiction ?? 'Nacional'}</span>
                    </div>
                    <div>
                      <span>Versión / Revisión:</span>
                      <span>
                        v{seleccionado.version ?? '1.0'} • {seleccionado.lastReviewedAt ?? seleccionado.lastVerifiedAt ?? 'Fecha de revisión normativa no registrada'}
                      </span>
                    </div>
                    <div>
                      <span>Fuentes oficiales:</span>
                      <span>
                        {seleccionado.officialSources && seleccionado.officialSources.length > 0
                          ? seleccionado.officialSources.join(', ')
                          : 'Fuente oficial no registrada'}
                      </span>
                    </div>
                    <div>
                      ⚠️ Requiere revisión profesional antes de su utilización judicial o firma.
                    </div>
                  </div>

                  {expedientes.length > 0 && (
                    <div>
                      <label>
                        <FolderKanban />
                        Prellenar desde {industria === 'inmobiliaria' ? 'una operación' : industria === 'escribania' ? 'un legajo' : 'un expediente'}
                      </label>
                      <select
                        value={expedienteId}
                        onChange={(e) => aplicarExpediente(e.target.value)}
                        disabled={cargandoPrellenado}
                        aria-busy={cargandoPrellenado}
                        data-testid="modelos-expediente-select"

                      >
                        <option value="">— Sin selección (completar a mano) —</option>
                        {expedientes.map((exp) => (
                          <option key={exp.id} value={exp.id}>
                            {exp.title || 'Sin título'}{exp.client_name ? ` — ${exp.client_name}` : ''}
                          </option>
                        ))}
                      </select>
                      {expedienteId ? (
                        cargandoPrellenado ? (
                          <div

                            role="status"
                            aria-live="polite"
                          >
                            <Loader2 />
                            <span>
                              Analizando los documentos y preparando el modelo… Esto puede demorar unos segundos.
                            </span>
                          </div>
                        ) : errorPrellenado ? (
                          <div>
                            <span>{errorPrellenado}</span>
                            <button
                              type="button"
                              onClick={() => aplicarExpediente(expedienteId)}

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
                              <p>
                                No encontramos datos suficientes para prellenar este modelo. Podés completarlo manualmente.
                              </p>
                            );
                          }

                          if (filledCount < variables.length) {
                            return (
                              <p>
                                Se completaron los datos disponibles. Revisá y completá los campos pendientes.
                              </p>
                            );
                          }

                          return (
                            <p>
                              Se completaron todos los campos requeridos con éxito.
                            </p>
                          );
                        })()
                      ) : (
                        <p>
                          Completa carátula, parte y datos disponibles automáticamente. Podés editar todo abajo.
                        </p>
                      )}
                    </div>
                  )}
                  {variables.length === 0 && <p>Este modelo no tiene campos para completar.</p>}
                  <div className={styles.fieldGrid}>{variables.map((key) => {
                    const datosBase = expedienteId ? expedientes.find(e => e.id === expedienteId) : null;
                    const extracted = datosBase ? datosDeExpediente(datosBase) : {};
                    const isPreloaded = !!extracted[key];
                    const hasValue = !!valores[key];

                    return (
                      <label key={key}>
                        <div>
                          <span>{humanize(key)}</span>
                          {isPreloaded ? (
                            <span>Precargado</span>
                          ) : !hasValue ? (
                            <span>Faltante</span>
                          ) : null}
                        </div>
                        <input
                          value={valores[key] ?? ''}
                          onChange={(e) => setValores((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={`Completar ${humanize(key).toLowerCase()}`}

                        />
                      </label>
                    );
                  })}</div>

                  {puedeIA && (
                    <div>
                      <label>
                        <Sparkles />
                        Redactar con IA (opcional)
                      </label>
                      <textarea
                        value={instruccion}
                        onChange={(e) => setInstruccion(e.target.value)}
                        rows={3}
                        placeholder={placeholderIA}

                      />
                      <MotionButton
                        type="button"
                        onClick={redactarIA}
                        disabled={redactando}
                        data-testid="btn-redactar-ia"

                      >
                        {redactando ? <Loader2 /> : <Sparkles />}
                        {redactando ? 'Redactando…' : 'Redactar con IA'}
                      </MotionButton>
                      {avisoIA && <p>{avisoIA}</p>}
                      {textoIA && (
                        <div>
                          <div>
                            <span>✨ Borrador generado con IA — {esEscribania ? 'revisalo antes de otorgar o firmar.' : esInmobiliaria ? 'revisalo antes de utilizarlo.' : 'revisalo antes de presentar.'}</span>
                            <button type="button" onClick={() => setTextoIA(null)}>
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
            </section><div className={styles.actionRow}><button type="button" onClick={()=>setStep('borrador')}>Revisar borrador →</button></div></div>
      <div id={`${stepId}-borrador-panel`} role="tabpanel" aria-labelledby={`${stepId}-borrador`} hidden={step!=='borrador'}><section className={styles.previewPane}>
              <div>
                <h2>Vista previa</h2>
                <div>
                  <button
                    type="button"
                    onClick={copiar}
                    disabled={isOutdatedOrRetired}
                    data-testid="btn-copiar-modelo"
                    title={isOutdatedOrRetired ? 'Bloqueado para uso productivo' : 'Copiar'}

                  >
                    {copiado ? <Check /> : <Copy />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                  <button
                    type="button"
                    onClick={descargar}
                    disabled={isOutdatedOrRetired}
                    data-testid="btn-descargar-txt"
                    title={isOutdatedOrRetired ? 'Bloqueado para uso productivo' : 'Descargar .txt'}

                  >
                    <Download /> Descargar .txt
                  </button>
                  <MotionButton
                    type="button"
                    onClick={descargarDocx}
                    disabled={isOutdatedOrRetired}
                    data-testid="btn-descargar-docx"
                    title={isOutdatedOrRetired ? 'Bloqueado para uso productivo' : 'Descargar Word'}

                  >
                    <FileDown />
                    Word (.docx)
                  </MotionButton>
                </div>
              </div>
              <pre>{textoParaMostrar}</pre>
            </section></div>
      <div className={styles.warningBox}><strong>Plantilla genérica elaborada con fines operativos.</strong> Revisá competencia, procedimiento, plazos, hechos, prueba y normativa vigente aplicable al caso.</div>
      </div></>}
      {review&&puedeIA&&<details className={styles.secondaryReview}><summary>Revisión opcional con IA · Revisar un escrito propio</summary><div>{review}</div></details>}
      </div>
    </div><p className={styles.scope}>{textoDisclaimer}</p>
  </div>;
}
