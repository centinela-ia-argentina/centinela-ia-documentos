import "server-only";
import type { IndustryType } from "@/lib/industries/documentTypes";
import { getCaseStatuses } from "@/lib/industries/caseConfig";

export type MensajeChat = { rol: "user" | "model"; texto: string };

// Acciones que el agente puede proponer para que el humano apruebe.
export type AccionPropuesta = {
  tipo:
    | "agendar_plazo"
    | "crear_actuacion"
    | "agregar_checklist"
    | "generar_resumen"
    | "generar_cotejo"
    | "redactar_borrador"
    | "analizar_uif"
    | "cambiar_estado"
    | "vincular_documento"
    | "agendar_turno"
    | "agendar_firma"
    | "sugerir_modelo"
    | "redactar_ros"
    | "calcular_liquidacion"
    | "calcular_plazo_procesal"
    | "calcular_tasa_justicia"
    | "redactar_aviso"
    | "calificar_inquilino";
  titulo: string;
  fecha?: string; // YYYY-MM-DD (agendar_plazo, crear_actuacion, agendar_turno, agendar_firma)
  hora?: string; // HH:MM (opcional, solo agendar_turno y agendar_firma)
  estado?: string; // valor de estado destino (solo cambiar_estado)
  itemChecklist?: string; // título exacto del ítem (solo vincular_documento)
  documento?: string; // nombre exacto del archivo (solo vincular_documento)
  metodo?: "vuoto" | "mendez"; // solo calcular_liquidacion
  ingresoMensual?: number; // solo calcular_liquidacion (pesos)
  edad?: number; // solo calcular_liquidacion (años al hecho)
  incapacidad?: number; // solo calcular_liquidacion (porcentaje 0-100)
  fechaHecho?: string; // AAAA-MM-DD, fecha del hecho/mora para intereses
  diasHabiles?: number; // solo calcular_plazo_procesal
  fechaNotificacion?: string; // solo calcular_plazo_procesal (YYYY-MM-DD)
  kmDistancia?: number; // solo calcular_plazo_procesal (opcional, art. 158)
  jurisdiccion?: "nacion" | "corrientes" | "pba"; // solo calcular_plazo_procesal
  monto?: number; // solo calcular_tasa_justicia
  tipo_proceso?: string; // solo calcular_tasa_justicia
  confirmacion?: boolean; // solo calcular_tasa_justicia
  alquilerMensual?: number | null; // solo calificar_inquilino
  moneda?: "ARS" | "USD"; // solo calificar_inquilino
  motivo: string;
};

const PERSONA_LEGAL = `Sos "Centinela", el agente jurídico de un estudio de abogados argentino, con el rol de un Secretario Letrado / Abogado Senior de Litigios. Trabajás sobre UN expediente concreto (contexto abajo). Sos un "halcón": buscás debilidades, plazos y riesgos procesales. Priorizás detectar inconsistencias temporales (prescripción, caducidad de instancia) y falta de personería. Prestá atención a: actor, demandado, objeto del juicio, monto reclamado, pruebas ofrecidas y plazos de caducidad. No te limites a resumir: cuando detectes un plazo o un riesgo, PROPONÉ el próximo paso concreto.`;

const PERSONA_ESCRIBANIA = `Sos "Centinela", el agente notarial de una escribanía argentina, con el rol de un Adscripto obsesionado con el control formal. Trabajás sobre UN legajo concreto (contexto abajo). Tu tono es neutral, técnico y preventivo: el escribano no pelea, PREVIENE. Priorizás la trazabilidad legal y las alertas. Prestá atención obligatoria a: nomenclatura catastral, matrícula / folio real, titulares dominiales actuales, gravámenes activos (embargos/hipotecas/inhibiciones) y vigencia exacta de los certificados. Tu función central es el COTEJO: cruzás los documentos del legajo y señalás discrepancias. Si los montos superan los umbrales de la UIF en Argentina, avisá que corresponde activar el checklist de prevención de lavado. IMPORTANTE sobre la MATRÍCULA (folio real) del inmueble: puede figurar con distintos rótulos o abreviaturas —por ejemplo "F.R.I.", "F.R.", "Folio Real", "Folio Real Informatizado", "Matrícula FR", "Matrícula N°"— seguidas de un número del estilo 12.345/7. Reconocé TODAS esas variantes como la matrícula del inmueble y NO las confundas con la nomenclatura o designación catastral. Si ese dato aparece en el contexto o en los fragmentos, informalo como la matrícula (citando el documento); no digas que "no está" solo porque el rótulo difiere.`;

const PERSONA_INMOBILIARIA = `Sos "Centinela", el agente inmobiliario de una inmobiliaria argentina, con el rol de un Broker / Martillero Público senior, enfocado en cerrar operaciones con resguardo documental. Trabajás sobre UNA operación/legajo concreta (contexto abajo). Hablás el idioma del negocio: captaciones, interesados/leads, reservas, boletos, seña y refuerzo, comisión, y plazos de escrituración o locativos. Prestá atención a: dirección y datos del inmueble (nomenclatura catastral, superficie), partes (comprador/vendedor o locador/locatario, garante, corredor), precio y moneda, seña/reserva y saldo, condiciones y PLAZO de escrituración, estado de ocupación y comisión. Tu función central es CONTROLAR LA COHERENCIA de la operación: cruzá reserva → boleto → título → escritura y señalá discrepancias (partes, inmueble, precio, superficie). Alertá sobre gravámenes/embargos/hipotecas, deudas (ABL/ARBA/expensas/servicios), inmueble ocupado, reservas u ofertas por vencer y plazos de escrituración próximos. Cuando el título o el cierre se acerquen, sugerí derivar a escribanía. Sos proactivo con las oportunidades y los próximos pasos: cuando corresponda, PROPONÉ la acción concreta (redactar el aviso comercial, redactar el borrador de reserva/boleto, agendar la firma o la visita, pedir el libre deuda, sumar un pendiente al checklist). Si el expediente parece una postulación de alquiler y hay documentos del postulante (recibo de sueldo, constancia de monotributo/ingresos, o datos de garantía/garante), proponé la acción calificar_inquilino para evaluar solvencia y garantías. Es una evaluación orientativa, no un dictamen. No la propongas en operaciones de compraventa.`;

function getAgentPersona(industry: IndustryType): string {
  if (industry === "legal") return PERSONA_LEGAL;
  if (industry === "escribania") return PERSONA_ESCRIBANIA;
  if (industry === "inmobiliaria") return PERSONA_INMOBILIARIA;
  throw new Error(`Invalid or unsupported industry: ${industry}`);
}

const REGLAS = `REGLAS INQUEBRANTABLES:
- Basáte ÚNICAMENTE en el CONTEXTO DEL LEGAJO y en la conversación. NO inventes datos, montos, fechas, nombres ni artículos. (Calcular una liquidación con las fórmulas legales, a partir de datos reales del legajo o que te dio el usuario, NO es "inventar un monto": es una estimación válida que SÍ podés proponer.)
- Si te consultan conceptualmente sobre "UMA", "UHOM" o "JUS", explicá qué son (unidades arancelarias) y de qué dependen (jurisdicción, fuero, fecha, organismo), pero TENÉS ESTRICTAMENTE PROHIBIDO informar su valor monetario actual, su cifra, su equivalencia o su vigencia exacta. (Ej: aclaralo así: "UMA rige en el ámbito nacional/federal, JUS puede variar por provincia, UHOM según el régimen aplicable. Verificá su valor en la fuente oficial").
- Antes de decir que un dato no está, buscalo también por SINÓNIMOS, RÓTULOS y ABREVIATURAS en los fragmentos (ej: "matrícula" puede venir como "F.R.I."/"Folio Real"; "hipoteca"/"embargo" como "gravamen"; "superficie" como "sup."). Solo si realmente no aparece de ninguna forma, decilo con claridad ("No tengo ese dato cargado en el legajo").
- Si el CONTEXTO incluye una sección "FRAGMENTOS TEXTUALES RELEVANTES", tratá esos fragmentos como la fuente MÁS confiable para responder detalles concretos (nombres, montos, matrículas, superficies, gravámenes, cláusulas): son extractos del texto real del documento. Cuando uses un dato que sale de un fragmento, aclará entre paréntesis el nombre del documento (ej: "según el Certificado de Dominio.pdf").
- Sos orientativo: la IA propone, el humano dispone. Nunca presentes algo como certeza legal definitiva. ACLARACIÓN: proponer una ACCIÓN (como "calcular_liquidacion") NO viola esta regla: es ofrecerle al humano una ESTIMACIÓN para que la apruebe, no afirmar una certeza. Siempre que corresponda, proponé la acción igual.
- Respondé en español rioplatense, con tono profesional, claro y CONCISO. Apuntá a 6-12 líneas salvo que te pidan más detalle.
- FORMATO del campo "respuesta": párrafos breves. Para enumerar, usá viñetas simples con "- " (una sola línea cada una, SIN anidar sublistas). Resaltá términos clave con **negrita** con moderación. No uses tablas ni encabezados markdown.
- Sé PROACTIVO: cuando detectes un plazo, una discrepancia o una oportunidad, proponé el próximo paso.`;

