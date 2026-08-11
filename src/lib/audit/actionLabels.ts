import type { IndustryTerms } from '@/lib/industries/uiLabels';

const auditActionLabels: Record<string, string> = {
  organization_created: 'Organización creada',
  organization_industry_updated: 'Rubro de organización actualizado',
  case_created: 'Expediente creado',
  case_updated: 'Expediente actualizado',
  case_status_updated: 'Estado de expediente actualizado',
  case_checklist_created: 'Checklist documental creado',
  checklist_item_toggled: 'Ítem de checklist actualizado',
  checklist_item_linked: 'Documento vinculado al checklist',
  checklist_item_unlinked: 'Documento desvinculado del checklist',
  document_uploaded: 'Documento cargado',
  document_viewed: 'Documento visualizado',
  document_analyzed: 'Análisis documental',
  document_analyzed_beta: 'Análisis documental beta',
  user_access_updated: 'Acceso de usuario actualizado',
  user_invitation_created: 'Invitación creada',
  user_invitation_cancelled: 'Invitación cancelada',
  user_invitation_accepted: 'Invitación aceptada',
  user_invitation_status_updated: 'Estado de invitación actualizado',
  invitation_created: 'Invitación creada',
  invitation_cancelled: 'Invitación cancelada',
  invitation_accepted: 'Invitación aceptada',
  user_role_updated: 'Rol actualizado',
  case_event_added: 'Actuación registrada',
  case_event_removed: 'Actuación eliminada',
  checklist_item_added: 'Ítem de checklist agregado',
  checklist_item_marked: 'Ítem de checklist marcado',
  checklist_item_removed: 'Ítem de checklist eliminado',
  case_uif_generated: 'Análisis UIF/PLA generado',
  case_escritura_generated: 'Borrador de escritura generado',
  case_cotejo_generated: 'Cotejo documental generado',
  document_poder_generated: 'Análisis de poder/estatuto generado',
  case_summary_generated: 'Resumen de expediente generado',
  organization_name_updated: 'Nombre de organización actualizado',
  organization_logo_updated: 'Logo de organización actualizado',
  invitation_accepted_account_created: 'Invitación aceptada y cuenta creada',
};

export function formatAuditActionLabel(action?: string | null, terms?: IndustryTerms): string {
  if (!action) return 'Evento sin acción';

  const label = auditActionLabels[action];
  if (label) {
    if (terms && terms.expedienteSingular.toLowerCase() === 'operación') {
      if (action === 'case_created') return 'Operación creada';
      if (action === 'case_updated') return 'Operación actualizada';
      if (action === 'case_status_updated') return 'Estado de operación actualizado';
      if (action === 'case_summary_generated') return 'Resumen de operación generado';
      if (action === 'case_event_added') return 'Movimiento de operación registrado';
      if (action === 'case_event_removed') return 'Movimiento de operación eliminado';
      if (action === 'case_checklist_created') return 'Checklist documental de operación creado';
    } else if (terms && terms.expedienteSingular.toLowerCase() !== 'expediente') {
      // Escribania (Legajo) or others
      const singular = terms.expedienteSingular;
      const lower = singular.toLowerCase();
      if (action === 'case_created') return `${singular} creado`;
      if (action === 'case_updated') return `${singular} actualizado`;
      if (action === 'case_status_updated') return `Estado de ${lower} actualizado`;
      if (action === 'case_summary_generated') return `Resumen de ${lower} generado`;
      if (action === 'case_event_added') return `Actuación registrada`;
      if (action === 'case_event_removed') return `Actuación eliminada`;
      if (action === 'case_checklist_created') return `Checklist documental de ${lower} creado`;
    }
    return label;
  }

  return action
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatResourceTypeLabel(resourceType?: string | null, terms?: IndustryTerms): string {
  if (!resourceType) return 'Recurso sin clasificar';
  const norm = resourceType.toLowerCase();
  switch (norm) {
    case 'organization': return 'Organización';
    case 'case': return terms ? terms.expedienteSingular : 'Expediente';
    case 'document': return 'Documento';
    case 'user': return 'Usuario';
    case 'invitation':
    case 'user_invitation': return 'Invitación';
    case 'ai':
    case 'ai_output': return 'Motor IA';
    default:
      return norm.charAt(0).toUpperCase() + norm.slice(1);
  }
}
