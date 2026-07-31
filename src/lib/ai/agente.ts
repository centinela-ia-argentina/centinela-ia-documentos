import 'server-only';
import type { IndustryType } from '@/lib/industries/documentTypes';
import { getCaseStatuses } from '@/lib/industries/caseConfig';

export type MensajeChat = { rol: 'user' | 'model'; texto: string };

// Acciones que el agente puede proponer para que el humano apruebe.
export type AccionPropuesta = {
  tipo:
    | 'agendar_plazo'
    | 'crear_actuacion'
    | 'agregar_checklist'
    | 'generar_resumen'
    | 'generar_cotejo'
    | 'redactar_borrador'
    | 'analizar_uif'
    | 'cambiar_estado'
    | 'vincular_documento'
    | 'agendar_turno'
    | 'agendar_firma'
    | 'sugerir_modelo'
    | 'redactar_ros'
    | 'calcular_liquidacion'
    | 'calcular_plazo_procesal'
    | 'calcular_tasa_justicia'
    | 'redactar_aviso'
    | 'calificar_inquilino';
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
  diasHabiles?: number;        // solo calcular_plazo_procesal
  fechaNotificacion?: string;  // solo calcular_plazo_procesal (YYYY-MM-DD)
  kmDistancia?: number;        // solo calcular_plazo_procesal (opcional, art. 158)
  jurisdiccion?: 'nacion' | 'corrientes' | 'pba'; // solo calcular_plazo_procesal
  monto?: number; // solo calcular_tasa_justicia
  alquilerMensual?: number | null; // solo calificar_inquilino
  moneda?: 'ARS' | 'USD'; // solo calificar_inquilino
  motivo: string;
};

const PERSONA_LEGAL = `Sos "Centinela", el agente jurídico de un estudio de abogados argentino, con el rol de un Secretario Letrado / Abogado Senior de Litigios. Trabajás sobre UN expediente concreto (contexto abajo). Sos un "halcón": buscás debilidades, plazos y riesgos procesales. Priorizás detectar inconsistencias temporales (prescripción, caducidad de instancia) y falta de personería. Prestá atención a: actor, demandado, objeto del juicio, monto reclamado, pruebas ofrecidas y plazos de caducidad. No te limites a resumir: cuando detectes un plazo o un riesgo, PROPONÉ el próximo paso concreto.`;

const PERSONA_ESCRIBANIA = `Sos "Centinela", el agente notarial de una escribanía argentina, con el rol de un Adscripto obsesionado con el control formal. Trabajás sobre UN legajo concreto (contexto abajo). Tu tono es neutral, técnico y preventivo: el escribano no pelea, PREVIENE. Priorizás la trazabilidad legal y las alertas. Prestá atención obligatoria a: nomenclatura catastral, matrícula / folio real, titulares dominiales actuales, gravámenes activos (embargos/hipotecas/inhibiciones) y vigencia exacta de los certificados. Tu función central es el COTEJO: cruzás los documentos del legajo y señalás discrepancias. Si los montos superan los umbrales de la UIF en Argentina, avisá que corresponde activar el checklist de prevención de lavado. IMPORTANTE sobre la MATRÍCULA (folio real) del inmueble: puede figurar con distintos rótulos o abreviaturas —por ejemplo "F.R.I.", "F.R.", "Folio Real", "Folio Real Informatizado", "Matrícula FR", "Matrícula N°"— seguidas de un número del estilo 12.345/7. Reconocé TODAS esas variantes como la matrícula del inmueble y NO las confundas con la nomenclatura o designación catastral. Si ese dato aparece en el contexto o en los fragmentos, informalo como la matrícula (citando el documento); no digas que "no está" solo porque el rótulo difiere.`;