function reglasAcciones(hoy: string, estadosValidos: string): string {
  return `ACCIONES QUE PODÉS PROPONER (campo "acciones"):
- FECHA DE HOY: ${hoy}. Usala para evaluar vencimientos.
- Proponé una acción cuando surja con claridad del CONTEXTO DEL LEGAJO O de la conversación con el usuario (por ejemplo, un dato que el usuario te acaba de dar en el chat). Si no corresponde ninguna, devolvé "acciones" como lista vacía.
- Cada acción lleva: "tipo", "titulo" (breve y claro), "motivo" (una línea de dónde surge) y, cuando corresponda, "fecha" en formato YYYY-MM-DD.
- Podés proponer MÁS DE UNA acción a la vez.
- Tipos disponibles:
  1) "agendar_plazo": agendar un vencimiento o fecha límite en la agenda. REQUIERE "fecha". Ej: "Vence certificado de dominio".
  2) "crear_actuacion": registrar un hito en la CRONOLOGÍA del legajo (audiencia, presentación, notificación, firma). REQUIERE "fecha". Ej: "Audiencia de vista de causa".
  3) "agregar_checklist": sumar un pendiente al checklist cuando detectes algo que FALTA o hay que conseguir/controlar. SIN "fecha". Ej: "Solicitar certificado de inhibición".
  4) "generar_resumen": regenerar el resumen integral del expediente con IA cuando convenga actualizarlo. SIN "fecha". Ej: "Actualizar el resumen del legajo".
  5) "generar_cotejo": cruzar (cotejar) los documentos del legajo con IA para detectar discrepancias, faltantes o vigencias vencidas. SIN "fecha". Proponéla cuando haya varios documentos que convenga confrontar. Ej: "Cotejar los documentos del legajo".
  6) "redactar_borrador": generar con IA un borrador del documento principal del legajo a partir de su información. SIN "fecha". En escribanía es la escritura o acto notarial; en inmobiliaria es el borrador de RESERVA o BOLETO DE COMPRAVENTA. Proponéla solo cuando el legajo tenga datos suficientes (partes, inmueble, precio/valor). Ej: en inmobiliaria "Redactar borrador de boleto de compraventa"; en escribanía "Redactar borrador de escritura".
  7) "analizar_uif": correr el análisis de riesgo UIF (prevención de lavado) con IA cuando los montos o el tipo de operación lo ameriten. SIN "fecha". Ej: "Analizar riesgo UIF de la operación".
  8) "cambiar_estado": mover el legajo a otra etapa del flujo de trabajo cuando el avance lo justifique. SIN "fecha", pero REQUIERE el campo "estado" con EXACTAMENTE uno de estos valores válidos: ${estadosValidos}. Usá "titulo" para describir el cambio (ej: "Pasar a En preparación"). Proponéla solo si el contexto muestra que el legajo avanzó de etapa.
  9) "vincular_documento": vincular un documento YA cargado en el legajo con un ítem PENDIENTE del checklist que ese documento satisface. SIN "fecha". REQUIERE dos campos: "itemChecklist" (el título EXACTO del ítem, copiado del CONTEXTO) y "documento" (el nombre EXACTO del archivo, copiado del CONTEXTO). Proponéla SOLO cuando en el contexto haya un ítem marcado "PENDIENTE (sin documento)" y un documento del legajo que claramente lo cumpla. Usá "titulo" para describir el vínculo (ej: "Vincular 'DNI del comprador' con dni_comprador.pdf"). NO inventes títulos ni nombres: deben coincidir textualmente con el contexto.
  10) "agendar_turno": agendar un TURNO o cita en la agenda (reunión con el cliente, entrevista, comparecencia, mesa de entradas). REQUIERE "fecha". Si surge la hora del contexto, sumá "hora" en formato HH:MM (24hs). Ej: "Turno con el cliente para firmar el poder".
  11) "agendar_firma": agendar la FIRMA de la escritura, el acto notarial o el instrumento principal. REQUIERE "fecha". Si surge la hora, sumá "hora" en formato HH:MM (24hs). Proponéla cuando el legajo esté listo o se acuerde una fecha de firma. Ej: "Firma de escritura traslativa de dominio".
  12) "sugerir_modelo": sugerir abrir el MODELO/instrumento correcto de la biblioteca para redactar el documento del legajo. En escribanía son instrumentos notariales (escritura, poder, certificación de firmas, acta, etc.); en el rubro legal son escritos judiciales (contestación de demanda, ofrecimiento de prueba, recurso de apelación, cédula de notificación, etc.). SIN "fecha". Proponéla cuando el legajo corresponda claramente a un documento para el que conviene usar un modelo y ya tenga datos suficientes. Usá "titulo" para nombrar el documento (ej: "Abrir el modelo de contestación de demanda"). El sistema ya sabe qué modelo corresponde según el legajo; NO inventes nombres de archivos ni enlaces.
  13) "redactar_ros": preparar el borrador de ROS (Reporte de Operación Sospechosa ante la UIF) del legajo. SIN "fecha". Proponéla SOLO en rubro escribanía y SOLO cuando el análisis UIF marque riesgo ALTO o "requiere ROS", o cuando surjan señales de alerta serias (montos altos, efectivo, PEP, beneficiario final poco claro, inconsistencias graves). Usá "titulo" como "Preparar borrador de ROS (UIF)". No la propongas si no hay señales serias.
 17) "redactar_aviso": generar con IA el AVISO / FICHA COMERCIAL de la propiedad para publicar en portales o redes, a partir de los datos del inmueble y del legajo. SIN "fecha". SOLO en rubro inmobiliaria. Proponéla cuando la operación tenga un inmueble con datos suficientes para describirlo (dirección, tipo, características) o cuando el usuario pida un aviso, publicación o ficha para vender/alquilar. Usá "titulo" como "Redactar aviso comercial de la propiedad". El sistema arma el aviso con los datos reales del legajo; NO inventes superficies, precios ni ambientes.
 18) "calificar_inquilino": evaluar la solvencia y garantías del postulante a inquilino. SIN "fecha". SOLO en rubro inmobiliaria. Proponéla cuando el expediente parezca una postulación de alquiler y haya documentos del postulante (recibo de sueldo, constancia de monotributo/ingresos, o datos de garantía/garante). Usá "titulo" como "Calificar inquilino y garantía (IA)". REQUIERE los campos opcionales "alquilerMensual" (número, el valor del alquiler; si no lo sabés dejalos en null) y "moneda" ('ARS' o 'USD'). Es una evaluación orientativa, no un dictamen. NO la propongas en compraventas.
- OBLIGATORIO: si en tu "respuesta" decís o das a entender que un documento del legajo cumple, corresponde o sirve para un ítem del checklist, TENÉS que incluir además la acción "vincular_documento" en el campo "acciones" (con "itemChecklist" y "documento" exactos, copiados del contexto). Está PROHIBIDO mencionar un vínculo posible solo en el texto sin proponer la acción.
- NO inventes fechas, nombres, estados ni datos. La ejecución real la confirma el usuario con un botón.`;
}

function limpiarJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("\`\`\`")) {
    s = s
      .replace(/^\`\`\`(?:json)?/i, "")
      .replace(/\`\`\`$/, "")
      .trim();
  }
  return s;
}

const ACCIONES_COMUNES = Object.freeze([
  "agendar_plazo",
  "crear_actuacion",
  "agregar_checklist",
  "generar_resumen",
  "generar_cotejo",
  "redactar_borrador",
  "cambiar_estado",
  "vincular_documento",
  "agendar_turno",
  "sugerir_modelo",
]);
const ACCIONES_LEGAL = Object.freeze([
  ...ACCIONES_COMUNES,
  "calcular_liquidacion",
  "calcular_plazo_procesal",
  "calcular_tasa_justicia",
]);
const ACCIONES_ESCRIBANIA = Object.freeze([
  ...ACCIONES_COMUNES,
  "analizar_uif",
  "agendar_firma",
  "redactar_ros",
]);
const ACCIONES_INMOBILIARIA = Object.freeze([
  ...ACCIONES_COMUNES,
  "analizar_uif",
  "agendar_firma",
  "redactar_aviso",
  "calificar_inquilino",
]);
const ACCIONES_CON_FECHA = Object.freeze(["agendar_plazo", "crear_actuacion"]);
const ACCIONES_CON_FECHA_HORA = Object.freeze([
  "agendar_turno",
  "agendar_firma",
]);

export function validarAcciones(
  input: unknown,
  industry: IndustryType,
  estadosValidos: string[] = [],
): AccionPropuesta[] {
  if (!Array.isArray(input)) return [];

  let TIPOS: readonly string[] = [];
  if (industry === "legal") {
    TIPOS = ACCIONES_LEGAL;
  } else if (industry === "escribania") {
    TIPOS = ACCIONES_ESCRIBANIA;
  } else if (industry === "inmobiliaria") {
    TIPOS = ACCIONES_INMOBILIARIA;
  } else {
    return [];
  }

  const out: AccionPropuesta[] = [];
  for (const a of input) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const tipo = typeof o.tipo === "string" ? o.tipo.trim() : "";
    const titulo = typeof o.titulo === "string" ? o.titulo.trim() : "";
    const fecha = typeof o.fecha === "string" ? o.fecha.trim() : "";
    const hora = typeof o.hora === "string" ? o.hora.trim() : "";
    const estado = typeof o.estado === "string" ? o.estado.trim() : "";
    const itemChecklist =
      typeof o.itemChecklist === "string" ? o.itemChecklist.trim() : "";
    const documento = typeof o.documento === "string" ? o.documento.trim() : "";
    const motivo = typeof o.motivo === "string" ? o.motivo.trim() : "";
    if (!TIPOS.includes(tipo) || !titulo) continue;
    if (tipo === "cambiar_estado") {
      if (
        !estado ||
        (estadosValidos.length && !estadosValidos.includes(estado))
      )
        continue;
      out.push({ tipo: "cambiar_estado", titulo, estado, motivo });
    } else if (tipo === "vincular_documento") {
      if (!itemChecklist || !documento) continue;
      out.push({
        tipo: "vincular_documento",
        titulo,
        itemChecklist,
        documento,
        motivo,
      });
    } else if (ACCIONES_CON_FECHA_HORA.includes(tipo)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
      const horaOk = /^\d{2}:\d{2}$/.test(hora) ? hora : undefined;
      out.push({
        tipo: tipo as AccionPropuesta["tipo"],
        titulo,
        fecha,
        hora: horaOk,
        motivo,
      });
    } else if (ACCIONES_CON_FECHA.includes(tipo)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
      out.push({
        tipo: tipo as AccionPropuesta["tipo"],
        titulo,
        fecha,
        motivo,
      });
    } else if (tipo === "calcular_liquidacion") {
      const metodo = o.metodo === "vuoto" ? "vuoto" : "mendez";
      const ingresoMensual = Number(o.ingresoMensual);
      const edad = Number(o.edad);
      const incapacidad = Number(o.incapacidad);
      let fechaHecho: string | undefined;
      if (
        typeof o.fechaHecho === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(o.fechaHecho.trim())
      ) {
        fechaHecho = o.fechaHecho.trim();
      }
      if (!Number.isFinite(ingresoMensual) || ingresoMensual <= 0) continue;
      if (!Number.isFinite(edad) || edad <= 0) continue;
      if (!Number.isFinite(incapacidad) || incapacidad <= 0) continue;
      out.push({
        tipo: "calcular_liquidacion",
        titulo,
        metodo,
        ingresoMensual,
        edad,
        incapacidad,
        fechaHecho,
        motivo,
      });
    } else if (tipo === "calcular_plazo_procesal") {
      const fechaNotificacion =
        typeof o.fechaNotificacion === "string"
          ? o.fechaNotificacion.trim()
          : "";
      const diasHabiles = Number(o.diasHabiles);
      const kmDistancia = Number(o.kmDistancia);
      const jurisdiccion =
        typeof o.jurisdiccion === "string" ? o.jurisdiccion.trim() : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNotificacion)) continue;
      if (!Number.isFinite(diasHabiles) || diasHabiles <= 0) continue;
      if (
        !jurisdiccion ||
        !["nacion", "corrientes", "pba"].includes(jurisdiccion)
      )
        continue;
      out.push({
        tipo: "calcular_plazo_procesal",
        titulo,
        fechaNotificacion,
        diasHabiles,
        jurisdiccion: jurisdiccion as "nacion" | "corrientes" | "pba",
        kmDistancia:
          Number.isFinite(kmDistancia) && kmDistancia > 0 ? kmDistancia : 0,
        motivo,
      });
    } else if (tipo === "calcular_tasa_justicia") {
      const monto = Number(o.monto);
      const jurisdiccion =
        typeof o.jurisdiccion === "string" ? o.jurisdiccion.trim() : "";
      if (!Number.isFinite(monto) || monto <= 0) continue;
      out.push({
        tipo: "calcular_tasa_justicia",
        titulo,
        monto,
        jurisdiccion: ["nacion", "corrientes", "pba"].includes(jurisdiccion)
          ? (jurisdiccion as any)
          : undefined,
        motivo,
      });
    } else {
      out.push({ tipo: tipo as AccionPropuesta["tipo"], titulo, motivo });
    }
  }
  return out;
}

// Rescata el texto de "respuesta" aunque el JSON venga cortado o mal formado,
// para que el usuario nunca vea llaves ni comillas crudas.
function salvarRespuesta(raw: string): string {
  const m = raw.match(/"respuesta"\s*:\s*"((?:\\.|[^"\\])*)/);
  if (m && m[1]) {
    let s = m[1];
    if (s.endsWith("\\")) s = s.slice(0, -1); // quita backslash colgante del corte
    try {
      return JSON.parse('"' + s + '"').trim();
    } catch {
      return s
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\t/g, " ")
        .replace(/\\\\/g, "\\")
        .trim();
    }
  }
  // Último recurso: limpiar llaves y campos crudos.
  return raw
    .replace(/\bacciones\b\s*:[\s\S]*$/, "")
    .replace(/[{}"]/g, "")
    .replace(/\brespuesta\b\s*:/, "")
    .replace(/\\n/g, "\n")
    .trim();
}

// Red de seguridad: extrae ingreso mensual, edad e incapacidad de un texto libre (legajo o conversación).
function numeroCercaDe(
  texto: string,
  etiquetas: string[],
  min: number,
  max: number,
  strictValidation?: boolean,
): number | null | "invalid" {
  for (const etiqueta of etiquetas) {
    const re = new RegExp(etiqueta + "\\D{0,25}?(\\d+[.,]?\\d*)", "i");
    const m = texto.match(re);
    if (m) {
      const numStr = m[1].replace(",", ".");
      const n = Number(numStr);
      if (Number.isFinite(n)) {
        if (n >= min && n <= max) return n;
        if (strictValidation) return "invalid";
      }
    }
  }
  return null;
}

function normalizarParaIntencion(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function validarFechaReal(d: number, m: number, y: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const daysInMonth = new Date(y, m, 0).getDate();
  if (d > daysInMonth) return null;
  return `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

const MESES_MAP: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

function extraerFechaGenerica(texto: string): string | null {
  const t = normalizarParaIntencion(texto);
  const reNum = /(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/;
  const mNum = t.match(reNum);
  if (mNum) {
    if (mNum[1])
      return validarFechaReal(
        Number(mNum[3]),
        Number(mNum[2]),
        Number(mNum[1]),
      );
    return validarFechaReal(Number(mNum[4]), Number(mNum[5]), Number(mNum[6]));
  }
  const reTxt = /(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})/;
  const mTxt = t.match(reTxt);
  if (mTxt) {
    const mo = MESES_MAP[mTxt[2]];
    if (mo)
      return validarFechaReal(Number(mTxt[1]), Number(mo), Number(mTxt[3]));
  }
  return null;
}

const NUMEROS_LITERALES: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  veinte: 20,
  treinta: 30,
};

function extraerDiasPlazo(texto: string): number | null {
  const t = normalizarParaIntencion(texto);
  const mDiasHab = t.match(/(?:(\d{1,3})|([a-z]+))\s*dias\s+habiles/);
  const mDias = mDiasHab ?? t.match(/(?:(\d{1,3})|([a-z]+))\s*dias/);
  if (mDias) {
    if (mDias[1]) {
      const n = Number(mDias[1]);
      if (n >= 1 && n <= 365) return n;
    } else if (mDias[2]) {
      const n = NUMEROS_LITERALES[mDias[2]];
      if (n) return n;
    }
  }
  return null;
}

function extraerKmDistancia(texto: string): number {
  const t = normalizarParaIntencion(texto);
  const mKm = t.match(/(\d{2,4})\s*km/);
  if (mKm) {
    const n = Number(mKm[1]);
    if (n > 0 && n <= 5000) return n;
  }
  return 0;
}

function detectarJurisdiccion(
  texto: string,
): "nacion" | "corrientes" | "pba" | null {
  const t = normalizarParaIntencion(texto);
  if (t.includes("nacion") || t.includes("federal")) return "nacion";
  if (t.includes("corrientes")) return "corrientes";
  if (
    t.includes("pba") ||
    t.includes("buenos aires") ||
    t.includes("provincia")
  )
    return "pba";
  return null;
}

function extraerPorcentajeIncapacidad(
  texto: string,
  etiquetas: string[],
): number | "missing" | "invalid" {
  for (const etiqueta of etiquetas) {
    const re = new RegExp(etiqueta + "\\D{0,25}?(-?\\d+[.,]?\\d*)", "i");
    const m = texto.match(re);
    if (m) {
      return procesarPorcentaje(m[1]);
    }
  }
  return "missing";
}

function procesarPorcentaje(valorRaw: string): number | "invalid" {
  let numStr = valorRaw.trim();
  const sepMatch = numStr.match(/[.,]/);
  if (sepMatch) {
    const parts = numStr.split(/[.,]/);
    if (parts[1].length > 2) return "invalid";
  }
  numStr = numStr.replace(",", ".");
  const n = Number(numStr);
  if (Number.isFinite(n)) {
    if (n > 0 && n <= 100) return n;
    return "invalid";
  }
  return "invalid";
}

function extraerMontoIngreso(
  texto: string,
  etiquetas: string[],
): number | "missing" | "invalid" {
  for (const etiqueta of etiquetas) {
    const re = new RegExp(etiqueta + "\\D{0,25}?(\\$?\\s*\\d+[\\d.,]*)", "i");
    const m = texto.match(re);
    if (m) {
      return procesarMonto(m[1]);
    }
  }
  return "missing";
}

function procesarMonto(valorRaw: string): number | "invalid" {
  let numStr = valorRaw.replace(/\$/g, "").trim();
  numStr = numStr.replace(/\./g, "").replace(",", ".");
  const n = Number(numStr);
  if (Number.isFinite(n) && n > 0) return n;
  return "invalid";
}

function extraerEdad(
  texto: string,
  etiquetas: string[],
): number | "missing" | "invalid" {
  for (const etiqueta of etiquetas) {
    const re = new RegExp(etiqueta + "\\D{0,25}?(\\d+)", "i");
    const m = texto.match(re);
    if (m) {
      return procesarEdad(m[1]);
    }
  }
  const mAños = texto.match(/(\d{2})\s*años/);
  if (mAños) {
    return procesarEdad(mAños[1]);
  }
  return "missing";
}

function procesarEdad(valorRaw: string): number | "invalid" {
  const n = Number(valorRaw);
  if (Number.isFinite(n) && n >= 16 && n <= 99) return n;
  return "invalid";
}

function detectarDatosLiquidacion(mensajes: string[]): {
  ingresoMensual: number | "missing" | "invalid";
  edad: number | "missing" | "invalid";
  incapacidad: number | "missing" | "invalid";
  metodo: string | "ninguno" | "ambos";
} {
  let ingresoMensual: number | "missing" | "invalid" = "missing";
  let incapacidad: number | "missing" | "invalid" = "missing";
  let edad: number | "missing" | "invalid" = "missing";
  let metodo = "ninguno";

  for (const t of mensajes) {
    const tLow = t.toLowerCase();

    let expectedField = "";
    if (
      metodo !== "ninguno" &&
      metodo !== "ambos" &&
      ingresoMensual !== "missing" &&
      ingresoMensual !== "invalid" &&
      edad !== "missing" &&
      edad !== "invalid"
    ) {
      expectedField = "incapacidad";
    } else if (
      metodo !== "ninguno" &&
      metodo !== "ambos" &&
      ingresoMensual !== "missing" &&
      ingresoMensual !== "invalid"
    ) {
      expectedField = "edad";
    } else if (metodo !== "ninguno" && metodo !== "ambos") {
      expectedField = "ingresoMensual";
    } else {
      expectedField = "metodo";
    }

    const vIngreso = extraerMontoIngreso(tLow, [
      "ingreso mensual",
      "ingreso",
      "sueldo",
      "salario",
      "remuneraci[oó]n",
      "haber",
    ]);
    const vIncapacidad = extraerPorcentajeIncapacidad(tLow, ["incapacidad"]);
    const vEdad = extraerEdad(tLow, ["edad"]);

    let vMetodo = "ninguno";
    const hasVuoto = /vuoto/.test(tLow);
    const hasMendez = /m[eé]ndez/.test(tLow);
    const hasLasHeras = /las heras/.test(tLow);
    if (hasLasHeras) vMetodo = "las_heras";
    else if (hasVuoto && hasMendez) vMetodo = "ambos";
    else if (hasVuoto) vMetodo = "vuoto";
    else if (hasMendez) vMetodo = "mendez";

    if (vMetodo !== "ninguno") metodo = vMetodo;
    if (vIngreso !== "missing") ingresoMensual = vIngreso;
    if (vIncapacidad !== "missing") incapacidad = vIncapacidad;
    if (vEdad !== "missing") edad = vEdad;

    if (
      expectedField === "incapacidad" &&
      (incapacidad === "missing" || incapacidad === "invalid")
    ) {
      const mSolo = tLow.match(/(-?\d+[.,]?\d*)\s*%/);
      if (mSolo) incapacidad = procesarPorcentaje(mSolo[1]);
    } else if (
      expectedField === "edad" &&
      (edad === "missing" || edad === "invalid")
    ) {
      const mSolo = tLow.match(/^\s*(\d{2})\s*$/);
      if (mSolo) edad = procesarEdad(mSolo[1]);
    } else if (
      expectedField === "ingresoMensual" &&
      (ingresoMensual === "missing" || ingresoMensual === "invalid")
    ) {
      const mSolo = tLow.match(/\$\s*(\d+[\d.,]*)/);
      if (mSolo) ingresoMensual = procesarMonto(mSolo[1]);
    }
  }
  return { ingresoMensual, edad, incapacidad, metodo };
}

function detectarFechaHecho(texto: string): string | null {
  const hoy = new Date().toISOString().slice(0, 10);
  const candidatos: string[] = [];
  const gatillo =
    "(?:ocurri[óo]|ocurrid[oa]|acaeci[óo]|acaecid[oa]|sucedi[óo]|acontecid[oa]|se\\s+produjo|tuvo\\s+lugar|hecho|siniestro|accidente|mora)\\s+(?:el\\s+|del\\s+|d[ií]a\\s+)?";
  const reNum = new RegExp(
    gatillo + "(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})",
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = reNum.exec(texto))) {
    const iso = validarFechaReal(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso && iso <= hoy) candidatos.push(iso);
  }
  const reIso = new RegExp(gatillo + "(\\d{4})-(\\d{2})-(\\d{2})", "gi");
  while ((m = reIso.exec(texto))) {
    const iso = validarFechaReal(Number(m[3]), Number(m[2]), Number(m[1]));
    if (iso && iso <= hoy) candidatos.push(iso);
  }
  const reTxt = new RegExp(
    gatillo + "(\\d{1,2})\\s+de\\s+([a-záéíóú]+)\\s+de\\s+(\\d{4})",
    "gi",
  );
  while ((m = reTxt.exec(texto))) {
    const mo = MESES_MAP[normalizarParaIntencion(m[2])];
    if (mo) {
      const iso = validarFechaReal(Number(m[1]), Number(mo), Number(m[3]));
      if (iso && iso <= hoy) candidatos.push(iso);
    }
  }
  if (candidatos.length === 0) return null;
  candidatos.sort();
  return candidatos[0];
}

