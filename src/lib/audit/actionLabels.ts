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
  ai_rag_query: 'Consulta documental con IA',
  ai_rag_error: 'Error de consulta documental con IA',
  organization_name_updated: 'Nombre de organización actualizado',
  organization_logo_updated: 'Logo de organización actualizado',
  invitation_accepted_account_created: 'Invitación aceptada y cuenta creada',
  // Agenda
  agenda_event_created: 'Evento de agenda creado',
  agenda_event_updated: 'Evento de agenda actualizado',
  agenda_event_deleted: 'Evento de agenda eliminado',
  agenda_event_duplicate_prevented: 'Evento duplicado de agenda bloqueado',
  // Alquileres
  rental_created: 'Alquiler creado',
  rental_updated: 'Alquiler actualizado',
  rent_index_added: 'Índice de alquiler agregado',
  rent_index_deleted: 'Índice de alquiler eliminado',
  rental_adjusted: 'Ajuste de alquiler aplicado',
  // Clientes
  client_created: 'Cliente creado',
  client_updated: 'Cliente actualizado',
  client_match_ai: 'Matching de cliente con IA',
  // Documentos
  document_archived: 'Documento archivado',
  document_unarchived: 'Documento desarchivado',
  document_deleted: 'Documento eliminado',
  // Expedientes
  case_archived: 'Expediente archivado',
  case_unarchived: 'Expediente desarchivado',
  case_deleted: 'Expediente eliminado',
  case_aviso_generated: 'Aviso generado',
  case_borrador_inmo_generated: 'Borrador inmobiliario generado',
  checklist_auto_match_override_skipped: 'Coincidencia automática omitida por revisión manual',
  checklist_auto_matched: 'Documentos vinculados automáticamente al checklist',
  checklist_auto_match_zero_results: 'Coincidencia automática sin resultados',
  prescore_generado: 'Pre-Score crediticio generado',
  // Agente de IA (las claves van en minúscula; el formatter normaliza)
  ai_agent_query: 'Consulta al agente de IA',
  ai_agent_error: 'Error del agente de IA',
  ai_agent_memory_error: 'Error de memoria del agente de IA',
  agent_memory_cleared: 'Memoria del agente borrada',
  agent_action_approved: 'Acción del agente aprobada',
  // Modelos
  ai_model_not_found: 'Modelo de IA no encontrado',
  ai_model_industry_mismatch: 'Modelo de IA de otro rubro',
  ai_model_blocked: 'Modelo de IA bloqueado por gobernanza',
  ai_model_generated: 'Borrador de modelo generado con IA',
  ai_escrito_revisado: 'Revisión de escrito con IA',
  // Propiedades
  property_created: 'Propiedad creada',
  property_updated: 'Propiedad actualizada',
  property_match_ai: 'Matching de propiedad con IA',
  property_ad_ai: 'Aviso de propiedad generado con IA',
  property_valuation_ai: 'Tasación de propiedad con IA',
  property_ai_extract: 'Extracción de datos con IA',
  property_ai_autofill: 'Autocompletado de propiedad con IA',
  comparable_created: 'Comparable creado',
  comparable_deleted: 'Comparable eliminado',
  // Protocolo
  crear_escritura: 'Escritura creada en protocolo',
  eliminar_escritura: 'Escritura eliminada del protocolo',
  // Recibidos
  aceptar_derivacion: 'Derivación aceptada',
  rechazar_derivacion: 'Derivación rechazada',
  crear_nota_derivacion: 'Nota de derivación creada',
  subir_documento_colaborativo: 'Documento colaborativo cargado',
  // WhatsApp
  whatsapp_message_generated: 'Mensaje de WhatsApp generado',
  whatsapp_link_opened: 'Enlace de WhatsApp abierto',
};

export function formatAuditActionLabel(action?: string | null, terms?: IndustryTerms): string {
  if (!action) return 'Evento sin acción';

  let label = auditActionLabels[action] ?? auditActionLabels[action.toLowerCase()];
  
  if (label) {
    if (terms && terms.expedienteSingular.toLowerCase() !== 'expediente') {
      label = label.replace(/Expediente/g, terms.expedienteSingular);
      label = label.replace(/expediente/g, terms.expedienteSingular.toLowerCase());
      if (terms.expedienteSingular.toLowerCase() === 'operación') {
        label = label.replace(/(?:^|\s)Operación creado(?:\s|$)/g, (m) => m.replace('creado', 'creada'));
        label = label.replace(/(?:^|\s)Operación actualizado(?:\s|$)/g, (m) => m.replace('actualizado', 'actualizada'));
        label = label.replace(/(?:^|\s)Operación archivado(?:\s|$)/g, (m) => m.replace('archivado', 'archivada'));
        label = label.replace(/(?:^|\s)Operación eliminado(?:\s|$)/g, (m) => m.replace('eliminado', 'eliminada'));
      }
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