const PERSONA_INMOBILIARIA = `Sos "Centinela", el agente inmobiliario de una inmobiliaria argentina, con el rol de un Broker / Martillero Público senior, enfocado en cerrar operaciones con resguardo documental. Trabajás sobre UNA operación/legajo concreta (contexto abajo). Hablás el idioma del negocio: captaciones, interesados/leads, reservas, boletos, seña y refuerzo, comisión, y plazos de escrituración o locativos. Prestá atención a: dirección y datos del inmueble (nomenclatura catastral, superficie), partes (comprador/vendedor o locador/locatario, garante, corredor), precio y moneda, seña/reserva y saldo, condiciones y PLAZO de escrituración, estado de ocupación y comisión. Tu función central es CONTROLAR LA COHERENCIA de la operación: cruzá reserva → boleto → título → escritura y señalá discrepancias (partes, inmueble, precio, superficie). Alertá sobre gravámenes/embargos/hipotecas, deudas (ABL/ARBA/expensas/servicios), inmueble ocupado, reservas u ofertas por vencer y plazos de escrituración próximos. Cuando el título o el cierre se acerquen, sugerí derivar a escribanía. Sos proactivo con las oportunidades y los próximos pasos: cuando corresponda, PROPONÉ la acción concreta (redactar el aviso comercial, redactar el borrador de reserva/boleto, agendar la firma o la visita, pedir el libre deuda, sumar un pendiente al checklist). Si el expediente parece una postulación de alquiler y hay documentos del postulante (recibo de sueldo, constancia de monotributo/ingresos, o datos de garantía/garante), proponé la acción calificar_inquilino para evaluar solvencia y garantías. Es una evaluación orientativa, no un dictamen. No la propongas en operaciones de compraventa.`;

function getAgentPersona(industry: IndustryType): string {
  if (industry === 'escribania') return PERSONA_ESCRIBANIA;
  if (industry === 'inmobiliaria') return PERSONA_INMOBILIARIA;
  return PERSONA_LEGAL;
}

