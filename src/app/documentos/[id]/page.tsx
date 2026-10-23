import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canUseAi } from '@/lib/permissions/roles';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import { getDocumentTypeLabel, normalizeIndustryType } from '@/lib/industries/documentTypes';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { formatFileSize } from '@/lib/format/fileSize';
import { getDocumentExpiryStatus } from '@/lib/documents/expiry';
import { esPlazoAccionable } from '@/lib/plazos/plazos';

import { PlazosDetectados } from './PlazosDetectados';
import styles from './Viewer.module.css';
import { DocumentViewer } from './DocumentViewer';
import { FileSignature, Archive, ArchiveRestore } from 'lucide-react';
import { archiveDocument, unarchiveDocument, deleteDocument } from '../actions';
import { canArchiveDocument, canDeleteDocument, isUserRole } from '@/lib/permissions/roles';
import { sugerirModeloPorTipo, sugerirModeloNotarialPorTipo, sugerirModeloInmobiliarioPorTipo } from '@/lib/legal/modelos';
import { getCaseBasePath } from '@/lib/industries/caseConfig';
import { AnalyzeDetailButtonClient } from './AnalyzeDetailButtonClient';
import { AnalizarPoderButton } from './AnalizarPoderButton';
import type { DocumentRecord } from '@/types/document';

interface DocumentDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; analysis?: string }>;
}

interface AiAnalysisResult {
  modo?: string;
  resumen?: string;
  tipo_documental_detectado?: string;
  sensibilidad_detectada?: string;
  datos_relevantes?: string[];
  alertas?: string[];
  proximas_acciones?: string[];
  fechas_plazos?: { descripcion: string; fecha: string }[];
  texto_extraido_preview?: string;
  caracteres_extraidos?: number;
}

interface AiOutputRecord {
  id: string;
  output_type: string;
  model_name?: string | null;
  result_json?: AiAnalysisResult | null;
  created_at?: string | null;
}

