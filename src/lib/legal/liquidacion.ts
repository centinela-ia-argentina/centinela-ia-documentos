// src/lib/legal/liquidacion.ts

// Motor de liquidación para el fuero civil/laboral.
// Espeja EXACTAMENTE la matemática de las calculadoras (CalculadorasClient.tsx),
// pero sin React, para poder reusarlo desde el Agente IA (servidor) y la UI.
// Nota: es independiente del "tasador" inmobiliario (src/lib/ai/tasador.ts).

export type MetodoIncapacidad = "mendez" | "vuoto"

export interface IncapacidadInput {
	metodo: MetodoIncapacidad
	ingresoMensual: number // $ mensual de la víctima
	edad: number // años al momento del hecho
	incapacidad: number // porcentaje 0-100
}

export interface IncapacidadResult {
	ok: boolean
	motivo?: string
	metodo: MetodoIncapacidad
	capital: number // indemnización por incapacidad (renta capitalizada)
	ingresoAnualAjustado: number // "a" en la fórmula
	aniosComputables: number // "n"
	tasaDescuento: number // "i"
}

// Vuoto (1978) y Méndez (2008): renta capitalizada.
export function calcularIncapacidad(input: IncapacidadInput): IncapacidadResult {
	const metodo = input.metodo
	const ing = Number(input.ingresoMensual)
	const ed = Math.trunc(Number(input.edad))
	const inc = Number(input.incapacidad) / 100
	const base = {
		metodo,
		capital: 0,
		ingresoAnualAjustado: 0,
		aniosComputables: 0,
		tasaDescuento: 0,
	}
	if (!Number.isFinite(ing) || ing <= 0)
		return { ...base, ok: false, motivo: "ingreso_invalido" }
	if (!Number.isFinite(ed) || ed <= 0)
		return { ...base, ok: false, motivo: "edad_invalida" }
	if (!Number.isFinite(inc) || inc <= 0 || inc > 1)
		return { ...base, ok: false, motivo: "incapacidad_invalida" }

	const i = metodo === "mendez" ? 0.04 : 0.06
	const tope = metodo === "mendez" ? 75 : 65
	const n = tope - ed
	if (n <= 0)
		return { ...base, tasaDescuento: i, ok: false, motivo: "edad_supera_tope" }

	let a = ing * 13 * inc
	if (metodo === "mendez") a = a * (60 / ed)
	const Vn = 1 / Math.pow(1 + i, n)
	const capital = (a * (1 - Vn)) / i

	return {
		ok: true,
		metodo,
		capital,
		ingresoAnualAjustado: a,
		aniosComputables: n,
		tasaDescuento: i,
	}
}

export interface InteresesMoratoriosResult {
	ok: boolean
	motivo?: string
	dias: number
	tasaAnual: number
	fechaDesde: string
	fechaHasta: string
	interes: number
	total: number
}

// Motor de intereses históricos temporalmente bloqueado (J-LEGAL-1B.3).
// No se puede aplicar una tasa plana (ej. 25.57%) de manera retroactiva.
// Requiere la implementación de series históricas oficiales segmentadas por tramo.
export function calcularInteresesMoratorios(args: {
	capital: number
	fechaDesde: string // ISO yyyy-mm-dd (fecha del hecho / mora)
	fechaHasta?: string // ISO; por defecto hoy
	tasaAnual?: number // % anual
}): InteresesMoratoriosResult {
	const capital = Number(args.capital)
	const fechaHasta = args.fechaHasta ?? new Date().toISOString().slice(0, 10)
	const fechaDesde = args.fechaDesde
	return { 
		ok: false, 
		motivo: 'Motor bloqueado: requiere serie histórica oficial. No se puede calcular retroactivamente con tasa fija.',
		dias: 0, 
		tasaAnual: 0, 
		fechaDesde: fechaDesde ?? '', 
		fechaHasta, 
		interes: 0, 
		total: Number.isFinite(capital) ? capital : 0
	}
}