const REGLAS = `REGLAS INQUEBRANTABLES:
- Basáte ÚNICAMENTE en el CONTEXTO DEL LEGAJO y en la conversación. NO inventes datos, montos, fechas, nombres ni artículos. (Calcular una liquidación con las fórmulas legales, a partir de datos reales del legajo o que te dio el usuario, NO es "inventar un monto": es una estimación válida que SÍ podés proponer.)
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
  if (s.startsWith('\`\`\`')) {
    s = s.replace(/^\`\`\`(?:json)?/i, '').replace(/\`\`\`$/, '').trim();
  }
  return s;
}

function validarAcciones(input: unknown, estadosValidos: string[] = []): AccionPropuesta[] {
  if (!Array.isArray(input)) return [];
  const TIPOS = ['agendar_plazo', 'crear_actuacion', 'agregar_checklist', 'generar_resumen', 'generar_cotejo', 'redactar_borrador', 'analizar_uif', 'cambiar_estado', 'vincular_documento', 'agendar_turno', 'agendar_firma', 'sugerir_modelo', 'redactar_ros', 'calcular_liquidacion', 'calcular_plazo_procesal', 'calcular_tasa_justicia', 'redactar_aviso', 'calificar_inquilino'];
  const CON_FECHA = ['agendar_plazo', 'crear_actuacion'];
  const CON_FECHA_HORA = ['agendar_turno', 'agendar_firma'];
  const out: AccionPropuesta[] = [];
  for (const a of input) {
    if (!a || typeof a !== 'object') continue;
    const o = a as Record<string, unknown>;
    const tipo = typeof o.tipo === 'string' ? o.tipo.trim() : '';
    const titulo = typeof o.titulo === 'string' ? o.titulo.trim() : '';
    const fecha = typeof o.fecha === 'string' ? o.fecha.trim() : '';
    const hora = typeof o.hora === 'string' ? o.hora.trim() : '';
    const estado = typeof o.estado === 'string' ? o.estado.trim() : '';
    const itemChecklist = typeof o.itemChecklist === 'string' ? o.itemChecklist.trim() : '';
    const documento = typeof o.documento === 'string' ? o.documento.trim() : '';
    const motivo = typeof o.motivo === 'string' ? o.motivo.trim() : '';
    if (!TIPOS.includes(tipo) || !titulo) continue;
    if (tipo === 'cambiar_estado') {
      if (!estado || (estadosValidos.length && !estadosValidos.includes(estado))) continue;
      out.push({ tipo: 'cambiar_estado', titulo, estado, motivo });
    } else if (tipo === 'vincular_documento') {
      if (!itemChecklist || !documento) continue;
      out.push({ tipo: 'vincular_documento', titulo, itemChecklist, documento, motivo });
    } else if (CON_FECHA_HORA.includes(tipo)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
      const horaOk = /^\d{2}:\d{2}$/.test(hora) ? hora : undefined;
      out.push({ tipo: tipo as AccionPropuesta['tipo'], titulo, fecha, hora: horaOk, motivo });
    } else if (CON_FECHA.includes(tipo)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
      out.push({ tipo: tipo as AccionPropuesta['tipo'], titulo, fecha, motivo });
    } else if (tipo === "calcular_liquidacion") {
      const metodo = o.metodo === "vuoto" ? "vuoto" : "mendez"
      const ingresoMensual = Number(o.ingresoMensual)
      const edad = Number(o.edad)
      const incapacidad = Number(o.incapacidad)
      let fechaHecho: string | undefined;
      if (typeof o.fechaHecho === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.fechaHecho.trim())) {
        fechaHecho = o.fechaHecho.trim();
      }
      if (!Number.isFinite(ingresoMensual) || ingresoMensual <= 0) continue
      if (!Number.isFinite(edad) || edad <= 0) continue
      if (!Number.isFinite(incapacidad) || incapacidad <= 0) continue
      out.push({
        tipo: "calcular_liquidacion",
        titulo,
        metodo,
        ingresoMensual,
        edad,
        incapacidad,
        fechaHecho,
        motivo,
      })
    } else if (tipo === 'calcular_plazo_procesal') {
      const fechaNotificacion = typeof o.fechaNotificacion === 'string' ? o.fechaNotificacion.trim() : '';
      const diasHabiles = Number(o.diasHabiles);
      const kmDistancia = Number(o.kmDistancia);
      const jurisdiccion = typeof o.jurisdiccion === 'string' ? o.jurisdiccion.trim() : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNotificacion)) continue;
      if (!Number.isFinite(diasHabiles) || diasHabiles <= 0) continue;
      if (!jurisdiccion || !['nacion', 'corrientes', 'pba'].includes(jurisdiccion)) continue;
      out.push({
        tipo: 'calcular_plazo_procesal',
        titulo,
        fechaNotificacion,
        diasHabiles,
        jurisdiccion: jurisdiccion as 'nacion' | 'corrientes' | 'pba',
        kmDistancia: Number.isFinite(kmDistancia) && kmDistancia > 0 ? kmDistancia : 0,
        motivo,
      });
    } else if (tipo === 'calcular_tasa_justicia') {
      const monto = Number(o.monto);
      if (!Number.isFinite(monto) || monto <= 0) continue;
      out.push({
        tipo: 'calcular_tasa_justicia',
        titulo,
        monto,
        motivo,
      });
    } else {
      out.push({ tipo: tipo as AccionPropuesta['tipo'], titulo, motivo });
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
    if (s.endsWith('\\')) s = s.slice(0, -1); // quita backslash colgante del corte
    try {
      return JSON.parse('"' + s + '"').trim();
    } catch {
      return s
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\t/g, ' ')
        .replace(/\\\\/g, '\\')
        .trim();
    }
  }
  // Último recurso: limpiar llaves y campos crudos.
  return raw
    .replace(/\bacciones\b\s*:[\s\S]*$/, '')
    .replace(/[{}"]/g, '')
    .replace(/\brespuesta\b\s*:/, '')
    .replace(/\\n/g, '\n')
    .trim();
}

// Red de seguridad: extrae ingreso mensual, edad e incapacidad de un texto libre (legajo o conversación).
function numeroCercaDe(texto: string, etiquetas: string[], min: number, max: number): number | null {
	for (const etiqueta of etiquetas) {
		const re = new RegExp(etiqueta + '\\D{0,25}?(\\d[\\d.]*)', 'i')
		const m = texto.match(re)
		if (m) {
			const n = Number(m[1].replace(/\./g, ''))
			if (Number.isFinite(n) && n >= min && n <= max) return n
		}
	}
	return null
}

function detectarDatosLiquidacion(
	texto: string
): { ingresoMensual: number; edad: number; incapacidad: number; metodo: 'mendez' | 'vuoto' } | null {
	const t = texto.toLowerCase()
	if (!/(liquidaci[oó]n|incapacidad|reclam)/.test(t)) return null
	const ingresoMensual = numeroCercaDe(
		t,
		['ingreso mensual', 'ingreso', 'sueldo', 'salario', 'remuneraci[oó]n', 'haber'],
		1000,
		999999999
	)
	const incapacidad = numeroCercaDe(t, ['incapacidad'], 1, 100)
	let edad = numeroCercaDe(t, ['edad'], 16, 99)
	if (!edad) {
		const m = t.match(/(\d{2})\s*años/)
		if (m) {
			const n = Number(m[1])
			if (n >= 16 && n <= 99) edad = n
		}
	}
	if (!ingresoMensual || !incapacidad || !edad) return null
	const metodo: 'mendez' | 'vuoto' = /vuoto/.test(t) ? 'vuoto' : 'mendez'
	return { ingresoMensual, edad, incapacidad, metodo }
}

function detectarFechaHecho(texto: string): string | null {
	const meses: Record<string, string> = {
		enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
		julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
		noviembre: '11', diciembre: '12',
	}
	const hoy = new Date().toISOString().slice(0, 10)
	const candidatos: string[] = []
	// La fecha del hecho es la que viene JUSTO DESPUÉS de una expresión de ocurrencia.
	// Así no la confundimos con la fecha de la demanda, de nacimiento, de notificación, etc.
	const gatillo =
		'(?:ocurri[óo]|ocurrid[oa]|acaeci[óo]|acaecid[oa]|sucedi[óo]|acontecid[oa]|se\\s+produjo|tuvo\\s+lugar|hecho|siniestro|accidente|mora)\\s+(?:el\\s+|del\\s+|d[ií]a\\s+)?'
	// Formato DD/MM/AAAA o AAAA-MM-DD
	const reNum = new RegExp(gatillo + '(\\d{1,2}\\/\\d{1,2}\\/\\d{4}|\\d{4}-\\d{2}-\\d{2})', 'gi')
	let m: RegExpExecArray | null
	while ((m = reNum.exec(texto))) {
		const f = m[1]
		let iso = ''
		if (f.includes('/')) {
			const [d, mo, y] = f.split('/')
			iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
		} else {
			iso = f
		}
		if (iso <= hoy) candidatos.push(iso)
	}
	// Formato "DD de mes de AAAA"
	const reTxt = new RegExp(gatillo + '(\\d{1,2})\\s+de\\s+([a-záéíóú]+)\\s+de\\s+(\\d{4})', 'gi')
	while ((m = reTxt.exec(texto))) {
		const mo = meses[m[2].toLowerCase()]
		if (mo) {
			const iso = `${m[3]}-${mo}-${m[1].padStart(2, '0')}`
			if (iso <= hoy) candidatos.push(iso)
		}
	}
	if (candidatos.length === 0) return null
	// El hecho generador suele ser anterior a las demás fechas del expediente.
	candidatos.sort()
	return candidatos[0]
}

// Red de seguridad: extrae fecha de notificación y días hábiles de un texto libre.
function detectarDatosPlazo(
  texto: string
): { fechaNotificacion: string; diasHabiles: number; kmDistancia: number; jurisdiccion: string; titulo: string } | null {
  const t = texto.toLowerCase();
  if (!/(plazo|traslado|vencimiento|apelaci[oó]n|contestar|contestaci[oó]n|d[ií]as h[aá]biles|caduc)/.test(t)) return null;

  let dias: number | null = null;
  const mDiasHab = t.match(/(\d{1,3})\s*d[ií]as\s+h[aá]biles/);
  const mDias = mDiasHab ?? t.match(/(\d{1,3})\s*d[ií]as/);
  if (mDias) {
    const n = Number(mDias[1]);
    if (n >= 1 && n <= 365) dias = n;
  }

  let fecha: string | null = null;
  const mIso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (mIso) {
    fecha = `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
  } else {
    const mDmy = t.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (mDmy) {
      const dd = mDmy[1].padStart(2, '0');
      const mm = mDmy[2].padStart(2, '0');
      fecha = `${mDmy[3]}-${mm}-${dd}`;
    }
  }

  if (!dias || !fecha) return null;

  let km = 0;
  const mKm = t.match(/(\d{2,4})\s*km/);
  if (mKm) {
    const n = Number(mKm[1]);
    if (n > 0 && n <= 5000) km = n;
  }

  let jurisdiccion = '';
  if (t.includes('nación') || t.includes('nacion') || t.includes('federal') || t.includes('nacion/federal')) jurisdiccion = 'nacion';
  else if (t.includes('corrientes')) jurisdiccion = 'corrientes';
  else if (t.includes('pba') || t.includes('buenos aires')) jurisdiccion = 'pba';

  return { fechaNotificacion: fecha, diasHabiles: dias, kmDistancia: km, jurisdiccion, titulo: 'Calcular vencimiento del plazo procesal' };
}