function sensitivityLabel(value?: string | null) {
  const normalizedValue = String(value ?? '').toLowerCase();

  const labels: Record<string, string> = {
    low: 'Bajo',
    medium: 'Medio',
    high: 'Alto',
    critical: 'Crítico',
    bajo: 'Bajo',
    medio: 'Medio',
    alto: 'Alto',
    critico: 'Crítico',
    crítico: 'Crítico',
  };

  return labels[normalizedValue] ?? value ?? 'Sin clasificar';
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatExpiryDate(value?: string | null) {
  if (!value) return 'Sin fecha de vencimiento';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function getErrorMessage(error?: string) {
  const messages: Record<string, string> = {
    only_pdf_supported:
      'Por ahora el análisis IA solo está disponible para documentos PDF.',
    download_failed: 'No se pudo descargar el archivo desde Storage.',
    empty_pdf_text:
      'No se pudo extraer texto del PDF. Puede ser un PDF escaneado.',
    ai_save_failed: 'El análisis se generó, pero no se pudo guardar.',
  };

  return error ? messages[error] : null;
}

function getDocumentAiStatus(count: number) {
  if (count <= 0) return 'Sin análisis';
  if (count === 1) return 'Analizado';
  return `Reanalizado x${count}`;
}

function normalizeText(value?: string | null) {
  return String(value ?? '').toLowerCase();
}

function getRiskAssessment(
  document: DocumentRecord,
  aiResult?: AiAnalysisResult | null,
  industry?: any
) {
  const terms = getIndustryTerms(industry ?? 'general');
  const manualSensitivity = normalizeText(document.sensitivity_level);
  const detectedSensitivity = normalizeText(aiResult?.sensibilidad_detectada);
  const alertsCount = aiResult?.alertas?.length ?? 0;
  const extractedChars = aiResult?.caracteres_extraidos ?? 0;

  let score = 25;

  if (manualSensitivity.includes('medium')) score = 45;
  if (manualSensitivity.includes('high')) score = 70;
  if (manualSensitivity.includes('critical')) score = 90;

  if (detectedSensitivity.includes('medium')) score = Math.max(score, 45);
  if (detectedSensitivity.includes('high')) score = Math.max(score, 70);
  if (detectedSensitivity.includes('critical')) score = Math.max(score, 90);

  if (alertsCount >= 1) score += 10;
  if (alertsCount >= 2) score += 10;
  if (extractedChars > 0 && extractedChars < 500) score += 10;

  score = Math.min(score, 100);

  if (score >= 80) {
    return {
      label: 'Crítico',
      score,
      className: 'bg-rose-50 text-rose-700 border-rose-200',
      barClassName: 'bg-rose-500',
      description:
        `Documento de alta sensibilidad. Conviene mantener acceso restringido, revisar permisos y asociarlo correctamente ${terms.delExpediente}.`,
    };
  }

  if (score >= 60) {
    return {
      label: 'Alto',
      score,
      className: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
      barClassName: 'bg-amber-500',
      description:
        'Documento sensible. Requiere validación operativa, control de acceso y revisión de información personal o institucional.',
    };
  }

  if (score >= 35) {
    return {
      label: 'Medio',
      score,
      className: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
      barClassName: 'bg-cyan-500',
      description:
        'Documento de sensibilidad moderada. Puede gestionarse con controles estándar y revisión documental básica.',
    };
  }

  return {
    label: 'Bajo',
    score,
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
    barClassName: 'bg-emerald-500',
    description:
      'Documento de bajo riesgo operativo. Mantener clasificación y registro dentro de la bóveda documental.',
    };
}

function toText(x: unknown): string {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  if (typeof x === 'number' || typeof x === 'boolean') return String(x);
  if (typeof x === 'object') {
    const o = x as Record<string, unknown>;
    const nombre = [o.nombre, o.parte, o.nombre_completo, o.razon_social, o.titulo]
      .find((v) => typeof v === 'string') as string | undefined;
    const rol = typeof o.rol === 'string' ? o.rol : undefined;
    if (nombre) return rol ? `${nombre} (${rol})` : nombre;
    const desc = [o.descripcion, o.texto, o.detalle]
      .find((v) => typeof v === 'string') as string | undefined;
    if (desc) return desc;
    const vals = Object.values(o).filter(
      (v) => typeof v === 'string' || typeof v === 'number'
    );
    return vals.length ? vals.join(' — ') : JSON.stringify(o);
  }
  return String(x);
}

function buildSuggestedChecklist(
  document: DocumentRecord,
  aiResult?: AiAnalysisResult | null,
  industry?: any
) {
  const terms = getIndustryTerms(industry ?? 'general');
  const detectedType = normalizeText(aiResult?.tipo_documental_detectado);
  const manualType = normalizeText(document.document_type);
  const fileName = normalizeText(document.file_name);

  const source = `${detectedType} ${manualType} ${fileName}`;

  if (
    source.includes('contrato') ||
    source.includes('compraventa') ||
    source.includes('alquiler') ||
    source.includes('real_estate')
  ) {
    return [
      'Verificar identificación de las partes intervinientes.',
      'Controlar fechas, firmas y vigencia del documento.',
      'Revisar montos, condiciones, cláusulas y anexos asociados.',
      `Confirmar que el documento esté vinculado ${terms.delExpediente} correspondiente.`,
      'Validar si corresponde marcarlo como documento sensible.',
    ];
  }

  if (
    source.includes('plan') ||
    source.includes('estudio') ||
    source.includes('acad') ||
    source.includes('curricular')
  ) {
    return [
      'Verificar institución emisora y carrera o programa académico.',
      'Revisar materias, carga horaria, correlatividades y fechas.',
      'Confirmar si el documento requiere certificación o firma institucional.',
      'Clasificar el archivo como académico o curricular.',
      `Asociar el documento ${terms.delExpediente} correspondiente si aplica.`,
    ];
  }

  return [
    'Verificar nombre del archivo y tipo documental.',
    'Revisar si contiene datos personales, financieros o institucionales.',
    `Confirmar que esté asociado ${terms.delExpediente} correspondiente.`,
    'Validar nivel de sensibilidad asignado.',
    'Registrar observaciones si requiere revisión manual.',
  ];
}

function buildMissingDocuments(
  document: DocumentRecord,
  aiResult?: AiAnalysisResult | null
) {
  const detectedType = normalizeText(aiResult?.tipo_documental_detectado);
  const manualType = normalizeText(document.document_type);
  const fileName = normalizeText(document.file_name);

  const source = `${detectedType} ${manualType} ${fileName}`;

  if (
    source.includes('contrato') ||
    source.includes('compraventa') ||
    source.includes('alquiler') ||
    source.includes('real_estate')
  ) {
    return [
      'DNI o CUIT de las partes.',
      'Comprobante o constancia respaldatoria.',
      'Anexos o documentación complementaria.',
      'Firma o validación final si corresponde.',
    ];
  }

  if (
    source.includes('plan') ||
    source.includes('estudio') ||
    source.includes('acad') ||
    source.includes('curricular')
  ) {
    return [
      'Constancia institucional si corresponde.',
      'Programa completo o resolución vinculada.',
      'Certificación, firma o sello si aplica.',
    ];
  }

  return [
    'Documento respaldatorio asociado.',
    'Validación de origen o emisor.',
    'Archivo complementario si corresponde.',
  ];
}

function buildSecurityRecommendations(
  document: DocumentRecord,
  aiResult?: AiAnalysisResult | null,
  industry?: any
) {
  const terms = getIndustryTerms(industry ?? 'general');
  const risk = getRiskAssessment(document, aiResult, industry);

  if (risk.score >= 60) {
    return [
      'Mantener el documento en acceso restringido.',
      'Evitar compartir enlaces temporales fuera del equipo autorizado.',
      'Revisar permisos de usuarios antes de habilitar descarga.',
      'Conservar registro de auditoría ante cada visualización o análisis.',
    ];
  }

  return [
    'Mantener clasificación documental actualizada.',
    `Revisar permisos si el documento se asocia a ${terms.unExpediente} sensible.`,
    'Usar enlaces temporales únicamente cuando sea necesario.',
  ];
}

export default async function DocumentDetailPage({
  params,
  searchParams,
}: DocumentDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;

  const { user, profile } = await getUserProfile();
  const puedeUsarIA = profile ? canUseAi(profile.role) : false;

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const supabase = await createClient();

  const { data } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!data) notFound();

  const document = data as DocumentRecord;

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();
  const industria = normalizeIndustryType(orgRow?.industry_type);

  const { data: signedUrlData } = await supabase.storage
    .from('documents')
    .createSignedUrl(document.file_path, 60 * 5);

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'document_viewed',
    resourceType: 'document',
    resourceId: document.id,
    metadata: {
      file_name: document.file_name,
      document_type: document.document_type,
    },
  });

  const signedUrl = signedUrlData?.signedUrl ?? null;
  if (!document) {
    notFound();
  }

  const canArchive = isUserRole(profile.role) && canArchiveDocument(profile.role);
  const canDelete  = isUserRole(profile.role) && canDeleteDocument(profile.role);

  const { data: aiOutputs, error: aiReadError } = await supabase
    .from('ai_outputs')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('document_id', document.id)
    .eq('output_type', 'document_analysis')
    .order('created_at', { ascending: false });

  const aiHistory = (aiOutputs ?? []) as AiOutputRecord[];
  const latestAiOutput = aiHistory[0] ?? null;
  const previousAiOutputs = aiHistory.slice(1);
  const aiResult = latestAiOutput?.result_json ?? null;

  const { data: poderData } = await supabase
    .from('ai_outputs')
    .select('result_json, created_at')
    .eq('document_id', document.id)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'document_poder')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const checklist = buildSuggestedChecklist(document, aiResult, industria);
  const missingDocuments = buildMissingDocuments(document, aiResult);
  const securityRecommendations = buildSecurityRecommendations(document, aiResult, industria);

  const errorMessage = getErrorMessage(query.error);
  const analyzeButtonLabel = aiResult
    ? 'Reanalizar IA'
    : 'Analizar IA';

  const aiStatus = aiReadError ? 'Estado IA no disponible' : getDocumentAiStatus(aiHistory.length);

  const PATRONES_FECHA_EMISION = [
    /\bemisio[nó]\b/i,
    /\bexpedici[oó]n\b/i,
    /fecha\s+de\s+(?:celebraci[oó]n|otorgamiento|firma|boleto|escritura|t[ií]tulo)/i,
    /t[ií]tulo antecedente/i,
    /^fecha(?: del)? boleto/i,
    /nacimiento/i,
    /nacid[oa]s?/i,
  ];

  let effectiveExpiry = document.expires_at;
  if (!effectiveExpiry && aiResult && Array.isArray((aiResult as any).fechas_plazos)) {
    const radarPlazos = (aiResult as any).fechas_plazos.filter((fp: any) => {
      const desc = fp.descripcion || '';
      return !PATRONES_FECHA_EMISION.some(re => re.test(desc));
    });
    if (radarPlazos.length > 0 && radarPlazos[0].fecha) {
      effectiveExpiry = String(radarPlazos[0].fecha).slice(0, 10);
    }
  }

  const expiryStatus = getDocumentExpiryStatus(effectiveExpiry);

  const backHref = document.case_id ? `${getCaseBasePath(industria)}/${document.case_id}?tab=documentos` : '/documentos';
  return <AppShell><DocumentViewer documentId={document.id} fileName={document.file_name} mime={document.file_mime_type ?? ''} size={formatFileSize(document.file_size)} signedUrl={signedUrl} backHref={backHref} backLabel={document.case_id ? 'Documentos de la ficha' : 'Documentos'} canDelete={canDelete} initialAnalysis={Boolean(query.error || query.analysis === 'beta')}
    notice={<>{errorMessage && <p role="alert" className={styles.viewerNotice}>{errorMessage}</p>}{query.analysis === 'beta' && <p role="status" className={styles.viewerNotice}>Análisis IA generado y guardado correctamente.</p>}</>}
    administration={canArchive ? <form action={document.archived_at ? unarchiveDocument : archiveDocument}><input type="hidden" name="document_id" value={document.id}/><button type="submit">{document.archived_at ? <ArchiveRestore aria-hidden="true"/> : <Archive aria-hidden="true"/>}{document.archived_at ? 'Desarchivar' : 'Archivar'}</button></form> : undefined}
    details={<><section className={styles.railSection}><p className={styles.eyebrow}>CLASIFICACIÓN</p><h2>Datos del documento</h2>{document.archived_at && <p>Archivado</p>}<dl className={styles.detailList}>
      <div><dt>Tipo documental</dt><dd>{getDocumentTypeLabel(document.document_type)}</dd></div><div><dt>Sensibilidad manual</dt><dd>{sensitivityLabel(document.sensitivity_level)}</dd></div><div><dt>Tamaño</dt><dd>{formatFileSize(document.file_size)}</dd></div><div><dt>MIME</dt><dd>{document.file_mime_type ?? '-'}</dd></div><div><dt>Vencimiento</dt><dd>{formatExpiryDate(effectiveExpiry)}{effectiveExpiry && ` · ${expiryStatus === 'vigente' ? 'Vigente' : expiryStatus === 'por_vencer' ? 'Por vencer' : 'Vencido'}`}</dd></div><div><dt>Estado IA</dt><dd>{aiStatus}</dd></div>
    </dl></section><section className={styles.railSection}><p className={styles.eyebrow}>VINCULACIÓN</p><h2>{industria === 'inmobiliaria' ? 'Operación' : industria === 'escribania' ? 'Legajo' : 'Expediente'}</h2>{document.case_id ? <Link href={backHref}>Ver ficha vinculada ↗</Link> : <p>Sin ficha asociada.</p>}</section><section className={styles.railSection}><h2>Almacenamiento privado</h2><p>El acceso original utiliza un enlace temporal. Si vence, volvé a abrir esta página.</p></section></>}
    analysis={aiReadError ? <section className={styles.railSection} role="alert"><h2>Estado de análisis no disponible</h2><p>No se pudo consultar el historial. No se presume que falten análisis. Volvé a abrir esta página para reintentar.</p></section> : <section className={styles.railSection}><h2>Lectura documental</h2><p>Resultado orientativo. No certifica validez ni reemplaza revisión profesional.</p>{puedeUsarIA && <AnalyzeDetailButtonClient documentId={document.id} label={analyzeButtonLabel}/>}          {aiResult ? (
            <div >
              <div >
                <div>
                  <p >
                    Último análisis IA
                  </p>

                  <p >
                    Modelo: {latestAiOutput?.model_name ?? 'analisis-documental-beta-v1'} ·{' '}
                    {formatDate(latestAiOutput?.created_at)}
                  </p>
                </div>

                <span >
                  Última versión
                </span>
              </div>

              <p >
                {aiResult.resumen}
              </p>

              <div >
                <p>
                  <strong>Modo:</strong> {aiResult.modo ?? 'análisis documental'}
                </p>

                <p>
                  <strong>Tipo detectado:</strong>{' '}
                  {aiResult.tipo_documental_detectado ?? '-'}
                </p>

                <p>
                  <strong>Sensibilidad detectada:</strong>{' '}
                  {aiResult.sensibilidad_detectada ?? '-'}
                </p>

                <p>
                  <strong>Caracteres extraídos:</strong>{' '}
                  {aiResult.caracteres_extraidos ?? '-'}
                </p>

                {aiResult.datos_relevantes?.length ? (
                  <div>
                    <strong>Datos relevantes:</strong>
                    <ul >
                      {aiResult.datos_relevantes.map((item) => (
                        <li key={toText(item)}>{toText(item)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {aiResult.alertas?.length ? (
                  <div>
                    <strong>Alertas:</strong>
                    <ul >
                      {aiResult.alertas.map((item) => (
                        <li key={toText(item)}>{toText(item)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {aiResult.proximas_acciones?.length ? (
                  <div>
                    <strong>Próximas acciones:</strong>
                    <ul >
                      {aiResult.proximas_acciones.map((item) => (
                        <li key={toText(item)}>{toText(item)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {(() => {
                  const plazosSeguros = (aiResult.fechas_plazos ?? []).filter(
                    (f) =>
                      f &&
                      typeof f.descripcion === 'string' &&
                      typeof f.fecha === 'string' &&
                      /^\d{4}-\d{2}-\d{2}$/.test(f.fecha) &&
                      esPlazoAccionable(f)
                  );
                  if (!plazosSeguros.length) return null;
                  return (
                    <PlazosDetectados
                      plazos={plazosSeguros}
                      docNombre={document.file_name}
                      caseId={document.case_id || undefined}
                    />
                  );
                })()}

                {industria === 'escribania' &&
                  (document.document_type?.toLowerCase().includes('poder') ||
                   document.document_type?.toLowerCase().includes('estatuto') ||
                   aiResult?.tipo_documental_detectado?.toLowerCase().includes('poder') ||
                   aiResult?.tipo_documental_detectado?.toLowerCase().includes('estatuto')) && (
                  <div id="poder" >
                    <div >
                      <div>
                        <h2 >⚖️ Análisis de poder / estatuto</h2>
                        <p >
                          Revisión notarial del instrumento: facultades, vigencia y representación.
                        </p>
                      </div>
                      {puedeUsarIA && <AnalizarPoderButton documentId={document.id} yaAnalizado={!!poderData} />}
                    </div>

                    {poderData?.result_json ? (
                      (() => {
                        const p = poderData.result_json as any;
                        const renderBloque = (titulo: string, items: unknown) =>
                          Array.isArray(items) && items.length > 0 ? (
                            <div >
                              <p >{titulo}</p>
                              <ul >
                                {items.map((it: unknown, i: number) => (
                                  <li key={i} >• {String(it)}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null;
                        return (
                          <div >
                            <div >
                              {p.tipo_instrumento && (
                                <span >
                                  {p.tipo_instrumento}
                                </span>
                              )}
                              {p.otorgante && (
                                <span >
                                  Otorgante: {p.otorgante}
                                </span>
                              )}
                            </div>
                            {renderBloque('👤 Apoderado / Representante', p.apoderado_representante)}
                            {renderBloque('✅ Facultades', p.facultades)}
                            {renderBloque('🚫 Límites / Exclusiones', p.limites_exclusiones)}
                            {p.vigencia && (
                              <div >
                                <p >⏳ Vigencia</p>
                                <p >{p.vigencia}</p>
                              </div>
                            )}
                            {p.representacion && (
                              <div >
                                <p >🏛️ Representación</p>
                                <p >{p.representacion}</p>
                              </div>
                            )}
                            {renderBloque('⚠️ Alertas', p.alertas)}
                            {renderBloque('📌 Apto para', p.apto_para)}
                            {poderData.created_at && (
                              <p >
                                Analizado el {new Date(poderData.created_at).toLocaleString('es-AR')} · Borrador orientativo, revisá antes de otorgar.
                              </p>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <p >
                        Si este documento es un poder o un estatuto, tocá “Analizar poder/estatuto con IA” para extraer facultades, vigencia y representación.
                      </p>
                    )}
                  </div>
                )}

                {(() => {
                  const tipoParaSugerir = document.document_type || aiResult?.tipo_documental_detectado;
                  const modeloSugerido =
                    industria === 'inmobiliaria'
                      ? sugerirModeloInmobiliarioPorTipo(tipoParaSugerir)
                      : industria === 'escribania'
                      ? sugerirModeloNotarialPorTipo(tipoParaSugerir)
                      : sugerirModeloPorTipo(tipoParaSugerir);
                  if (!modeloSugerido) return null;
                  const cardTitle =
                    industria === 'inmobiliaria'
                      ? 'Modelo inmobiliario sugerido'
                      : industria === 'escribania'
                      ? 'Instrumento sugerido'
                      : 'Escrito sugerido';
                  const ctaTitle =
                    industria === 'inmobiliaria'
                      ? 'Redactar este modelo'
                      : industria === 'escribania'
                      ? 'Redactar este instrumento'
                      : 'Redactar este escrito';
                  return (
                    <div >
                      <div >
                        <FileSignature  />
                        {cardTitle}
                      </div>
                      <p >
                        Según el tipo detectado
                        {aiResult?.tipo_documental_detectado
                          ? ` (${aiResult.tipo_documental_detectado})`
                          : ''}
                        , podés redactar: <strong>{modeloSugerido.titulo}</strong>.
                      </p>
                      <Link
                        href={`/modelos?modelo=${modeloSugerido.id}`}

                      >
                        <FileSignature  />
                        {ctaTitle}
                      </Link>
                    </div>
                  );
                })()}

                {aiResult.texto_extraido_preview ? (
                  <details >
                    <summary >
                      Ver texto extraído parcial
                    </summary>
                    <p >
                      {aiResult.texto_extraido_preview}
                    </p>
                  </details>
                ) : null}
              </div>
            </div>
          ) : (
            <div >
              <p >
                Este documento todavía no tiene análisis IA.
              </p>
              <p >
                Ejecutá el análisis IA para generar una primera lectura documental.
              </p>
            </div>
          )}

          <div >
            <h3 >
              Historial de análisis IA
            </h3>

            <p >
              Cada reanálisis queda guardado como una nueva versión.
            </p>

            <div >
              {latestAiOutput ? (
                <div >
                  <div >
                    <div>
                      <p >
                        Última versión · Análisis #{aiHistory.length}
                      </p>
                      <p >
                        {formatDate(latestAiOutput.created_at)}
                      </p>
                    </div>

                    <span >
                      {latestAiOutput.model_name ?? 'analisis-documental-beta-v1'}
                    </span>
                  </div>

                  <p >
                    {latestAiOutput.result_json?.resumen ??
                      'Análisis guardado sin resumen disponible.'}
                  </p>
                </div>
              ) : null}

              {previousAiOutputs.length > 0 ? (
                <div >
                  <p >
                    Versiones anteriores
                  </p>

                  <div >
                    {previousAiOutputs.map((item, index) => (
                      <div
                        key={item.id}

                      >
                        <div >
                          <div>
                            <p >
                              Análisis #{previousAiOutputs.length - index}
                            </p>
                            <p >
                              {formatDate(item.created_at)}
                            </p>
                          </div>

                          <span >
                            {item.model_name ?? 'analisis-documental-beta-v1'}
                          </span>
                        </div>

                        <p >
                          {item.result_json?.resumen ??
                            'Análisis guardado sin resumen disponible.'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {aiHistory.length === 0 ? (
                <div >
                  Todavía no hay análisis guardados para este documento.
                </div>
              ) : null}
            </div>

          </div>
<details><summary>Orientaciones de control manual</summary><h3>Checklist operativo sugerido</h3><ul>{checklist.map(item=><li key={item}>{item}</li>)}</ul><h3>Posibles faltantes o respaldos</h3><ul>{missingDocuments.map(item=><li key={item}>{item}</li>)}</ul><h3>Recomendaciones de acceso</h3><ul>{securityRecommendations.map(item=><li key={item}>{item}</li>)}</ul><p>Orientaciones por tipo y sensibilidad; no son una validación del archivo.</p></details></section>}
  /></AppShell>;
}
