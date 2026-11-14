import { formatAuditActionLabel, formatResourceTypeLabel } from '@/lib/audit/actionLabels';
import { normalizeIndustryType, industryLabels } from '@/lib/industries/documentTypes';
import type { IndustryTerms } from '@/lib/industries/uiLabels';
import { metadataText, isAiAudit, type AuditLogRecordForReport } from './reportHelpers';
import type { AuditReportFilter, AuditReportProfileRecord } from './auditReportContract';

export interface AuditCaseRecord {
  id: string;
  title: string;
  client_name?: string | null;
  case_type?: string | null;
  status?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditDocumentRecord {
  id: string;
  file_name?: string;
  document_type?: string | null;
  sensitivity_level?: string | null;
  file_size?: number | null;
  file_mime_type?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
}

export function formatAuditDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Buenos_Aires',
  }).format(date);
}

function invitationStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    accepted: 'Aceptada',
    cancelled: 'Cancelada',
    expired: 'Vencida',
  };

  return labels[value ?? ''] ?? value ?? 'Sin estado';
}

function invitationRoleLabel(value?: string | null) {
  const labels: Record<string, string> = {
    admin: 'Administrador',
    employee: 'Operador',
    auditor: 'Auditor',
    client: 'Cliente',
  };

  return labels[value ?? ''] ?? value ?? 'Sin rol';
}

function sensitivityLabel(value?: string | null) {
  const labels: Record<string, string> = {
    low: 'Bajo',
    medium: 'Medio',
    high: 'Alto',
    critical: 'Crítico',
    bajo: 'Bajo',
    medio: 'Medio',
    alto: 'Alto',
    critico: 'Crítico',
    'crítico': 'Crítico',
  };

  return labels[String(value ?? '').toLowerCase()] ?? value ?? 'No definida';
}

export function actionDotTone(value: string) {
  if (value.includes('cancel')) return 'bg-rose-500';

  if (value.includes('updated') || value.includes('status')) return 'bg-slate-400';

  if (
    value.includes('created') ||
    value.includes('accepted') ||
    value.includes('uploaded') ||
    value.includes('authorized') ||
    value.includes('autoriz')
  ) {
    return 'bg-emerald-400';
  }

  if (value.includes('viewed') || value.includes('access') || value.includes('analyzed')) {
    return 'bg-sky-400';
  }

  return 'bg-slate-400';
}

export function getActorLabel(
  log: AuditLogRecordForReport,
  profilesById: Map<string, AuditReportProfileRecord>
) {
  if (!log.user_id) return 'Sistema';

  const profile = profilesById.get(log.user_id);

  if (profile?.full_name) return profile.full_name;
  if (profile?.email) return profile.email;

  return `Usuario ${log.user_id.slice(0, 8)}...`;
}

export function getActorRole(
  log: AuditLogRecordForReport,
  profilesById: Map<string, AuditReportProfileRecord>
) {
  if (!log.user_id) return 'Automático';

  const profile = profilesById.get(log.user_id);

  if (profile?.role) return profile.role;

  return 'Usuario';
}

export function getResourceLabel(
  log: AuditLogRecordForReport,
  documentsById: Map<string, AuditDocumentRecord>,
  casesById: Map<string, AuditCaseRecord>,
  terms?: IndustryTerms
) {
  const metadataFileName = metadataText(log.metadata, 'file_name');
  const metadataCaseTitle = metadataText(log.metadata, 'case_title');
  const metadataTitle = metadataText(log.metadata, 'title');
  const metadataEmail =
    metadataText(log.metadata, 'email') ??
    metadataText(log.metadata, 'invitation_email') ??
    metadataText(log.metadata, 'invited_email');

  if (
    log.resource_type === 'user_invitation' ||
    log.resource_type === 'invitation' ||
    log.action.includes('invitation') ||
    log.action.includes('invitacion')
  ) {
    return metadataEmail ?? 'Invitación de usuario';
  }

  if (log.resource_type === 'document' || log.action.startsWith('document_')) {
    const docName =
      metadataFileName ??
      (log.resource_id && documentsById.get(log.resource_id)?.file_name) ??
      (log.resource_id ? `Documento ${log.resource_id.slice(0, 8)}...` : 'Documento');

    if (metadataCaseTitle) {
      return `${metadataCaseTitle} — ${docName}`;
    }
    return docName;
  }

  if (log.resource_type === 'case' || log.action.startsWith('case_')) {
    return (
      metadataCaseTitle ??
      metadataTitle ??
      (log.resource_id && casesById.get(log.resource_id)?.title) ??
      `${terms ? terms.expedienteSingular : 'Expediente'} ${log.resource_id ? log.resource_id.slice(0, 8) + '...' : ''}`
    );
  }

  if (log.resource_type === 'organization') return 'Organización';

  return formatResourceTypeLabel(log.resource_type, terms);
}

