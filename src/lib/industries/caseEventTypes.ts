export const baseEventTypes = [
  { value: 'audiencia', label: 'Audiencia' },
  { value: 'presentacion', label: 'Presentación de escrito' },
  { value: 'resolucion', label: 'Resolución judicial' },
  { value: 'notificacion', label: 'Notificación recibida' },
  { value: 'reunion_cliente', label: 'Reunión con cliente' },
  { value: 'tramite', label: 'Trámite administrativo' },
  { value: 'documentacion', label: 'Documentación recibida' },
  { value: 'vencimiento', label: 'Vencimiento de plazo' },
  { value: 'firma', label: 'Firma de escritura/documento' },
  { value: 'otro', label: 'Otro movimiento' },
];

export const inmobiliariaEventTypes = [
  { value: 'visita', label: 'Visita' },
  { value: 'oferta', label: 'Oferta' },
  { value: 'reserva', label: 'Reserva' },
  { value: 'boleto', label: 'Firma de boleto' },
  { value: 'posesion', label: 'Entrega de posesión' },
  { value: 'escrituracion', label: 'Escrituración' },
  { value: 'ajuste_alquiler', label: 'Ajuste de alquiler' },
  { value: 'documentacion', label: 'Documentación' },
  { value: 'otro', label: 'Otro movimiento' },
];

export function getCaseEventTypes(industry?: string) {
  if (industry === 'inmobiliaria') return inmobiliariaEventTypes;
  return baseEventTypes;
}

export function getCaseEventLabel(value: string, industry?: string) {
  const types = getCaseEventTypes(industry);
  const found = types.find((t) => t.value === value);
  if (found) return found.label;
  
  // Fallback to base if not found in specific industry
  const baseFound = baseEventTypes.find((t) => t.value === value);
  if (baseFound) return baseFound.label;

  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}
