/**
 * Formateador de números a letras y parser monetario riguroso para instrumentos legales y notariales.
 */

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const DIEZ = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function apocope(s: string): string {
  return s.replace(/uno$/, 'ún');
}

export function menorAMil(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  let s = '';
  const c = Math.floor(n / 100);
  const d = n % 100;
  if (c) s += CENTENAS[c] + ' ';
  if (d >= 10 && d <= 19) {
    s += DIEZ[d - 10];
  } else if (d >= 20 && d <= 29) {
    s += d === 20 ? 'veinte' : 'veinti' + UNIDADES[d - 20];
  } else {
    const dz = Math.floor(d / 10);
    const un = d % 10;
    if (dz) s += DECENAS[dz] + (un ? ' y ' : '');
    if (un) s += UNIDADES[un];
  }
  return s.trim();
}

export function menorAMillon(n: number): string {
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  let s = '';
  if (miles === 1) {
    s = 'mil';
  } else if (miles > 1) {
    s = apocope(menorAMil(miles)) + ' mil';
  }
  if (resto > 0) {
    s += (s ? ' ' : '') + menorAMil(resto);
  }
  return s.trim();
}

export function enteroALetras(n: number): string {
  if (n === 0) return 'cero';
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error('El número a convertir debe ser un entero positivo seguro.');
  }

  const billones = Math.floor(n / 1_000_000_000_000);
  let resto = n % 1_000_000_000_000;

  const millones = Math.floor(resto / 1_000_000);
  resto = resto % 1_000_000;

  let s = '';

  if (billones === 1) {
    s += 'un billón';
  } else if (billones > 1) {
    s += apocope(menorAMillon(billones)) + ' billones';
  }

  if (millones === 1) {
    s += (s ? ' ' : '') + 'un millón';
  } else if (millones > 1) {
    s += (s ? ' ' : '') + apocope(menorAMillon(millones)) + ' millones';
  }

  if (resto > 0) {
    s += (s ? ' ' : '') + menorAMillon(resto);
  }

  return s.trim();
}

export interface MontoMonetarioParsed {
  entero: number;
  centavos: number;
  valorTotal: number;
  textoLimpio: string;
}

/**
 * Parsea una cadena numérica monetaria de forma rigurosa e inequívoca.
 * Soportes:
 * - Enteros sin separadores: "1234567" -> 1234567, 0 centavos
 * - Decimal con punto o coma (1 o 2 decimales): "1234567.89", "1234567,89", "1.5", "0.01"
 * - Separadores de miles estándar con coma o punto: "1.234.567,89", "1,234,567.89"
 * 
 * Rechaza:
 * - Valores negativos
 * - Letras o caracteres extraños
 * - Formatos ambiguos (ej. múltiples puntos y comas inconsistentes o 3 dígitos decimales)
 * - Números fuera del rango seguro (Number.MAX_SAFE_INTEGER)
 */
