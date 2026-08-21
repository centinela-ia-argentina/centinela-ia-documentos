export type WhatsAppContext = 'property' | 'client' | 'operation';

export function buildWhatsAppLink(phone: string, text: string): string {
  // Remove all non-numeric characters from the phone number
  const cleanPhone = phone.replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generatePropertyMessage(property: any): string {
  return `¡Hola! Te comparto esta propiedad que creo que te va a interesar: ${property.name}.
${property.address ? `📍 ${property.address}\n` : ''}${property.price ? `💰 ${property.currency} ${property.price.toLocaleString('es-AR')}\n` : ''}${property.surface_total_m2 ? `📏 ${property.surface_total_m2} m²\n` : ''}
¡Avisame si querés más info o coordinar una visita!`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateClientMessage(client: any): string {
  return `¡Hola ${client.name}! ¿Cómo estás?
Te escribo desde Centinela para hacer seguimiento de tu búsqueda de ${client.operation_interest || 'propiedades'}.
¿Pudiste ver las opciones que te mandamos? ¡Avisame y coordinamos!`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateOperationMessage(operation: any): string {
  return `¡Hola! Te escribo por la operación de ${operation.title}.
Queríamos avisarte que tuvimos una actualización en el expediente.
Por favor, contactate con nosotros cuando puedas. ¡Gracias!`;
}
