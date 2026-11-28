import type { ChecklistRow } from '@/app/expedientes/[id]/CaseChecklistPanel';
import { getDaysUntilExpiry, getDocumentExpiryStatus } from '@/lib/documents/expiry';

export type ItemPendientes = Pick<ChecklistRow, 'title' | 'status' | 'document_id' | 'documents'>;

export type VigenciaProblema = { titulo: string; documento: string; estado: 'vencido' | 'por_vencer'; dias: number | null; venceEl: string | null };

export type NotaPendientesData = {
  faltantes: string[];
  vigencias: VigenciaProblema[];
  texto: string;
};

function formatFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Estados del checklist que cuentan como pendientes de completar. */
const ESTADOS_PENDIENTES = new Set(['pending']);

/**
 * Construye la nota de pendientes para el cliente a partir del checklist y de los
 * vencimientos de los documentos vinculados. Es un borrador de texto: el humano
 * lo revisa y edita antes de enviarlo (la plataforma no envía nada).
 */
export function buildNotaPendientes(
  items: ItemPendientes[],
  terminoItem: string,
  referencia: Date = new Date(),
): NotaPendientesData {
  const faltantes = items
    .filter((i) => ESTADOS_PENDIENTES.has(i.status) && i.title.trim())
    .map((i) => i.title.trim());

  const vigencias: VigenciaProblema[] = [];
  for (const item of items) {
    const expiresAt = item.documents?.expires_at ?? null;
    if (!expiresAt || !item.document_id) continue;
    const estado = getDocumentExpiryStatus(expiresAt, referencia);
    if (estado !== 'vencido' && estado !== 'por_vencer') continue;
    vigencias.push({
      titulo: item.title.trim() || 'Documento vinculado',
      documento: item.documents?.file_name ?? '',
      estado,
      dias: getDaysUntilExpiry(expiresAt, referencia),
      venceEl: formatFecha(String(expiresAt)),
    });
  }

  const lineas: string[] = [];
  lineas.push(`Documentación pendiente para completar el ${terminoItem}:`);
  if (faltantes.length > 0) {
    for (const f of faltantes) lineas.push(`• ${f}`);
  } else {
    lineas.push('• (No hay requisitos pendientes en el checklist.)');
  }
  if (vigencias.length > 0) {
    lineas.push('');
    lineas.push('Certificados / vencimientos a renovar:');
    for (const v of vigencias) {
      const detalle = v.estado === 'vencido' ? 'VENCIDO' : `vence el ${v.venceEl ?? ''}`.trim();
      lineas.push(`• ${v.titulo} (${v.documento ? `${v.documento} — ` : ''}${detalle})`);
    }
  }
  lineas.push('');
  lineas.push('Quedamos a la espera de la documentación. Cualquier duda, respondé este mensaje.');

  return { faltantes, vigencias, texto: lineas.join('\n') };
}