export function parseMontoMonetario(input: string | null | undefined): MontoMonetarioParsed {
  if (!input || typeof input !== 'string') {
    throw new Error('Ingresá un monto válido.');
  }

  const raw = input.trim();
  if (!raw) {
    throw new Error('Ingresá un monto no vacío.');
  }

  if (raw.startsWith('-')) {
    throw new Error('El monto no puede ser negativo.');
  }

  // Verificar caracteres permitidos: dígitos, puntos, comas, espacios y símbolos de moneda
  const clean = raw.replace(/^[\$ARSUSDEUR\s]+/, '').trim();
  if (!clean) {
    throw new Error('Ingresá un número válido.');
  }

  if (/[^0-9.,\s]/.test(clean)) {
    throw new Error('El monto contiene caracteres no numéricos inválidos.');
  }

  const withoutSpaces = clean.replace(/\s+/g, '');

  const hasDot = withoutSpaces.includes('.');
  const hasComma = withoutSpaces.includes(',');

  let enteroStr = '';
  let centavosStr = '00';

  if (hasDot && hasComma) {
    const lastDot = withoutSpaces.lastIndexOf('.');
    const lastComma = withoutSpaces.lastIndexOf(',');

    if (lastComma > lastDot) {
      // Formato argentino/europeo: 1.234.567,89
      const decimalPart = withoutSpaces.slice(lastComma + 1);
      const integerPart = withoutSpaces.slice(0, lastComma);

      // Verificar que los puntos de miles sean válidos
      const milesChunks = integerPart.split('.');
      if (milesChunks.some((chunk, idx) => (idx === 0 ? chunk.length < 1 || chunk.length > 3 : chunk.length !== 3))) {
        throw new Error('Formato de separador de miles inválido.');
      }
      if (decimalPart.length === 0 || decimalPart.length > 2) {
        throw new Error('El separador decimal debe contener como máximo 2 dígitos de centavos.');
      }
      enteroStr = integerPart.replace(/\./g, '');
      centavosStr = decimalPart.length === 1 ? decimalPart + '0' : decimalPart;
    } else {
      // Formato anglosajón: 1,234,567.89
      const decimalPart = withoutSpaces.slice(lastDot + 1);
      const integerPart = withoutSpaces.slice(0, lastDot);

      const milesChunks = integerPart.split(',');
      if (milesChunks.some((chunk, idx) => (idx === 0 ? chunk.length < 1 || chunk.length > 3 : chunk.length !== 3))) {
        throw new Error('Formato de separador de miles inválido.');
      }
      if (decimalPart.length === 0 || decimalPart.length > 2) {
        throw new Error('El separador decimal debe contener como máximo 2 dígitos de centavos.');
      }
      enteroStr = integerPart.replace(/,/g, '');
      centavosStr = decimalPart.length === 1 ? decimalPart + '0' : decimalPart;
    }
  } else if (hasDot || hasComma) {
    const sep = hasDot ? '.' : ',';
    const occurrences = (withoutSpaces.match(new RegExp(`\\${sep}`, 'g')) || []).length;

    if (occurrences > 1) {
      // Múltiples separadores idénticos: deben ser separadores de miles
      const chunks = withoutSpaces.split(sep);
      if (chunks.some((chunk, idx) => (idx === 0 ? chunk.length < 1 || chunk.length > 3 : chunk.length !== 3))) {
        throw new Error('Formato ambiguo o separadores de miles mal posicionados.');
      }
      enteroStr = withoutSpaces.replace(new RegExp(`\\${sep}`, 'g'), '');
      centavosStr = '00';
    } else {
      // Único separador:
      const parts = withoutSpaces.split(sep);
      const dec = parts[1];

      if (dec.length === 1 || dec.length === 2) {
        // Es inequívocamente decimal: ej. 1234567.89, 1234567,89, 1.5, 0.01
        enteroStr = parts[0];
        centavosStr = dec.length === 1 ? dec + '0' : dec;
      } else if (dec.length === 3) {
        // Podría ser miles (1.234) o 3 decimales (1.234). Si la parte izquierda tiene 1-3 dígitos, es ambiguo a menos que se rechace
        // Regla explícita: 3 dígitos tras un único separador es ambiguo en montos monetarios de 2 decimales.
        throw new Error('Formato ambiguo: especifique si los 3 dígitos son miles o ingrese hasta 2 decimales.');
      } else {
        throw new Error('El separador decimal debe contener como máximo 2 dígitos de centavos.');
      }
    }
  } else {
    // Sin separadores: entero puro
    enteroStr = withoutSpaces;
    centavosStr = '00';
  }

  if (!/^\d+$/.test(enteroStr) || !/^\d{2}$/.test(centavosStr)) {
    throw new Error('Formato numérico inválido.');
  }

  const entero = Number(enteroStr);
  const centavos = Number(centavosStr);

  if (!Number.isSafeInteger(entero) || entero > Number.MAX_SAFE_INTEGER) {
    throw new Error('El número ingresado supera el límite de precisión seguro soportado.');
  }

  const valorTotal = entero + centavos / 100;

  return {
    entero,
    centavos,
    valorTotal,
    textoLimpio: `${entero}.${centavosStr}`,
  };
}

/**
 * Convierte un monto numérico a su expresión legal/notarial completa en letras.
 * Ej: "1234567.89" -> "un millón doscientos treinta y cuatro mil quinientos sesenta y siete con 89/100"
 */
export function montoALetras(montoInput: string | number, opciones?: { moneda?: string; mayusculas?: boolean }): string {
  const parsed = typeof montoInput === 'number'
    ? parseMontoMonetario(montoInput.toFixed(2))
    : parseMontoMonetario(montoInput);

  const letras = enteroALetras(parsed.entero);
  const centavosFmt = `${String(parsed.centavos).padStart(2, '0')}/100`;

  let resultado = `${letras} con ${centavosFmt}`;

  if (opciones?.moneda) {
    resultado = `${opciones.moneda} ${resultado}`;
  }

  return opciones?.mayusculas ? resultado.toUpperCase() : resultado;
}
