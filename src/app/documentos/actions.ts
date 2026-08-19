'use server';

import { randomUUID } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import crypto from 'crypto';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { indexarDocumento } from '@/lib/ai/indexarDocumento';
import { analizarPoderConIA } from '@/lib/ai/poderes';
import { normalizeIndustryType, type IndustryType } from '@/lib/industries/documentTypes';
import { getAnalysisSystemPrompt } from '@/lib/industries/aiConfig';
import { validateFileContent } from '@/lib/documents/fileValidation';
import {
  canUploadDocument,
  canUseAi,
  canArchiveDocument,
  canDeleteDocument,
  isUserRole,
} from '@/lib/permissions/roles';

function denyDocumentAction(action: 'subir' | 'analizar') {
  redirect(`/acceso-denegado?motivo=rol&accion=${action}`);
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function uploadDocument(formData: FormData) {
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  if (!isUserRole(profile.role) || !canUploadDocument(profile.role)) {
    denyDocumentAction('subir');
  }

  const caseId = String(formData.get('case_id') || '');
  const documentType = String(formData.get('document_type') || '');
  const sensitivityLevel = String(formData.get('sensitivity_level') || 'medium');
  const expiresAtForm = String(formData.get('expires_at') || '');
  const expiresAt = expiresAtForm ? expiresAtForm : null;
  const file = formData.get('file');

  if (!(file instanceof File)) {
    redirect('/documentos/subir?error=missing_file');
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    redirect('/documentos/subir?error=invalid_type');
  }

  if (file.size > MAX_FILE_SIZE) {
    redirect('/documentos/subir?error=file_too_large');
  }

  const supabase = await createClient();

  if (caseId) {
    const { data: caseRecord } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!caseRecord) {
      redirect('/documentos/subir?error=invalid_case');
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateFileContent(file.type, buffer)) {
    redirect('/documentos/subir?error=invalid_file_content');
  }
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  let existingQuery = supabase
    .from('documents')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .eq('file_hash', fileHash);
  if (caseId) existingQuery = existingQuery.eq('case_id', caseId);
  else existingQuery = existingQuery.is('case_id', null);

  const { data: existingDoc } = await existingQuery.single();

  if (existingDoc) {
    redirect('/documentos/subir?error=duplicate');
  }

  const documentId = randomUUID();
  const safeFileName = sanitizeFileName(file.name);
  const storagePath = `${profile.organization_id}/${caseId || 'general'}/${documentId}/${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    redirect('/documentos/subir?error=upload_failed');
  }

  const { error: insertError } = await supabase.from('documents').insert({
    id: documentId,
    organization_id: profile.organization_id,
    case_id: caseId || null,
    file_name: file.name,
    file_path: storagePath,
    file_mime_type: file.type,
    file_size: file.size,
    file_hash: fileHash,
    document_type: documentType || null,
    sensitivity_level: sensitivityLevel,
    uploaded_by: user.id,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error('Metadata error:', insertError);
    await supabase.storage.from('documents').remove([storagePath]);

    if (insertError.code === '23505') {
      let query = supabase
        .from('documents')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .eq('file_hash', fileHash);
      if (caseId) query = query.eq('case_id', caseId);
      else query = query.is('case_id', null);

      const { data: winner } = await query.single();

      if (winner) {
        redirect(`/documentos/subir?error=duplicate&existingDocumentId=${winner.id}`);
      }
    }

    redirect('/documentos/subir?error=metadata_failed');
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'document_uploaded',
    resourceType: 'document',
    resourceId: documentId,
    metadata: {
      file_name: file.name,
      case_id: caseId || null,
      document_type: documentType || null,
      sensitivity_level: sensitivityLevel,
      expires_at: expiresAt,
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/documentos');

  if (caseId) {
    revalidatePath(`/expedientes/${caseId}`);
  }

  redirect(`/documentos/${documentId}`);
}

export type UploadResult =
  | { status: 'success'; documentId: string }
  | { status: 'duplicate'; existingDocumentId: string; documentId?: string }
  | { status: 'error'; error: string };



export async function uploadSingleDocumentAsync(formData: FormData): Promise<UploadResult> {
  try {
    const { user, profile } = await getUserProfile();

    if (!user || !profile) return { status: 'error', error: 'Sesión no válida.' };

    if (!isUserRole(profile.role) || !canUploadDocument(profile.role)) {
      return { status: 'error', error: 'Sin permiso para subir documentos.' };
    }

    const caseId = String(formData.get('case_id') || '');
    const documentType = String(formData.get('document_type') || '');
    const sensitivityLevel = String(formData.get('sensitivity_level') || 'medium');
    const expiresAtForm = String(formData.get('expires_at') || '');
    const expiresAt = expiresAtForm ? expiresAtForm : null;
    const file = formData.get('file');

    if (!(file instanceof File)) return { status: 'error', error: 'missing_file' };
    if (!ALLOWED_MIME_TYPES.includes(file.type)) return { status: 'error', error: 'invalid_type' };
    if (file.size > MAX_FILE_SIZE) return { status: 'error', error: 'file_too_large' };

    const buffer = Buffer.from(await file.arrayBuffer());

    // Deterministic test failure injection via cookie
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    if (cookieStore.get('x-test-fail-upload')?.value === '1') {
      cookieStore.delete('x-test-fail-upload');
      return { status: 'error', error: 'mocked_network_failure' };
    }

    // Validate Magic Bytes and Structure
    if (!validateFileContent(file.type, buffer)) {
      return { status: 'error', error: 'invalid_file_content' };
    }

    const supabase = await createClient();

    if (caseId) {
      const { data: caseRecord } = await supabase
        .from('cases')
        .select('id')
        .eq('id', caseId)
        .eq('organization_id', profile.organization_id)
        .single();

      if (!caseRecord) return { status: 'error', error: 'invalid_case' };
    }

    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    let existingQuery = supabase
      .from('documents')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('file_hash', fileHash);
    if (caseId) existingQuery = existingQuery.eq('case_id', caseId);
    else existingQuery = existingQuery.is('case_id', null);

    const { data: existingDoc } = await existingQuery.single();

    if (existingDoc) {
      return { status: 'duplicate', existingDocumentId: existingDoc.id };
    }

    const documentId = randomUUID();
    const safeFileName = sanitizeFileName(file.name);
    const storagePath = `${profile.organization_id}/${caseId || 'general'}/${documentId}/${safeFileName}`;

    // Reserva atómica de metadata antes de Storage
    const { error: insertError } = await supabase.from('documents').insert({
      id: documentId,
      organization_id: profile.organization_id,
      case_id: caseId || null,
      file_name: file.name,
      file_path: storagePath,
      file_mime_type: file.type,
      file_size: file.size,
      file_hash: fileHash,
      document_type: documentType || null,
      sensitivity_level: sensitivityLevel,
      uploaded_by: user.id,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('Metadata error:', insertError);

      if (insertError.code === '23505') {
        let query = supabase
          .from('documents')
          .select('id')
          .eq('organization_id', profile.organization_id)
          .eq('file_hash', fileHash);
        if (caseId) query = query.eq('case_id', caseId);
        else query = query.is('case_id', null);

        const { data: winner } = await query.single();

        if (winner) {
          return { status: 'duplicate', existingDocumentId: winner.id };
        }
      }

      return { status: 'error', error: 'metadata_failed' };
    }

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      // Mecanismo server-side restringido para limpiar el objeto huérfano en BD
      const { createClient: createAdminClient } = await import('@supabase/supabase-js');
      const adminClient = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await adminClient.from('documents').delete().eq('id', documentId);
      return { status: 'error', error: 'upload_failed' };
    }

    await createAuditLog({
      organizationId: profile.organization_id,
      userId: user.id,
      action: 'document_uploaded',
      resourceType: 'document',
      resourceId: documentId,
      metadata: {
        file_name: file.name,
        case_id: caseId || null,
        document_type: documentType || null,
        sensitivity_level: sensitivityLevel,
        expires_at: expiresAt,
        multi_upload: true,
      },
    });

    return { status: 'success', documentId };
  } catch (err: any) {
    console.error('Upload error:', err);
    return { status: 'error', error: err.message || 'unknown_error' };
  }
}

function cleanExtractedText(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim()
    .slice(0, 18000);
}

function hasAny(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function detectDocumentType(text: string, declaredType?: string | null) {
    if (
    hasAny(text, [
      'demanda',
      'demanda laboral',
      'demanda judicial',
      'actor',
      'demandado',
      'juzgado',
      'expediente judicial',
      'objeto de la demanda',
      'petitorio',
    ])
  ) {
    return 'demanda';
  }

  if (
    hasAny(text, [
      'escrito',
      'escrito judicial',
      'presenta escrito',
      'se presenta',
      'solicita',
      'manifiesta',
      'acompaña documentación',
      'tenga presente',
      'provea de conformidad',
    ])
  ) {
    return 'escrito';
  }

  if (
    hasAny(text, [
      'boleto de compraventa',
      'boleto compraventa',
      'compraventa',
      'comprador',
      'vendedor',
      'inmueble',
      'precio de venta',
      'seña',
      'posesión',
      'escritura traslativa',
    ])
  ) {
    return 'boleto_compraventa';
  }

  if (
    hasAny(text, [
      'certificado',
      'constancia',
      'certifica',
      'se certifica',
      'certificación',
      'emitido por',
      'validez',
    ])
  ) {
    return 'certificado';
  }

  if (
    hasAny(text, [
      'poder',
      'poder especial',
      'poder general',
      'apoderado',
      'poderdante',
      'mandato',
      'facultades',
      'representación',
      'representar',
    ])
  ) {
    return 'poder';
  }

  if (
    hasAny(text, [
      'garantía',
      'garante',
      'fiador',
      'aval',
      'garantiza',
      'obligación garantizada',
      'responsable solidario',
    ])
  ) {
    return 'garantia';
  }

  if (
    hasAny(text, [
      'reserva',
      'reserva de inmueble',
      'reserva inmobiliaria',
      'monto de reserva',
      'seña de reserva',
      'operación reservada',
      'interesado',
    ])
  ) {
    return 'reserva';
  }

  if (
    hasAny(text, [
      'contrato',
      'alquiler',
      'locador',
      'locatario',
      'inmueble',
      'compraventa',
      'boleto',
      'escritura',
      'cláusula',
      'partes',
      'acuerdo',
    ])
  ) {
    return 'contrato';
  }

  if (
    hasAny(text, [
      'demanda',
      'actor',
      'demandado',
      'expediente judicial',
      'juzgado',
      'sentencia',
      'escrito judicial',
    ])
  ) {
    return 'otro';
  }

  if (
    hasAny(text, [
      'plan de estudios',
      'asignatura',
      'materia',
      'carrera',
      'facultad',
      'universidad',
      'licenciatura',
    ])
  ) {
    return 'plan_estudios';
  }

  if (hasAny(text, ['factura', 'importe', 'iva', 'total'])) {
    return 'factura';
  }

  if (hasAny(text, ['recibo', 'recibí', 'pago'])) {
    return 'recibo';
  }

  if (hasAny(text, ['escritura', 'inmueble', 'compraventa', 'dominio'])) {
    return 'escritura';
  }

  if (hasAny(text, ['cuit', 'constancia', 'afip', 'monotributo'])) {
    return 'constancia_fiscal';
  }

  return declaredType || 'otro';
}

function detectSensitivity(text: string) {
  if (
    hasAny(text, [
      'dni',
      'cuit',
      'cuil',
      'domicilio',
      'firma',
      'cuenta bancaria',
      'clave',
      'contraseña',
      'historia clínica',
    ])
  ) {
    return 'critical';
  }

  if (
    hasAny(text, [
      'nombre',
      'apellido',
      'legajo',
      'matrícula',
      'contrato',
      'inmueble',
      'calificación',
      'académico',
      'universidad',
      'facultad',
    ])
  ) {
    return 'high';
  }

  if (text.length > 1000) {
    return 'medium';
  }

  return 'low';
}

function buildRelevantData(text: string, documentType?: string) {
  const items: string[] = [];

if (
  documentType === 'plan_estudios' &&
  hasAny(text, ['plan de estudios', 'asignatura', 'materia', 'carrera'])
) {
  items.push('El documento parece contener información académica o curricular.');
}

  if (hasAny(text, ['dni', 'cuit', 'cuil'])) {
    items.push('Se detectan posibles identificadores personales o fiscales.');
  }

if (
  documentType === 'contrato' ||
  hasAny(text, ['contrato', 'alquiler', 'locador', 'locatario', 'inmueble', 'compraventa', 'boleto', 'escritura', 'cláusula', 'acuerdo'])
) {
  items.push('Se detectan elementos compatibles con documentación contractual.');
  items.push('El documento contiene referencias a partes, condiciones, inmueble o cláusulas.');
}

  if (hasAny(text, ['firma', 'firmado'])) {
    items.push('El documento podría contener referencias a firma o validación formal.');
  }

  if (items.length === 0) {
    items.push('Se extrajo texto del documento y quedó disponible para revisión.');
  }

  return items;
}

function buildAlerts(text: string, sensitivity: string) {
  const alerts: string[] = [];

  if (sensitivity === 'critical') {
    alerts.push(
      'Documento con posible información altamente sensible. Revisar permisos de acceso.'
    );
  }

  if (sensitivity === 'high') {
    alerts.push(
      'Documento con posible información sensible. Conviene mantenerlo restringido.'
    );
  }

  if (text.length < 300) {
    alerts.push(
      'El texto extraído es breve. Puede ser un PDF escaneado o con poca información seleccionable.'
    );
  }

  if (alerts.length === 0) {
    alerts.push('No se detectaron alertas críticas en el análisis docuemtanl');
  }

  return alerts;
}

function buildNextActions(documentType: string) {
  if (documentType === 'plan_estudios') {
    return [
      'Verificar carrera, materias y datos institucionales.',
      'Clasificar como documento académico.',
      'Asociar al expediente correspondiente si aplica.',
    ];
  }

  if (documentType === 'contrato') {
    return [
      'Revisar partes involucradas y cláusulas principales.',
      'Verificar firmas y fechas.',
      'Marcar como documento sensible.',
    ];
  }

  if (documentType === 'factura') {
    return [
      'Verificar CUIT, importe y fecha.',
      'Asociar a carpeta contable o administrativa.',
    ];
  }

  if (documentType === 'escritura') {
    return [
      'Verificar datos del inmueble.',
      'Revisar partes intervinientes.',
      'Controlar documentación respaldatoria.',
    ];
  }

  return [
    'Revisar manualmente el contenido extraído.',
    'Confirmar tipo documental.',
    'No se detectan alertas específicas de nivel crítico en este análisis automatizado.',
  ];
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

async function analizarConIA(texto: string, industry: IndustryType): Promise<{
  model: string;
  resumen: string;
  tipo_documental_detectado: string;
  sensibilidad_detectada: string;
  partes: string[];
  datos_clave: string[];
  clausulas_riesgos: string[];
  alertas: string[];
  proximas_acciones: string[];
  fechas_plazos: { descripcion: string; fecha: string }[];
  transcripcion?: string;
} | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const prompt = [
    getAnalysisSystemPrompt(industry),
    '',
    'DOCUMENTO:',
    texto,
  ].join('\n');

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!resp.ok) {
      console.error('Gemini análisis error:', resp.status, await resp.text());
      return null;
    }

    const data = await resp.json();
    const raw: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? '';

    if (!raw.trim()) return null;

    const parsed = JSON.parse(raw);
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map(toText).filter((s) => s.trim().length > 0) : [];

    const rawFechas = Array.isArray(parsed.fechas_plazos) ? parsed.fechas_plazos : [];
    const fechas_plazos = rawFechas.filter((f: any) =>
      f && typeof f.descripcion === 'string' && typeof f.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha)
    ).map((f: any) => ({ descripcion: f.descripcion, fecha: f.fecha }));

    return {
      model: `analisis-ia-${modelo}`,
      resumen: String(parsed.resumen ?? ''),
      transcripcion: String(parsed.transcripcion ?? ''),
      tipo_documental_detectado: String(parsed.tipo_documental_detectado ?? ''),
      sensibilidad_detectada: String(parsed.sensibilidad_detectada ?? '').toLowerCase(),
      partes: arr(parsed.partes),
      datos_clave: arr(parsed.datos_clave),
      clausulas_riesgos: arr(parsed.clausulas_riesgos),
      alertas: arr(parsed.alertas),
      proximas_acciones: arr(parsed.proximas_acciones),
      fechas_plazos,
    };
  } catch (e) {
    console.error('Gemini análisis fetch error:', e);
    return null;
  }
}

async function analizarConIAMultimodal(
  base64Data: string,
  mimeType: string,
  industry: IndustryType
): Promise<{
  model: string;
  resumen: string;
  tipo_documental_detectado: string;
  sensibilidad_detectada: string;
  partes: string[];
  datos_clave: string[];
  clausulas_riesgos: string[];
  alertas: string[];
  proximas_acciones: string[];
  fechas_plazos: { descripcion: string; fecha: string }[];
  transcripcion?: string;
} | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const prompt = getAnalysisSystemPrompt(industry);

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64Data } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!resp.ok) {
      console.error('Gemini multimodal error:', resp.status, await resp.text());
      return null;
    }

    const data = await resp.json();
    const raw: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? '';

    if (!raw.trim()) return null;

    const parsed = JSON.parse(raw);
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map(toText).filter((s) => s.trim().length > 0) : [];

    const rawFechas = Array.isArray(parsed.fechas_plazos) ? parsed.fechas_plazos : [];
    const fechas_plazos = rawFechas.filter((f: any) =>
      f && typeof f.descripcion === 'string' && typeof f.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha)
    ).map((f: any) => ({ descripcion: f.descripcion, fecha: f.fecha }));

    return {
      model: `analisis-ia-mm-${modelo}`,
      resumen: String(parsed.resumen ?? ''),
      transcripcion: String(parsed.transcripcion ?? ''),
      tipo_documental_detectado: String(parsed.tipo_documental_detectado ?? ''),
      sensibilidad_detectada: String(parsed.sensibilidad_detectada ?? '').toLowerCase(),
      partes: arr(parsed.partes),
      datos_clave: arr(parsed.datos_clave),
      clausulas_riesgos: arr(parsed.clausulas_riesgos),
      alertas: arr(parsed.alertas),
      proximas_acciones: arr(parsed.proximas_acciones),
      fechas_plazos,
    };
  } catch (e) {
    console.error('Gemini multimodal fetch error:', e);
    return null;
  }
}

export async function analyzeDocument(formData: FormData) {
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  if (!isUserRole(profile.role) || !canUseAi(profile.role)) {
    denyDocumentAction('analizar');
  }

  const documentId = String(formData.get('document_id') || '');

  if (!documentId) {
    redirect('/documentos?error=missing_document');
  }

  const supabase = await createClient();

  const { data: orgData } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .single();

  const industry = normalizeIndustryType(orgData?.industry_type);

  const { data: documentRecord, error: documentError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('organization_id', profile.organization_id)
    .single();

  if (documentError || !documentRecord) {
    redirect('/documentos?error=document_not_found');
  }

  const AI_INLINE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  const MAX_INLINE_SIZE = 15 * 1024 * 1024; // límite seguro para enviar inline a Gemini

  if (!AI_INLINE_MIME_TYPES.includes(documentRecord.file_mime_type)) {
    redirect(`/documentos/${documentId}?error=formato_no_soportado`);
  }

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from('documents')
    .download(documentRecord.file_path);

  if (downloadError || !fileBlob) {
    console.error('Download error:', downloadError);
    redirect(`/documentos/${documentId}?error=download_failed`);
  }

  const arrayBuffer = await fileBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = documentRecord.file_mime_type;
  const isPdf = mimeType === 'application/pdf';

  let extractedText = '';

  // 1) Si es PDF, intentamos extraer texto (rápido y barato).
  if (isPdf) {
    try {
      const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js');
      const pdfParse = pdfParseModule.default;
      const parsedPdf = await pdfParse(buffer);
      extractedText = cleanExtractedText(parsedPdf.text || '');
    } catch (e) {
      console.error('pdf-parse error (se continúa con multimodal):', e);
      extractedText = '';
    }
  }

  // La detección por reglas necesita texto; si no hay (imagen o PDF escaneado), queda fallback genérico.
  const detectedType = detectDocumentType(
    extractedText,
    documentRecord.document_type
  );
  const detectedSensitivity = detectSensitivity(extractedText);

  // 2) Estrategia + interruptor:
  //    - PDF con texto suficiente -> IA por texto (barato).
  //    - Imagen o PDF escaneado (poco/nada de texto) -> IA multimodal (OCR + visión).
  const tieneTextoUtil = extractedText.length >= 200;
  const puedeMultimodal = buffer.length <= MAX_INLINE_SIZE;

  let ia: Awaited<ReturnType<typeof analizarConIA>> = null;

  if (isPdf && tieneTextoUtil) {
    ia = await analizarConIA(extractedText, industry);
  } else if (puedeMultimodal) {
    const base64 = buffer.toString('base64');
    ia = await analizarConIAMultimodal(base64, mimeType, industry);
  }

  // Si no hay texto NI resultado de IA, no podemos analizar (ej: imagen sin API key o archivo muy grande).
  if (!ia && !extractedText) {
    redirect(`/documentos/${documentId}?error=analisis_no_disponible`);
  }

  let modelName = 'analisis-documental-beta-v1';
  let sensitivityToSave = detectedSensitivity;
  let typeToSave = detectedType;
  let analysis;

  if (ia) {
    const sensValida = ['low', 'medium', 'high', 'critical'].includes(
      ia.sensibilidad_detectada
    )
      ? ia.sensibilidad_detectada
      : detectedSensitivity;

    modelName = ia.model;
    sensitivityToSave = sensValida;
    typeToSave = ia.tipo_documental_detectado?.trim() || detectedType;

    const datosRelevantes = [
      ...ia.partes.map((p) => `Parte: ${p}`),
      ...ia.datos_clave,
      ...ia.clausulas_riesgos.map((r) => `Cláusula/riesgo: ${r}`),
    ];

    analysis = {
      modo: 'ia',
      resumen: ia.resumen || 'Análisis generado con IA.',
      tipo_documental_detectado: ia.tipo_documental_detectado || detectedType,
      sensibilidad_detectada: sensValida,
      datos_relevantes: datosRelevantes.length
        ? datosRelevantes
        : ['La IA no identificó datos estructurados.'],
      alertas: ia.alertas.length
        ? ia.alertas
        : ['Sin alertas detectadas por la IA.'],
      proximas_acciones: ia.proximas_acciones,
      fechas_plazos: ia.fechas_plazos ?? [],
      texto_extraido_preview: extractedText.slice(0, 1200),
      caracteres_extraidos: extractedText.length,
    };
  } else {
    analysis = {
      modo: 'beta_controlada',
      resumen:
        'Análisis documental generado en modo controlado. El sistema extrajo texto del PDF y aplicó reglas básicas para clasificarlo sin enviar información a proveedores externos.',
      tipo_documental_detectado: detectedType,
      sensibilidad_detectada: detectedSensitivity,
      datos_relevantes: buildRelevantData(extractedText, detectedType),
      alertas: buildAlerts(extractedText, detectedSensitivity),
      proximas_acciones: buildNextActions(detectedType),
      fechas_plazos: [],
      texto_extraido_preview: extractedText.slice(0, 1200),
      caracteres_extraidos: extractedText.length,
    };
  }

  const { error: aiInsertError } = await supabase.from('ai_outputs').insert({
    organization_id: profile.organization_id,
    document_id: documentRecord.id,
    case_id: documentRecord.case_id,
    output_type: 'document_analysis',
    content: analysis.resumen,
    model_name: modelName,
    result_json: analysis,
    created_by: user.id,
  });

if (aiInsertError) {
  console.error('AI analysis insert error:', aiInsertError);
  redirect(`/documentos/${documentId}?error=ai_save_failed`);
}

const { error: documentUpdateError } = await supabase
  .from('documents')
  .update({
    document_type: typeToSave,
    sensitivity_level: sensitivityToSave,
  })
  .eq('id', documentRecord.id)
  .eq('organization_id', profile.organization_id);

if (documentUpdateError) {
  console.error('Document metadata update error:', documentUpdateError);
}

await createAuditLog({
  organizationId: profile.organization_id,
  userId: user.id,
  action: 'document_analyzed_beta',
  resourceType: 'document',
  resourceId: documentRecord.id,
  metadata: {
    file_name: documentRecord.file_name,
    model: 'analisis-documental-beta-v1',
    output_type: 'document_analysis',
  },
});

  // --- Indexación semántica (no bloqueante, con diagnóstico) ---
  let idxInfo = 'skip';
  const textoParaIndexar =
    extractedText && extractedText.length >= 200
      ? extractedText
      : ia && ia.transcripcion && ia.transcripcion.trim().length >= 100
      ? ia.transcripcion
      : ia
        ? [
            ia.resumen ?? '',
            (ia.partes ?? []).join('. '),
            (ia.datos_clave ?? []).join('. '),
            (ia.clausulas_riesgos ?? []).join('. '),
            (ia.proximas_acciones ?? []).join('. '),
          ]
            .filter(Boolean)
            .join('\n')
        : '';

  if (textoParaIndexar.trim().length > 0) {
    try {
      const r = await indexarDocumento(supabase, {
        documentId: documentRecord.id,
        organizationId: profile.organization_id,
        texto: textoParaIndexar,
      });
      idxInfo = r.ok ? 'ok-' + r.chunks : 'fail-' + (r.motivo || '?');
    } catch (e) {
      idxInfo = 'excepcion';
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/documentos');
  revalidatePath(`/documentos/${documentId}`);

  redirect(`/documentos/${documentId}?analysis=beta&idx=${encodeURIComponent(idxInfo)}`);
}

export async function analizarPoderEstatuto(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canUseAi(profile.role)) {
    denyDocumentAction('analizar');
  }

  const documentId = String(formData.get('document_id') || '');
  if (!documentId) redirect('/documentos?error=missing_document');

  const supabase = await createClient();

  const { data: documentRecord, error: documentError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('organization_id', profile.organization_id)
    .single();

  if (documentError || !documentRecord) {
    redirect('/documentos?error=document_not_found');
  }

  const AI_INLINE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  const MAX_INLINE_SIZE = 15 * 1024 * 1024;

  if (!AI_INLINE_MIME_TYPES.includes(documentRecord.file_mime_type)) {
    redirect(`/documentos/${documentId}?error=formato_no_soportado`);
  }

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from('documents')
    .download(documentRecord.file_path);

  if (downloadError || !fileBlob) {
    console.error('Download error (poder):', downloadError);
    redirect(`/documentos/${documentId}?error=download_failed`);
  }

  const arrayBuffer = await fileBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > MAX_INLINE_SIZE) {
    redirect(`/documentos/${documentId}?error=analisis_no_disponible`);
  }

  const base64 = buffer.toString('base64');
  const result = await analizarPoderConIA(base64, documentRecord.file_mime_type);

  if (!result.ok) {
    redirect(`/documentos/${documentId}?error=analisis_no_disponible`);
  }

  await supabase.from('ai_outputs').insert({
    organization_id: profile.organization_id,
    document_id: documentRecord.id,
    case_id: documentRecord.case_id,
    output_type: 'document_poder',
    content: result.analisis.tipo_instrumento || 'Análisis de poder/estatuto',
    model_name: result.model,
    result_json: result.analisis,
    created_by: user.id,
  });

  redirect(`/documentos/${documentId}`);
}

export async function archiveDocument(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canArchiveDocument(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=subir');
  }

  const documentId = formData.get('document_id') as string;
  if (!documentId) redirect('/documentos');

  const supabase = await createClient();
  await supabase
    .from('documents')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', documentId)
    .eq('organization_id', profile.organization_id);

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'document_archived' as any,
    resourceType: 'document',
    resourceId: documentId,
  });

  revalidatePath('/documentos');
  revalidatePath(`/documentos/${documentId}`);
  revalidatePath('/dashboard');
}

export async function unarchiveDocument(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canArchiveDocument(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=subir');
  }

  const documentId = formData.get('document_id') as string;
  if (!documentId) redirect('/documentos');

  const supabase = await createClient();
  await supabase
    .from('documents')
    .update({ archived_at: null })
    .eq('id', documentId)
    .eq('organization_id', profile.organization_id);

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'document_unarchived' as any,
    resourceType: 'document',
    resourceId: documentId,
  });

  revalidatePath('/documentos');
  revalidatePath(`/documentos/${documentId}`);
  revalidatePath('/dashboard');
}

export async function deleteDocument(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canDeleteDocument(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=subir');
  }

  const documentId = formData.get('document_id') as string;
  if (!documentId) redirect('/documentos');

  const supabase = await createClient();
  const { data: docData } = await supabase
    .from('documents')
    .select('id, file_path, file_name')
    .eq('id', documentId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (!docData) redirect('/documentos');

  // 1. Borrar el archivo del Storage
  await supabase.storage.from('documents').remove([docData.file_path]);

  // 2. DELETE FROM document_chunks
  await supabase
    .from('document_chunks')
    .delete()
    .eq('document_id', documentId)
    .eq('organization_id', profile.organization_id);

  // 3. DELETE FROM ai_outputs
  await supabase
    .from('ai_outputs')
    .delete()
    .eq('document_id', documentId)
    .eq('organization_id', profile.organization_id);

  // 4. Desvincular de checklists
  await supabase
    .from('checklist_items')
    .update({ document_id: null, status: 'pending' })
    .eq('document_id', documentId);

  // 5. DELETE FROM documents
  await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('organization_id', profile.organization_id);

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'document_deleted' as any,
    resourceType: 'document',
    resourceId: documentId,
    metadata: { file_name: docData.file_name },
  });

  revalidatePath('/documentos');
  revalidatePath('/dashboard');
  redirect('/documentos');
}

// Igual que deleteDocument, pero para usar DENTRO de un legajo:
// en vez de mandarte a /documentos, refresca el legajo donde estás.
export async function deleteDocumentFromCase(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canDeleteDocument(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=subir');
  }

  const documentId = formData.get('document_id') as string;
  const caseId = formData.get('case_id') as string;
  if (!documentId || !caseId) redirect(`/expedientes/${caseId || ''}`);

  const supabase = await createClient();
  const { data: docData } = await supabase
    .from('documents')
    .select('id, file_path, file_name')
    .eq('id', documentId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (!docData) redirect(`/expedientes/${caseId}`);

  // 1. Borrar el archivo del Storage
  await supabase.storage.from('documents').remove([docData.file_path]);

  // 2. Borrar los fragmentos de búsqueda
  await supabase
    .from('document_chunks')
    .delete()
    .eq('document_id', documentId)
    .eq('organization_id', profile.organization_id);

  // 3. Borrar los análisis de IA de ese documento
  await supabase
    .from('ai_outputs')
    .delete()
    .eq('document_id', documentId)
    .eq('organization_id', profile.organization_id);

  // 4. Liberar el ítem del checklist que lo tuviera vinculado
  await supabase
    .from('checklist_items')
    .update({ document_id: null, status: 'pending' })
    .eq('document_id', documentId);

  // 5. Borrar el documento (con diagnóstico de por qué falla)
  const { data: filasBorradas, error: errorBorrado } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('organization_id', profile.organization_id)
    .select('id');

  if (errorBorrado) {
    redirect(`/expedientes/${caseId}?docdel=error:${encodeURIComponent(errorBorrado.message)}`);
  }
  if (!filasBorradas || filasBorradas.length === 0) {
    redirect(`/expedientes/${caseId}?docdel=cero-filas`);
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'document_deleted' as any,
    resourceType: 'document',
    resourceId: documentId,
    metadata: { file_name: docData.file_name },
  });

  revalidatePath(`/expedientes/${caseId}`);
  revalidatePath('/documentos');
  revalidatePath('/dashboard');
  redirect(`/expedientes/${caseId}?docdel=ok`);
}
