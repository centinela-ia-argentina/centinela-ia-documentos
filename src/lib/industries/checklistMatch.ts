// Auto-marcado inteligente del checklist: compara los documentos cargados
// (tipo detectado por la IA + nombre de archivo) contra los ítems del
// checklist, sin llamar a ningún proveedor externo. Lógica pura.
export type DocumentoParaMatch = {
  id: string;
  file_name: string | null;
  document_type: string | null;
};

export type SugerenciaChecklist = {
  itemTitle: string;
  documentId: string;
  documentName: string;
  score: number;
};

const STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'a', 'en', 'con',
  'para', 'por', 'un', 'una', 'al', 'se', 'su', 'sus', 'the', 'of',
]);

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();
}

function tokens(texto: string): string[] {
  return normalizar(texto)
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

// Grupos de sinónimos: si un ítem y un documento comparten palabras del
// mismo grupo, se consideran del mismo "concepto documental".
const GRUPOS_SINONIMOS: string[][] = [
  ['boleto', 'compraventa', 'compra', 'venta'],
  ['titulo', 'dominio', 'propiedad'],
  ['escritura', 'traslativa', 'escrituracion'],
  ['dni', 'identidad', 'pasaporte'],
  ['cuit', 'cuil', 'cdi'],
  ['coti'],
  ['catastral', 'catastro', 'cedula'],
  ['libre', 'deuda', 'impuestos', 'municipal', 'expensas', 'abl', 'tasas'],
  ['tasacion', 'valuacion', 'valuatorio', 'valor'],
  ['garantia', 'garante', 'fianza', 'aval'],
  ['contrato', 'locacion', 'alquiler', 'arrendamiento'],
  ['ingresos', 'recibo', 'sueldo', 'haberes'],
  ['inventario', 'mobiliario'],
  ['reserva', 'sena', 'senia'],
  ['plano', 'planos', 'mensura'],
  ['afip', 'inscripcion'],
  ['inhibicion', 'inhibiciones', 'anotaciones', 'personales'],
];

function conceptosDe(texto: string): Set<number> {
  const toks = tokens(texto);
  const conceptos = new Set<number>();
  GRUPOS_SINONIMOS.forEach((grupo, idx) => {
    if (grupo.some((palabra) => toks.includes(palabra))) {
      conceptos.add(idx);
    }
  });
  return conceptos;
}

export function puntuarCoincidencia(
  itemTitle: string,
  documento: DocumentoParaMatch
): number {
  const textoDocRaw = `${documento.document_type ?? ''} ${documento.file_name ?? ''}`.toLowerCase();
  const tituloNorm = itemTitle.toLowerCase();
  
  // Reglas de exclusión fuerte para evitar cruces (ej. COTI vs catastral)
  if (tituloNorm.includes('coti') && !textoDocRaw.includes('coti')) {
    return 0; // COTI solo matchea con algo que diga COTI
  }
  if ((tituloNorm.includes('cuit') || tituloNorm.includes('cuil') || tituloNorm.includes('cdi')) && 
      (!textoDocRaw.includes('cuit') && !textoDocRaw.includes('cuil') && !textoDocRaw.includes('cdi'))) {
    return 0; // CUIT/CUIL/CDI solo matchea si el doc lo menciona
  }
  if (tituloNorm.includes('catastral') && (textoDocRaw.includes('coti') || textoDocRaw.includes('cuit') || textoDocRaw.includes('cuil'))) {
    return 0; // Catastral no puede ser un CUIT o COTI
  }

  let bonus = 0;
  // DNI explícito
  if (tituloNorm.includes('dni') && (textoDocRaw.includes('dni') || textoDocRaw.includes('documento nacional'))) {
    bonus += 20;
  }
  // Catastral explícito
  if (tituloNorm.includes('catastral') && textoDocRaw.includes('catastral')) {
    bonus += 20;
  }

  const textoDoc = `${documento.document_type ?? ''} ${documento.file_name ?? ''}`;
  const conceptosItem = conceptosDe(itemTitle);
  const conceptosDoc = conceptosDe(textoDoc);
  let compartidos = 0;
  conceptosItem.forEach((c) => {
    if (conceptosDoc.has(c)) compartidos += 1;
  });
  const toksItem = new Set(tokens(itemTitle));
  const toksDoc = new Set(tokens(textoDoc));
  let solapados = 0;
  toksItem.forEach((t) => {
    if (toksDoc.has(t)) solapados += 1;
  });
  // Concepto compartido pesa más que un simple token en común.
  return (compartidos * 2) + solapados + bonus;
}

export function sugerirCoincidencias(
  items: Array<{ title: string }>,
  documentos: DocumentoParaMatch[],
  opciones?: { umbral?: number }
): Map<string, SugerenciaChecklist> {
  const umbral = opciones?.umbral ?? 2;
  const usados = new Set<string>();
  const resultado = new Map<string, SugerenciaChecklist>();
  for (const item of items) {
    let mejor: SugerenciaChecklist | null = null;
    for (const doc of documentos) {
      if (usados.has(doc.id)) continue;
      const score = puntuarCoincidencia(item.title, doc);
      if (score >= umbral && (!mejor || score > mejor.score)) {
        mejor = {
          itemTitle: item.title,
          documentId: doc.id,
          documentName: doc.file_name ?? 'Documento',
          score,
        };
      }
    }
    if (mejor) {
      usados.add(mejor.documentId);
      resultado.set(item.title, mejor);
    }
  }
  return resultado;
}