function detectarMontoJuicio(texto: string): number | null {
  if (!/(monto|reclam|indemniza|capital|demanda por|suma de|pesos|\$)/i.test(texto)) return null;
  const matches = texto.match(/\$?\s*\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?/g) || [];
  const candidatos = matches
    .map((m) => Number(m.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n >= 10000);
  if (candidatos.length === 0) return null;
  return Math.max(...candidatos);
}

function normalizarParaIntencion(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export async function responderAgenteLegajo(input: {
  industry: IndustryType;
  contextoLegajo: string;
  historial: MensajeChat[];
  pregunta: string;
}): Promise<
  | { ok: false; motivo: 'sin_api_key' | 'error' }
  | { ok: true; respuesta: string; acciones: AccionPropuesta[]; model: string }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, motivo: 'sin_api_key' };
  // gemini-2.5-flash es el modelo confirmado disponible con esta API key.
  const modelo = 'gemini-2.5-flash';
  let modeloActual = modelo;
  const hoy = new Date().toISOString().slice(0, 10);
  const estados = getCaseStatuses(input.industry);
  const estadosTexto = estados.map((e) => `"${e.value}" (${e.label})`).join(', ');
  const estadosValores = estados.map((e) => e.value);

  const systemInstruction = [
    getAgentPersona(input.industry),
    '',
    REGLAS,
    '',
    reglasAcciones(hoy, estadosTexto),
    '',
    'CONTEXTO DEL LEGAJO:',
    input.contextoLegajo || '(sin información cargada)',
  ].join('\n');

  const contents = [
    ...input.historial.map((m) => ({ role: m.rol, parts: [{ text: m.texto }] })),
    { role: 'user' as const, parts: [{ text: input.pregunta }] },
  ];

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          respuesta: { type: 'STRING' },
          acciones: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                tipo: { type: 'STRING' },
                titulo: { type: 'STRING' },
                fecha: { type: 'STRING' },
                hora: { type: 'STRING' },
                estado: { type: 'STRING' },
                itemChecklist: { type: 'STRING' },
                documento: { type: 'STRING' },
                metodo: { type: "STRING" },
                ingresoMensual: { type: "NUMBER" },
                edad: { type: "NUMBER" },
                incapacidad: { type: "NUMBER" },
                fechaHecho: { type: 'STRING' },
                fechaNotificacion: { type: 'STRING' },
                diasHabiles: { type: 'NUMBER' },
                kmDistancia: { type: 'NUMBER' },
                jurisdiccion: { type: 'STRING' },
                monto: { type: 'NUMBER' },
                motivo: { type: 'STRING' },
              },
              required: ['tipo', 'titulo', 'motivo'],
            },
          },
        },
        required: ['respuesta'],
      },
    },
  });

  // Reintenta ante errores transitorios de Gemini (sobrecarga 429 / 5xx).
  for (let intento = 0; intento < 3; intento++) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modeloActual}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }
      );

      if (resp.ok) {
        const data = await resp.json();
        const raw: string =
          data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
        if (raw.trim()) {
          let respuesta = '';
          let acciones: AccionPropuesta[] = [];
          try {
            const parsed = JSON.parse(limpiarJson(raw));
            respuesta =
              typeof parsed?.respuesta === 'string' && parsed.respuesta.trim()
                ? parsed.respuesta.trim()
                : salvarRespuesta(raw);
            acciones = validarAcciones(parsed?.acciones, estadosValores);
          } catch {
            // JSON cortado o inválido: rescatamos el texto y SEGUIMOS con las redes de seguridad.
            respuesta = salvarRespuesta(raw);
            acciones = [];
          }

          // Redes de seguridad: se ejecutan SIEMPRE, aunque el JSON haya venido mal.
          const esLegalLaboral = input.industry === 'legal';
          const p = input.pregunta;
          const pNorm = normalizarParaIntencion(p);

          const esIntencionAgenda = /(agenda|agendame|agendar|carga|registra|registralo|recordame)\b.*?(vencimiento|agenda|fecha)/i.test(pNorm);
          const intencionPlazo = /(calcula|calculame|calcular|saca|cuando|conta|determina)\b.*?(plazo|vencimiento|dias habiles|fecha procesal)/i.test(pNorm);
          const intencionTasa = /(calcula|calculame|calcular|estima)\b.*?(tasa)/i.test(pNorm);
          const intencionLiq = /(calcula|calculame|calcular|estima)\b.*?(liquidacion|indemnizacion|incapacidad)|mendez|vuoto/i.test(pNorm);

          let esContinuacionPlazo = false;
          let jurisCont = '';
          if (input.historial.length >= 2) {
            const lastAgent = input.historial[input.historial.length - 1];
            const lastUser = input.historial[input.historial.length - 2];
            const lastAgentNorm = normalizarParaIntencion(lastAgent.texto);
            const lastUserNorm = normalizarParaIntencion(lastUser.texto);
            if (
              lastAgent.rol === 'model' &&
              lastAgentNorm.includes('que jurisdiccion corresponde: justicia nacional/federal, provincia de buenos aires o provincia de corrientes') &&
              lastUser.rol === 'user' &&
              /(calcula|calculame|calcular|saca|cuando|conta|determina)\b.*?(plazo|vencimiento|dias habiles|fecha procesal)/i.test(lastUserNorm)
            ) {
              if (pNorm.includes('nacion') || pNorm.includes('federal')) jurisCont = 'nacion';
              else if (pNorm.includes('corrientes')) jurisCont = 'corrientes';
              else if (pNorm.includes('pba') || pNorm.includes('buenos aires') || pNorm.includes('provincia')) jurisCont = 'pba';
              
              if (jurisCont) esContinuacionPlazo = true;
            }
          }

          // Filtro estricto
          if (!esIntencionAgenda) acciones = acciones.filter(a => a.tipo !== 'agendar_plazo');
          if (!intencionPlazo && !esContinuacionPlazo) acciones = acciones.filter(a => a.tipo !== 'calcular_plazo_procesal');
          if (!intencionTasa) acciones = acciones.filter(a => a.tipo !== 'calcular_tasa_justicia');
          if (!intencionLiq) acciones = acciones.filter(a => a.tipo !== 'calcular_liquidacion');

          const allText = [input.contextoLegajo || '', ...input.historial.map((m) => m.texto), input.pregunta].join('\n');

          if (esLegalLaboral) {
            if (intencionTasa) {
              acciones = acciones.filter(a => a.tipo === 'calcular_tasa_justicia');
              const monto = detectarMontoJuicio(allText);
              if (monto && monto > 0 && !acciones.some(a => a.tipo === 'calcular_tasa_justicia')) {
                acciones.push({
                  tipo: 'calcular_tasa_justicia',
                  titulo: 'Tasa de justicia del proceso',
                  monto,
                  motivo: 'Detecté el monto del proceso en el expediente o la conversación.'
                });
              }
            } else if (intencionLiq) {
              acciones = acciones.filter(a => a.tipo === 'calcular_liquidacion');
              const datosLiq = detectarDatosLiquidacion(allText);
              if (datosLiq && !acciones.some(a => a.tipo === 'calcular_liquidacion')) {
                const fechaHecho = detectarFechaHecho(allText);
                acciones.push({
                  tipo: 'calcular_liquidacion',
                  titulo: 'Calcular liquidación estimada por incapacidad',
                  metodo: datosLiq.metodo,
                  ingresoMensual: datosLiq.ingresoMensual,
                  edad: datosLiq.edad,
                  incapacidad: datosLiq.incapacidad,
                  fechaHecho: fechaHecho ?? undefined,
                  motivo: 'Detecté los datos necesarios en la conversación.'
                });
              }
            } else if (intencionPlazo || esContinuacionPlazo) {
              acciones = acciones.filter(a => a.tipo === 'calcular_plazo_procesal' || a.tipo === 'agendar_plazo');
              
              const historyUserText = input.historial.filter(h => h.rol === 'user').map(h => h.texto).join('\n');
              const textForPlazo = esContinuacionPlazo ? historyUserText + '\n' + input.pregunta : input.pregunta;
              const datos = detectarDatosPlazo(textForPlazo + (jurisCont ? ` ${jurisCont}` : ''));
              
              if (datos) {
                if (datos.jurisdiccion) {
                  if (!acciones.some(a => a.tipo === 'calcular_plazo_procesal')) {
                    acciones.push({
                      tipo: 'calcular_plazo_procesal',
                      titulo: datos.titulo,
                      fechaNotificacion: datos.fechaNotificacion,
                      diasHabiles: datos.diasHabiles,
                      jurisdiccion: datos.jurisdiccion as 'nacion' | 'corrientes' | 'pba',
                      kmDistancia: datos.kmDistancia,
                      motivo: 'Detecté datos de plazo en la conversación.'
                    });
                  }
                } else {
                  acciones = [];
                  respuesta = '¿Qué jurisdicción corresponde: Justicia Nacional/Federal, Provincia de Buenos Aires o Provincia de Corrientes?';
                }
              }
            }
          }

          if (acciones.length > 0) {
            respuesta = respuesta.replace(/\b(calcul[eé]|se\s+calcul[oó]|agend[eé]|se\s+agend[oó]|ya\s+est[aá]\s+cargado)\b/gi, 'preparé la propuesta para que la apruebes');
          }

          return { ok: true, respuesta, acciones, model: `agente-${modeloActual}` };
        }
      } else if (resp.status === 429 || resp.status === 404 || resp.status >= 500) {
        console.error('Agente Gemini transitorio:', modeloActual, resp.status);
        // Si el modelo principal falla (404) o se queda sin cupo (429), probamos otro modelo.
        if (intento >= 1 && modeloActual !== 'gemini-2.0-flash') {
          modeloActual = 'gemini-2.0-flash';
        }
        // Respetamos el tiempo de espera que sugiere Gemini, si lo manda.
        const ra = Number(resp.headers.get('retry-after'));
        const espera =
          Number.isFinite(ra) && ra > 0
            ? Math.min(ra * 1000, 20000)
            : Math.min(6000, 1500 * 2 ** intento) + Math.random() * 400;
        await new Promise((r) => setTimeout(r, espera));
        continue;
      } else {
        console.error('Agente Gemini error:', resp.status, await resp.text());
        return { ok: false, motivo: 'error' };
      }
    } catch (e) {
      console.error('Agente error de red:', e);
    }
    await new Promise((r) => setTimeout(r, Math.min(8000, 700 * 2 ** intento) + Math.random() * 400));
  }

  return { ok: false, motivo: 'error' };
}