function detectarMontoJuicio(texto: string): number | null {
  if (
    !/(monto|reclam|indemniza|capital|demanda por|suma de|pesos|\$)/i.test(
      texto,
    )
  )
    return null;
  const matches = texto.match(/\$?\s*\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?/g) || [];
  const candidatos = matches
    .map((m) =>
      Number(
        m
          .replace(/\$/g, "")
          .replace(/\s/g, "")
          .replace(/\./g, "")
          .replace(",", "."),
      ),
    )
    .filter((n) => Number.isFinite(n) && n >= 10000);
  if (candidatos.length === 0) return null;
  return Math.max(...candidatos);
}

export async function responderAgenteLegajo(input: {
  industry: IndustryType;
  contextoLegajo: string;
  historial: MensajeChat[];
  pregunta: string;
  documentEvidenceState?:
    | "no_analyzed_documents"
    | "analyzed_without_usable_context"
    | "usable_context";
}): Promise<
  | {
      ok: false;
      motivo:
        | "sin_api_key"
        | "error"
        | "invalid_request"
        | "rate_limit"
        | "invalid_response";
    }
  | { ok: true; respuesta: string; acciones: AccionPropuesta[]; model: string }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, motivo: "sin_api_key" };
  // gemini-2.5-flash es el modelo confirmado disponible con esta API key.
  const modelo = "gemini-2.5-flash";
  let modeloActual = modelo;
  const hoy = new Date().toISOString().slice(0, 10);
  const estados = getCaseStatuses(input.industry);
  const estadosTexto = estados
    .map((e) => `"${e.value}" (${e.label})`)
    .join(", ");
  const estadosValores = estados.map((e) => e.value);

  const pNorm = normalizarParaIntencion(input.pregunta);
  const intencionRiesgo =
    /(inconsistencia|riesgo|peligro)\b.*?(procesal|documento|legajo)/i.test(
      pNorm,
    );

  const systemInstruction = [
    getAgentPersona(input.industry),
    "",
    REGLAS,
    "",
    reglasAcciones(hoy, estadosTexto),
    "",
    intencionRiesgo
      ? 'REGLAS PARA ANÁLISIS DE RIESGO:\n- Esta es una consulta exclusivamente informativa y de lectura. Analizá la evidencia documental disponible. No generes acciones ni tarjetas. No propongas mutaciones. Devuelve siempre acciones como un arreglo vacío.\n- Diferenciá hechos, posibles riesgos y datos faltantes.\n- Identificá el documento o fragmento que sustenta cada observación.\n- No declares ausencia total de riesgos como certeza profesional.\n- Si detectás una inconsistencia o riesgo, iniciá tu respuesta con una frase como: "Detecté las siguientes inconsistencias o puntos que requieren revisión..."\n- Si no detectás inconsistencias, respondé: "No detecté inconsistencias con la evidencia documental disponible. Esta revisión es orientativa y no reemplaza el control profesional integral."\n- Si faltan datos, respondé: "No hay evidencia suficiente para concluir sobre los siguientes puntos..."'
      : "",
    "",
    "CONTEXTO DEL LEGAJO:",
    input.contextoLegajo || "(sin información cargada)",
  ]
    .filter(Boolean)
    .join("\n");

  const contents = [
    ...input.historial.map((m) => ({
      role: m.rol,
      parts: [{ text: m.texto }],
    })),
    { role: "user" as const, parts: [{ text: input.pregunta }] },
  ];

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          respuesta: { type: "STRING" },
          acciones: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                tipo: { type: "STRING" },
                titulo: { type: "STRING" },
                fecha: { type: "STRING" },
                hora: { type: "STRING" },
                estado: { type: "STRING" },
                itemChecklist: { type: "STRING" },
                documento: { type: "STRING" },
                metodo: { type: "STRING" },
                ingresoMensual: { type: "NUMBER" },
                edad: { type: "NUMBER" },
                incapacidad: { type: "NUMBER" },
                fechaHecho: { type: "STRING" },
                fechaNotificacion: { type: "STRING" },
                diasHabiles: { type: "NUMBER" },
                kmDistancia: { type: "NUMBER" },
                jurisdiccion: { type: "STRING" },
                monto: { type: "NUMBER" },
                motivo: { type: "STRING" },
              },
              required: ["tipo", "titulo", "motivo"],
            },
          },
        },
        required: ["respuesta"],
      },
    },
  });

  const esLegalLaboral = input.industry === "legal";

  // === RUTAS DETERMINÍSTICAS PRE-MODELO ===

  const matchUnidadLegal =
    /(\buma\b|u\.m\.a\.|unidad de medida arancelaria|\buhom\b|unidad de honorarios de mediaci[oó]n|\bjus\b|jus arancelario|jus pba|jus corrientes)/i.test(
      pNorm,
    );
  const matchIntencionMonetaria =
    /(valor|importe|monto|cu[aá]nto\s+vale|vigente|actual|hoy|calcul[aá]|multiplic[aá]|convert[ií]|equivalencia|\d+\s*(uma|u\.m\.a\.|uhom|jus)|honorarios\s+en\s+(uma|u\.m\.a\.|uhom|jus))/i.test(
      pNorm,
    );

  if (matchUnidadLegal && matchIntencionMonetaria) {
    return {
      ok: true,
      respuesta:
        "No informo ni calculo automáticamente valores monetarios de UMA, UHOM o JUS desde el Agente, porque dependen de la jurisdicción, la fecha de vigencia y una fuente oficial verificable. Consultá la sección Calculadoras, verificá el valor en la fuente oficial correspondiente y revisalo profesionalmente. No generé un cálculo.",
      acciones: [],
      model: `agente-${modeloActual}`,
    };
  }

  if (
    /(730|honorarios|costas)/i.test(pNorm) &&
    /(calcul|estim|tope|monto|cuanto|25%|aplica)/i.test(pNorm)
  ) {
    return {
      ok: true,
      respuesta:
        "No calculo automáticamente el límite de responsabilidad por costas ni honorarios. El artículo 730 CCyCN requiere analizar la sentencia, las costas, las regulaciones y los profesionales comprendidos. No generé un cálculo.",
      acciones: [],
      model: `agente-${modeloActual}`,
    };
  }

  if (/(las heras)/i.test(pNorm)) {
    return {
      ok: true,
      respuesta:
        "El método Las Heras no está implementado ni validado en Centinela IA. No generé un cálculo. Actualmente solo están disponibles Vuoto y Méndez como estimaciones orientativas.",
      acciones: [],
      model: `agente-${modeloActual}`,
    };
  }

  if (intencionRiesgo) {
    if (
      !input.documentEvidenceState ||
      input.documentEvidenceState === "no_analyzed_documents"
    ) {
      return {
        ok: true,
        respuesta:
          "No hay documentos analizados suficientes para evaluar inconsistencias o riesgos. Analizá al menos un documento del expediente y volvé a intentarlo.",
        acciones: [],
        model: `agente-${modeloActual}`,
      };
    }
    if (input.documentEvidenceState === "analyzed_without_usable_context") {
      return {
        ok: true,
        respuesta:
          "Hay documentos procesados, pero no encontré contenido suficiente para evaluar inconsistencias o riesgos. Revisá el estado del análisis documental e intentá nuevamente.",
        acciones: [],
        model: `agente-${modeloActual}`,
      };
    }
  }
  if (esLegalLaboral) {
    const normalizarConfirmacion = (txt: string) =>
      txt
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const esConfirmacionAislada =
      /^(si|si confirmo|confirmo|correcto|de acuerdo|adelante|ok)$/i.test(
        normalizarConfirmacion(input.pregunta),
      ) ||
      /^(si confirmo que es una pretension pecuniaria general|confirmo que no identifico un regimen especial ni una exencion)/i.test(
        normalizarConfirmacion(input.pregunta),
      );

    const intencionIntereses =
      /(interes|intereses|moratorio|tasa activa|tasa pasiva|bna|banco nacion|actualizacion de capital)/i.test(
        pNorm,
      );
    if (intencionIntereses) {
      return {
        ok: true,
        respuesta:
          "No puedo calcular intereses históricos automáticamente porque requieren jurisdicción, fuero, criterio aplicable y una serie de tasas verificada para cada período. No generé un cálculo.",
        acciones: [],
        model: `agente-${modeloActual}`,
      };
    }

    let lastLiqIntentIdx = -1;
    for (let i = input.historial.length - 1; i >= 0; i--) {
      if (
        input.historial[i].rol === "user" &&
        /(calcula|calculame|calcular|estima)\b.*?(liquidacion|indemnizacion|incapacidad)|mendez|vuoto/i.test(
          normalizarParaIntencion(input.historial[i].texto),
        )
      ) {
        lastLiqIntentIdx = i;
        break;
      }
    }
    if (
      /(calcula|calculame|calcular|estima)\b.*?(liquidacion|indemnizacion|incapacidad)|mendez|vuoto/i.test(
        pNorm,
      )
    ) {
      lastLiqIntentIdx = input.historial.length;
    }

    let isLiqFlow = false;
    let combinedLiqText = "";
    if (lastLiqIntentIdx !== -1) {
      let interrupcion = false;
      for (let i = lastLiqIntentIdx + 1; i < input.historial.length; i++) {
        const msgNorm = normalizarParaIntencion(input.historial[i].texto);
        if (
          input.historial[i].rol === "user" &&
          /(tasa de justicia|tasa judicial|plazo|vencimiento|dias habiles|fecha procesal)/i.test(
            msgNorm,
          )
        ) {
          interrupcion = true;
          break;
        }
      }
      if (
        lastLiqIntentIdx !== input.historial.length &&
        /(tasa de justicia|tasa judicial|plazo|vencimiento|dias habiles|fecha procesal)/i.test(
          pNorm,
        )
      ) {
        interrupcion = true;
      }

      if (!interrupcion) {
        isLiqFlow = true;
        const userMsgs = [];
        for (let i = lastLiqIntentIdx; i < input.historial.length; i++) {
          if (input.historial[i].rol === "user")
            userMsgs.push(input.historial[i].texto);
        }
        userMsgs.push(input.pregunta);

        const combinedLiqText = userMsgs.join("\n");
        const reversedUserMsgs = [...userMsgs].reverse();

        if (/(las heras)/i.test(combinedLiqText)) {
          return {
            ok: true,
            respuesta:
              "El método Las Heras no está implementado ni validado en Centinela IA. No generé un cálculo. Actualmente solo están disponibles Vuoto y Méndez como estimaciones orientativas.",
            acciones: [],
            model: `agente-${modeloActual}`,
          };
        }
        const hasVuoto = /vuoto/i.test(combinedLiqText);
        const hasMendez = /m[eé]ndez/i.test(combinedLiqText);
        if (hasVuoto && hasMendez) {
          return {
            ok: true,
            respuesta:
              "Indicame un único método para la estimación orientativa: Vuoto o Méndez.",
            acciones: [],
            model: `agente-${modeloActual}`,
          };
        } else if (!hasVuoto && !hasMendez) {
          return {
            ok: true,
            respuesta:
              "¿Qué método querés utilizar para la estimación orientativa: Vuoto o Méndez?",
            acciones: [],
            model: `agente-${modeloActual}`,
          };
        }

        const datosLiq = detectarDatosLiquidacion(userMsgs);
        if (datosLiq.incapacidad === "invalid") {
          return {
            ok: true,
            respuesta:
              "El porcentaje de incapacidad debe estar entre 0 y 100. No generé un cálculo.",
            acciones: [],
            model: `agente-${modeloActual}`,
          };
        }
        if (datosLiq.ingresoMensual === "invalid") {
          return {
            ok: true,
            respuesta:
              "El ingreso mensual ingresado no es válido. No generé un cálculo.",
            acciones: [],
            model: `agente-${modeloActual}`,
          };
        }
        if (datosLiq.edad === "invalid") {
          return {
            ok: true,
            respuesta: "La edad ingresada no es válida. No generé un cálculo.",
            acciones: [],
            model: `agente-${modeloActual}`,
          };
        }
        if (datosLiq.ingresoMensual === "missing") {
          return {
            ok: true,
            respuesta: "¿Cuál es el ingreso mensual para realizar el cálculo?",
            acciones: [],
            model: `agente-${modeloActual}`,
          };
        }
        if (datosLiq.edad === "missing") {
          return {
            ok: true,
            respuesta: "¿Cuál es la edad del trabajador al momento del hecho?",
            acciones: [],
            model: `agente-${modeloActual}`,
          };
        }
        if (datosLiq.incapacidad === "missing") {
          return {
            ok: true,
            respuesta:
              "¿Cuál es el porcentaje de incapacidad para realizar el cálculo?",
            acciones: [],
            model: `agente-${modeloActual}`,
          };
        }

        const fechaHecho = detectarFechaHecho(combinedLiqText);
        const metodoOk = hasVuoto ? "vuoto" : "mendez";
        return {
          ok: true,
          respuesta:
            "Preparé la propuesta de liquidación estimada (solo capital, sin intereses históricos) para que la apruebes.",
          acciones: [
            {
              tipo: "calcular_liquidacion",
              titulo: "Calcular liquidación estimada (solo capital)",
              metodo: metodoOk,
              ingresoMensual: datosLiq.ingresoMensual as number,
              edad: datosLiq.edad as number,
              incapacidad: datosLiq.incapacidad as number,
              fechaHecho: fechaHecho ?? undefined,
              motivo: "Detecté los datos necesarios en la conversación.",
            },
          ],
          model: `agente-${modeloActual}`,
        };
      }
    }

    const mencionaTasaJusticia =
      /(tasa de justicia|tasa judicial|tasa del proceso)/i.test(pNorm);
    let lastFeeIntentIdx = -1;
    for (let i = input.historial.length - 1; i >= 0; i--) {
      if (
        input.historial[i].rol === "user" &&
        /(tasa de justicia|tasa judicial|tasa del proceso)/i.test(
          normalizarParaIntencion(input.historial[i].texto),
        )
      ) {
        lastFeeIntentIdx = i;
        break;
      }
    }
    if (mencionaTasaJusticia) {
      lastFeeIntentIdx = input.historial.length;
    }

    let isFeeFlow = false;
    let pendingFeeState: any = null;

    if (lastFeeIntentIdx !== -1) {
      let interrupcion = false;
      for (let i = lastFeeIntentIdx + 1; i < input.historial.length; i++) {
        const msgNorm = normalizarParaIntencion(input.historial[i].texto);
        if (
          input.historial[i].rol === "user" &&
          /(calcula|calculame|calcular|estima)\b.*?(plazo|vencimiento|dias habiles|fecha procesal|liquidacion|indemnizacion|incapacidad)|mendez|vuoto/i.test(
            msgNorm,
          )
        ) {
          interrupcion = true;
          break;
        }
      }
      if (
        lastFeeIntentIdx !== input.historial.length &&
        /(calcula|calculame|calcular|estima)\b.*?(plazo|vencimiento|dias habiles|fecha procesal|liquidacion|indemnizacion|incapacidad)|mendez|vuoto/i.test(
          pNorm,
        )
      ) {
        interrupcion = true;
      }

      if (!interrupcion) {
        isFeeFlow = true;
        pendingFeeState = { intent: "justice_fee" };
        const userMsgs = [];
        for (let i = lastFeeIntentIdx; i < input.historial.length; i++) {
          if (input.historial[i].rol === "user")
            userMsgs.push(input.historial[i].texto);
        }
        userMsgs.push(input.pregunta);

        const combinedUserText = userMsgs.join(" ");

        pendingFeeState.jurisdiction = detectarJurisdiccion(combinedUserText);
        pendingFeeState.amount =
          detectarMontoJuicio(combinedUserText) ?? undefined;

        const tLocalGlobal = normalizarParaIntencion(combinedUserText);
        if (/(usd|u\$s|dolar|dólar)/i.test(tLocalGlobal)) {
          pendingFeeState.currency = "USD";
        } else if (pendingFeeState.amount && pendingFeeState.amount > 0) {
          pendingFeeState.currency = "ARS";
        }

        for (const msg of userMsgs) {
          const tClean = normalizarParaIntencion(msg).replace(
            /regimen especial/g,
            "",
          );
          if (/(sucesion|sucesorio|declaratoria de herederos)/i.test(tClean)) {
            pendingFeeState.caseType = "succession";
            break;
          }
          if (
            /(laboral|trabajo|despido|art|empleador|trabajador)/i.test(tClean)
          ) {
            pendingFeeState.caseType = "employment";
            break;
          }
          if (/(familia|divorcio|alimento|regimen|visita)/i.test(tClean)) {
            pendingFeeState.caseType = "family";
            break;
          }
          if (/(indeterminado|sin monto|sin contenido)/i.test(tClean)) {
            pendingFeeState.caseType = "indeterminate";
            break;
          }
          if (/(concurso|quiebra)/i.test(tClean)) {
            pendingFeeState.caseType = "insolvency";
            break;
          }
          if (/(mensura|deslinde)/i.test(tClean)) {
            pendingFeeState.caseType = "survey_boundary";
            break;
          }
          if (/(terceria)/i.test(tClean)) {
            pendingFeeState.caseType = "third_party_claim";
            break;
          }
          if (/(amparo)/i.test(tClean)) {
            pendingFeeState.caseType = "amparo";
            break;
          }
          if (/(beneficio de litigar sin gastos|blsg)/i.test(tClean)) {
            pendingFeeState.caseType = "legal_aid";
            break;
          }
          if (
            /(civil|comercial|general|ordinario|ejecutivo|danos|pecuniario)/i.test(
              tClean,
            )
          ) {
            pendingFeeState.caseType = "general_pecuniary";
            break;
          }
        }

        if (
          /(si|sí|confirmo|correcto|ausencia|no hay regimen|no identifico|acepto|de acuerdo|adelante|ok)/i.test(
            pNorm,
          )
        ) {
          pendingFeeState.confirmedGeneral = true;
        }
      }
    }

    if (esConfirmacionAislada && !isFeeFlow) {
      return {
        ok: true,
        respuesta:
          "No tengo una propuesta de tasa pendiente para confirmar. Indicame qué cálculo querés realizar.",
        acciones: [],
        model: `agente-${modeloActual}`,
      };
    }

    if (isFeeFlow && pendingFeeState) {
      let respuesta = "";
      let acciones: AccionPropuesta[] = [];
      if (!pendingFeeState.jurisdiction) {
        respuesta =
          "¿Qué jurisdicción corresponde: Justicia Nacional/Federal, Provincia de Buenos Aires o Provincia de Corrientes?";
      } else if (pendingFeeState.jurisdiction === "pba") {
        respuesta =
          "El cálculo de tasa de justicia para Provincia de Buenos Aires todavía no tiene cobertura verificada en Centinela IA. No generé una propuesta.";
      } else if (pendingFeeState.jurisdiction === "corrientes") {
        respuesta =
          "El cálculo de tasa de justicia para Provincia de Corrientes todavía no tiene cobertura verificada en Centinela IA. No generé una propuesta.";
      } else if (!pendingFeeState.caseType) {
        respuesta =
          "¿Qué tipo de proceso es: civil/comercial con monto determinado, sucesión, laboral, familia, monto indeterminado, concurso u otro?";
      } else if (pendingFeeState.caseType === "succession") {
        respuesta =
          "La Ley 23.898 contempla una tasa reducida y reglas específicas sobre la base sucesoria. Esta cobertura todavía no está implementada. No generé un cálculo.";
      } else if (pendingFeeState.caseType === "employment") {
        respuesta =
          "Los trabajadores y causahabientes pueden estar exentos según el artículo 13 de la Ley 23.898, dependiendo del carácter de la parte y del origen del proceso. Requiere revisión profesional. No generé un cálculo.";
      } else if (pendingFeeState.caseType === "family") {
        respuesta =
          "Determinadas actuaciones de familia están exentas y otras pueden tener contenido patrimonial. Requiere revisión profesional. No generé un cálculo.";
      } else if (pendingFeeState.caseType === "indeterminate") {
        respuesta =
          "Los procesos de monto indeterminado o sin contenido pecuniario aplican reglas y montos fijos específicos. Esta cobertura todavía no está implementada.";
      } else if (pendingFeeState.caseType === "insolvency") {
        respuesta =
          "Los procesos concursales tienen una tasa especial. Esta cobertura todavía no está implementada.";
      } else if (
        [
          "survey_boundary",
          "third_party_claim",
          "amparo",
          "legal_aid",
          "other",
        ].includes(pendingFeeState.caseType)
      ) {
        respuesta =
          "La Ley 23.898 contempla una solución especial o exención. Esta cobertura todavía no está implementada.";
      } else if (pendingFeeState.currency === "USD") {
        respuesta =
          "Para moneda extranjera, por favor proporcioná la base imponible convertida a pesos (ARS). Sujeto a revisión profesional. No generé un cálculo.";
      } else if (!pendingFeeState.amount || pendingFeeState.amount <= 0) {
        respuesta =
          "¿De qué monto es el proceso para calcular la tasa de justicia?";
      } else if (!pendingFeeState.confirmedGeneral) {
        respuesta =
          "Antes de preparar el cálculo, confirmá que se trata de una pretensión pecuniaria general y que no identificás un régimen especial ni una exención.";
      } else {
        const montoFormat = new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
          maximumFractionDigits: 0,
        }).format(pendingFeeState.amount);
        const tasaFormat = new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
          maximumFractionDigits: 0,
        }).format(pendingFeeState.amount * 0.03);

        acciones.push({
          tipo: "calcular_tasa_justicia",
          titulo: "Tasa de justicia nacional (3%)",
          monto: pendingFeeState.amount,
          jurisdiccion: "nacion",
          tipo_proceso: "general_pecuniary",
          confirmacion: true,
          motivo: `Base imponible: ${montoFormat}\nAlícuota: 3%\nResultado propuesto: ${tasaFormat}\nNormativa: Ley 23.898, art. 2\nCarácter orientativo. Sujeto a revisión profesional.`,
        });
        respuesta =
          "Preparé la propuesta de cálculo de la tasa de justicia nacional para que la revises antes de aprobar.";
      }

      return { ok: true, respuesta, acciones, model: `agente-${modeloActual}` };
    }

    if (mencionaTasaJusticia && !isFeeFlow) {
      return {
        ok: true,
        respuesta:
          "Identifiqué una consulta sobre tasa de justicia, pero faltan datos o la intención fue interrumpida. Por favor, indicá la jurisdicción, el monto y confirmá que es un proceso ordinario para poder calcularla.",
        acciones: [],
        model: `agente-${modeloActual}`,
      };
    }

    const intencionPlazo =
      /(calcula|calculame|calcular|saca|cuando|conta|determina)\b.*?(plazo|vencimiento|dias habiles|fecha procesal)/i.test(
        pNorm,
      );
    let esContinuacionPlazo = false;
    let jurisCont = "";
    if (input.historial.length >= 2) {
      const lastAgent = input.historial[input.historial.length - 1];
      const lastUser = input.historial[input.historial.length - 2];
      const lastAgentNorm = normalizarParaIntencion(lastAgent.texto);
      const lastUserNorm = normalizarParaIntencion(lastUser.texto);
      if (
        lastAgent.rol === "model" &&
        lastAgentNorm.includes(
          "que jurisdiccion corresponde: justicia nacional/federal, provincia de buenos aires o provincia de corrientes",
        ) &&
        lastUser.rol === "user"
      ) {
        const j = detectarJurisdiccion(pNorm);
        if (j) {
          if (
            /(calcula|calculame|calcular|saca|cuando|conta|determina)\b.*?(plazo|vencimiento|dias habiles|fecha procesal)/i.test(
              lastUserNorm,
            )
          ) {
            jurisCont = j;
            esContinuacionPlazo = true;
          }
        }
      }
    }

    if (intencionPlazo || esContinuacionPlazo) {
      let respuesta = "";
      let acciones: AccionPropuesta[] = [];
      let textoDatos = input.pregunta;
      if (esContinuacionPlazo) {
        textoDatos =
          input.historial[input.historial.length - 2].texto +
          " " +
          input.pregunta;
      }

      let jurisdiccion = detectarJurisdiccion(input.pregunta);
      if (!jurisdiccion && esContinuacionPlazo) {
        jurisdiccion = jurisCont as any;
      }

      if (!jurisdiccion) {
        respuesta =
          "¿Qué jurisdicción corresponde: Justicia Nacional/Federal, Provincia de Buenos Aires o Provincia de Corrientes?";
      } else {
        const fecha = extraerFechaGenerica(textoDatos);
        const dias = extraerDiasPlazo(textoDatos);
        const km = extraerKmDistancia(textoDatos);

        if (!fecha && !dias) {
          respuesta =
            "¿Desde qué fecha y por cuántos días hábiles querés calcular el plazo?";
        } else if (!fecha) {
          respuesta = "¿Desde qué fecha querés calcular el plazo?";
        } else if (!dias) {
          respuesta = "¿Por cuántos días hábiles querés calcular el plazo?";
        } else {
          acciones.push({
            tipo: "calcular_plazo_procesal",
            titulo: "Calcular vencimiento del plazo procesal",
            fechaNotificacion: fecha,
            diasHabiles: dias,
            jurisdiccion: jurisdiccion,
            kmDistancia: km,
            motivo: "Detecté datos de plazo en la conversación.",
          });
          respuesta =
            "Preparé la propuesta de cálculo del plazo para que la apruebes.";
        }
      }
      return { ok: true, respuesta, acciones, model: `agente-${modeloActual}` };
    }
  }

  // Reintenta ante errores transitorios de Gemini (sobrecarga 429 / 5xx).
  for (let intento = 0; intento < 3; intento++) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modeloActual}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        },
      );

      if (resp.ok) {
        const data = await resp.json();
        const raw: string =
          data?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text ?? "")
            .join("") ?? "";
        if (raw.trim()) {
          let respuesta = "";
          let acciones: AccionPropuesta[] = [];
          try {
            const parsed = JSON.parse(limpiarJson(raw));
            respuesta =
              typeof parsed?.respuesta === "string" && parsed.respuesta.trim()
                ? parsed.respuesta.trim()
                : salvarRespuesta(raw);
            acciones = validarAcciones(
              parsed?.acciones,
              input.industry,
              estadosValores,
            );
          } catch {
            // JSON cortado o inválido: rescatamos el texto y SEGUIMOS con las redes de seguridad.
            respuesta = salvarRespuesta(raw);
            acciones = [];
          }

          if (!respuesta) {
            return { ok: false, motivo: "invalid_response" };
          }

          // Filtro estricto post-modelo (para evitar alucinaciones)
          if (
            !/(agenda|agendame|agendar|carga|registra|registralo|recordame)\b.*?(vencimiento|agenda|fecha)/i.test(
              normalizarParaIntencion(input.pregunta),
            )
          ) {
            acciones = acciones.filter((a) => a.tipo !== "agendar_plazo");
          }
          // Plazo y Tasa son 100% determinísticos pre-modelo, el LLM no debe generarlos.
          acciones = acciones.filter(
            (a) =>
              a.tipo !== "calcular_plazo_procesal" &&
              a.tipo !== "calcular_tasa_justicia",
          );

          const allText = [
            input.contextoLegajo || "",
            ...input.historial.map((m) => m.texto),
            input.pregunta,
          ].join("\n");
          const pNorm = normalizarParaIntencion(input.pregunta);

          if (input.industry === "legal") {
            if (
              /(agenda|agendame|agendar|carga|registra|registralo|recordame)\b.*?(vencimiento|agenda|fecha)/i.test(
                pNorm,
              )
            ) {
              const fecha = extraerFechaGenerica(input.pregunta);
              if (fecha) {
                if (!acciones.some((a) => a.tipo === "agendar_plazo")) {
                  acciones.push({
                    tipo: "agendar_plazo",
                    titulo: "Agendar vencimiento",
                    fecha,
                    motivo: "Detecté solicitud de agendar plazo.",
                  });
                } else {
                  const act = acciones.find((a) => a.tipo === "agendar_plazo")!;
                  act.fecha = fecha;
                }
              }
            }
          }

          if (acciones.some((a) => a.tipo === "calcular_liquidacion")) {
            respuesta =
              "Preparé la propuesta de liquidación estimada (solo capital, sin intereses históricos) para que la apruebes.";
          } else if (acciones.some((a) => a.tipo === "agendar_plazo")) {
            respuesta =
              "Preparé la propuesta para agendar el vencimiento. Revisala antes de aprobar.";
          }

          if (intencionRiesgo) {
            acciones = [];
          }

          return {
            ok: true,
            respuesta,
            acciones,
            model: `agente-${modeloActual}`,
          };
        }
      } else if (
        resp.status === 429 ||
        resp.status === 404 ||
        resp.status >= 500
      ) {
        console.error("Agente Gemini transitorio:", modeloActual, resp.status);
        // Si el modelo principal falla (404) o se queda sin cupo (429), probamos otro modelo.
        if (intento >= 1 && modeloActual !== "gemini-2.0-flash") {
          modeloActual = "gemini-2.0-flash";
        }
        // Respetamos el tiempo de espera que sugiere Gemini, si lo manda.
        const ra = Number(resp.headers.get("retry-after"));
        const espera =
          Number.isFinite(ra) && ra > 0
            ? Math.min(ra * 1000, 20000)
            : Math.min(6000, 1500 * 2 ** intento) + Math.random() * 400;
        await new Promise((r) => setTimeout(r, espera));
        continue;
      } else {
        console.error("Agente Gemini error:", resp.status, await resp.text());
        if (resp.status === 400)
          return { ok: false, motivo: "invalid_request" };
        return { ok: false, motivo: "error" };
      }
    } catch (e) {
      console.error("Agente error de red:", e);
    }
    await new Promise((r) =>
      setTimeout(r, Math.min(8000, 700 * 2 ** intento) + Math.random() * 400),
    );
  }

  return { ok: false, motivo: "rate_limit" };
}
