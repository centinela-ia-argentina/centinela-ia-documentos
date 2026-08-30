import { type IndustryType } from './documentTypes';

export type CaseTemplate = {
  checklist: string[];
  defaultStatus?: string;
};

const fallbackTemplate: CaseTemplate = {
  checklist: ['Documento principal', 'Documentación de respaldo'],
};

export const caseTemplatesByType: Record<string, CaseTemplate> = {
  Demanda: {
    checklist: [
      'Poder / autorización',
      'DNI / CUIT del cliente',
      'Constancia de mediación previa',
      'Liquidación / detalle del monto reclamado',
      'Prueba documental',
      'Escrito de demanda',
      'Comprobante de tasa de justicia',
      'Bono / derecho fijo (Colegio de Abogados)',
      'Cédula de notificación',
    ],
  },
  'legal:Sucesión': {
    checklist: [
      'Partida de defunción',
      'Partidas de vínculo (nacimiento / matrimonio)',
      'DNI de los herederos',
      'Títulos de propiedad de los bienes',
      'Denuncia de bienes / inventario',
      'Avalúo fiscal de inmuebles',
      'Publicación de edictos',
      'Declaratoria de herederos',
    ],
  },
  'escribania:Sucesión': {
    checklist: [
      'Partida de defunción',
      'Partidas que acrediten los vínculos',
      'DNI de herederos o comparecientes',
      'CUIT / CUIL / CDI de las partes',
      'Declaratoria de herederos o testamento aprobado',
      'Testimonio o copia certificada del antecedente sucesorio',
      'Títulos antecedentes de los bienes',
      'Certificado de dominio',
      'Certificado de inhibiciones',
      'Valuación fiscal o documentación catastral',
      'Datos necesarios para la escritura de adjudicación',
    ],
  },
  'Contrato / Asesoramiento': {
    checklist: [
      'DNI / CUIT de las partes',
      'Poderes / personería (si hay representantes)',
      'Borrador del contrato',
      'Documentación de respaldo (antecedentes)',
      'Informe de dominio (si hay inmuebles)',
      'Contrato firmado',
    ],
  },
  Reclamo: {
    checklist: [
      'DNI / CUIT del reclamante',
      'Documentación del reclamo',
      'Intercambio epistolar (cartas documento / telegramas)',
      'Constancia de notificación / recepción',
      'Prueba documental (facturas, fotos, presupuestos)',
      'Respuesta de la contraparte',
    ],
  },
  'Caso jurídico': {
    checklist: [
      'Poder / carta poder',
      'DNI del cliente',
      'Constancia de domicilio',
      'Prueba documental',
      'Escrito principal',
      'Bono / derecho fijo (Colegio de Abogados)',
    ],
  },
  'Compraventa de inmueble': {
    checklist: [
      'Boleto de compraventa',
      'Título de propiedad',
      'DNI/CUIT de las partes',
      'Libre deuda / impuestos',
      'Tasación',
      'Escritura traslativa de dominio',
    ],
  },
  Alquiler: {
    checklist: [
      'Contrato de alquiler',
      'DNI/CUIT del inquilino',
      'Garantía',
      'Comprobante de ingresos',
      'Inventario del inmueble',
    ],
  },
  Reserva: {
    checklist: [
      'Comprobante de reserva',
      'DNI del interesado',
      'Datos del inmueble',
      'Condiciones de la operación',
    ],
  },
  Escritura: {
    checklist: [
      'Título antecedente (dominio del vendedor)',
      'DNI de los comparecientes (vendedor y comprador)',
      'Constancia de CUIT / CUIL / CDI de las partes',
      'Estado civil / asentimiento conyugal (art. 456 CCyCN)',
      'Certificado de dominio (Registro de la Propiedad Inmueble)',
      'Certificado de inhibiciones de los otorgantes',
      'Certificado catastral / valuación fiscal (cédula catastral)',
      'Libre deuda de impuesto inmobiliario (provincial / ARBA)',
      'Libre deuda municipal (tasas / ABL)',
      'Libre deuda de expensas y reglamento de copropiedad (si es PH)',
      'Plano de mensura / subdivisión',
      'Comprobante de impuesto de sellos e ITI / retención de ganancias',
      'COTI (AFIP) si corresponde por monto',
    ],
  },
  Poder: {
    checklist: [
      'DNI del / los otorgante(s)',
      'Constancia de CUIT / CUIL / CDI',
      'Estado civil del otorgante',
      'Datos completos del / los apoderado(s) (nombre, DNI, domicilio)',
      'Objeto y facultades del poder (general o especial)',
      'Si es persona jurídica: estatuto + acta de designación de autoridades vigente',
      'Minuta / borrador de facultades',
    ],
  },
  'Certificación de firmas': {
    checklist: [
      'Documento original a certificar',
      'DNI del / los firmante(s)',
      'Constancia de CUIT / CUIL (si actúa por persona jurídica)',
      'Acreditación de personería / representación (si firma por otro)',
      'Comparecencia personal del firmante',
    ],
  },
  'Acta notarial': {
    checklist: [
      'Objeto / hecho a constatar (descripción del requerimiento)',
      'DNI del requirente',
      'Legitimación / interés del requirente',
      'Datos del lugar y domicilio de la constatación',
      'Documentación de respaldo del hecho',
    ],
  },
  'Legajo de empleado': {
    checklist: [
      'DNI',
      'CUIL',
      'Contrato de trabajo',
      'Alta temprana (AFIP)',
      'Datos bancarios',
      'Documentación de cargas de familia',
    ],
  },
  'Contrato comercial': {
    checklist: [
      'Borrador del contrato',
      'DNI/CUIT de las partes',
      'Documentación de respaldo',
      'Contrato firmado',
    ],
  },
  Proveedor: {
    checklist: [
      'Constancia de inscripción (AFIP)',
      'Datos bancarios / CBU',
      'Contrato o acuerdo',
      'Facturas / comprobantes',
    ],
  },
  'Documentación societaria': {
    checklist: [
      'Estatuto / contrato social',
      'Acta de designación de autoridades',
      'Inscripción registral',
      'Poderes vigentes',
    ],
  },
  Otro: fallbackTemplate,
};

export function getCaseTemplate(industry: IndustryType, caseType?: string | null): CaseTemplate {
  if (!caseType) return fallbackTemplate;

  const specificKey = `${industry}:${caseType}`;
  if (caseTemplatesByType[specificKey]) {
    return caseTemplatesByType[specificKey];
  }

  return caseTemplatesByType[caseType] ?? fallbackTemplate;
}