export function getAuditDetail(log: AuditLogRecordForReport) {
  const details: string[] = [];

  const model = metadataText(log.metadata, 'model');
  const outputType = metadataText(log.metadata, 'output_type');
  const statusFrom = metadataText(log.metadata, 'from');
  const statusTo = metadataText(log.metadata, 'to');
  const documentType = metadataText(log.metadata, 'document_type');
  const sensitivity = metadataText(log.metadata, 'sensitivity');
  const fileName = metadataText(log.metadata, 'file_name');
  const invitedEmail =
    metadataText(log.metadata, 'email') ??
    metadataText(log.metadata, 'invitation_email') ??
    metadataText(log.metadata, 'invited_email');
  const invitedRole = metadataText(log.metadata, 'role');
  const invitationStatus = metadataText(log.metadata, 'status');

  if (model) details.push(`Modelo: ${model}`);
  if (outputType) details.push(`Salida: ${outputType}`);
  if (statusFrom || statusTo) {
    if (log.action === 'organization_industry_updated') {
      const fromLabel = statusFrom
        ? industryLabels[normalizeIndustryType(statusFrom)] || statusFrom
        : '-';
      const toLabel = statusTo
        ? industryLabels[normalizeIndustryType(statusTo)] || statusTo
        : '-';
      details.push(`Rubro: ${fromLabel} → ${toLabel}`);
    } else {
      details.push(`Estado: ${statusFrom ?? '-'} → ${statusTo ?? '-'}`);
    }
  }
  if (documentType) details.push(`Tipo: ${documentType}`);
  if (sensitivity) details.push(`Sensibilidad: ${sensitivityLabel(sensitivity)}`);
  if (fileName && !details.some((item) => item.includes(fileName))) {
    details.push(`Archivo: ${fileName}`);
  }
  if (invitedEmail) details.push(`Invitado: ${invitedEmail}`);
  if (invitedRole) details.push(`Rol: ${invitationRoleLabel(invitedRole)}`);
  if (invitationStatus) details.push(`Estado: ${invitationStatusLabel(invitationStatus)}`);

  if (details.length === 0) return 'Sin detalle adicional registrado.';

  return details.slice(0, 3).join(' · ');
}

export function isDocumentAudit(log: AuditLogRecordForReport) {
  return (
    (log.resource_type === 'document' || log.action.toLowerCase().startsWith('document_')) &&
    !isAiAudit(log)
  );
}

export function isCaseAudit(log: AuditLogRecordForReport) {
  return (
    (log.resource_type === 'case' || log.action.toLowerCase().startsWith('case_')) &&
    !isAiAudit(log)
  );
}

export function isInvitationAudit(log: AuditLogRecordForReport) {
  return (
    log.resource_type === 'user_invitation' ||
    log.resource_type === 'invitation' ||
    log.action.includes('invitation') ||
    log.action.includes('invitacion')
  );
}

export function filterAuditLogs(logs: AuditLogRecordForReport[], filter: AuditReportFilter) {
  if (filter === 'documentos') return logs.filter(isDocumentAudit);
  if (filter === 'ia') return logs.filter(isAiAudit);
  if (filter === 'expedientes') return logs.filter(isCaseAudit);
  if (filter === 'invitaciones') return logs.filter(isInvitationAudit);

  return logs;
}
