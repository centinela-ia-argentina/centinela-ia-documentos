'use server';

import { getUserProfile } from '@/lib/auth/getUserProfile';
import type { IndustryType } from '@/lib/industries/documentTypes';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { getStrictIndustryForOrganization } from '@/lib/auth/getStrictIndustry';
import { canUseAi } from '@/lib/permissions/roles';
import {
  responderAgenteLegajo,
  type MensajeChat,
  type AccionPropuesta,
} from '@/lib/ai/agente';

export async function preguntarAgenteGlobal(input: {
  historial: MensajeChat[];
  pregunta: string;
}): Promise<
  | { ok: false; motivo: string }
  | { ok: true; respuesta: string; acciones: AccionPropuesta[] }
> {
  const pregunta = (input.pregunta ?? '').trim();
  if (!pregunta) return { ok: false, motivo: 'Escribí una pregunta.' };

  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false, motivo: 'Sesión no válida.' };
  if (!canUseAi(profile.role)) {
    return { ok: false, motivo: 'No tenés permiso para usar la IA.' };
  }

  let industry: IndustryType;
  try {
    industry = await getStrictIndustryForOrganization(profile.organization_id);
  } catch {
    return { ok: false, motivo: 'Industria no autorizada.' };
  }

  const terms = getIndustryTerms(industry);
  const contextoLegajo = [
    'ROL: Agente IA general de guía de la plataforma Anulus.',
    'ALCANCE OBLIGATORIO:',
    '- Explicá para qué sirve cada módulo, dónde encontrar una función y qué flujo seguir dentro de la plataforma.',
    `- Usá el vocabulario del rubro activo: ${terms.expedientePlural}, documentos y herramientas asociadas.`,
    '- No disponés de datos operativos de la organización, documentos, Agenda, alertas, vencimientos ni casos concretos.',
    '- No enumeres, resumas ni interpretes alertas, prioridades, fechas o riesgos de la organización.',
    '- Si preguntan por alertas, vencimientos, firmas o turnos, indicá que se consultan en Agenda.',
    `- Si preguntan por el contenido, estado, documentos, riesgos o próximos pasos de ${terms.unExpediente} específico, indicá que deben abrir ${terms.elExpediente} y usar su Agente IA contextual.`,
    '- No ejecutes acciones ni propongas bloques de acción.',
    '',
    'MAPA BÁSICO DE LA PLATAFORMA:',
    `- Inicio: panorama general y acceso a las áreas de trabajo; no contiene el centro de alertas.`,
    `- ${terms.expedientePlural}: listado y gestión de los registros del rubro.`,
    '- Documentos: bóveda, carga, consulta y análisis documental.',
    '- Agenda: único centro visual de alertas, calendario, vencimientos, firmas, turnos y recordatorios.',
    '- Observaciones: excepciones, inconsistencias y datos que requieren revisión.',
    '- Buscar: localización transversal de registros y documentos.',
    '- Modelos y Herramientas: recursos reutilizables y utilidades del rubro.',
    '- Agente IA contextual: análisis y orientación sobre un registro específico.',
    '',
    'ESTILO DE RESPUESTA: breve, claro, orientado a navegación y sin inventar datos de la organización.',
  ].join('\n');

  const historial = Array.isArray(input.historial)
    ? input.historial
        .filter(
          (message) =>
            message &&
            (message.rol === 'user' || message.rol === 'model') &&
            typeof message.texto === 'string'
        )
        .slice(-12)
    : [];

  const response = await responderAgenteLegajo({
    industry,
    contextoLegajo,
    historial,
    pregunta,
  });

  if (!response.ok) {
    const motivo =
      response.motivo === 'sin_api_key'
        ? 'La IA no está configurada (falta la API key).'
        : 'No pude generar una respuesta. Probá de nuevo.';
    return { ok: false, motivo };
  }

  return { ok: true, respuesta: response.respuesta, acciones: [] };
}
