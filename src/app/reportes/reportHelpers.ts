export interface AuditLogRecordForReport {
  id: string;
  organization_id?: string | null;
  user_id?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function metadataText(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];

  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';

  return null;
}

export function parseStrictPositiveInteger(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!/^[1-9]\d*$/.test(s)) return null;
  const num = Number(s);
  if (!Number.isSafeInteger(num) || num <= 0) return null;
  return num;
}

export function isAiAudit(log: AuditLogRecordForReport) {
  const action = log.action.toLowerCase();
  return (
    action.includes('analyzed') ||
    action.startsWith('ai_') ||
    action.includes('uif') ||
    action.includes('ros') ||
    action.includes('prescore') ||
    metadataText(log.metadata, 'output_type') === 'document_analysis'
  );
}
