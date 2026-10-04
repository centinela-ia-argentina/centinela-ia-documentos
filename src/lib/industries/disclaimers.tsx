import { IndustryType } from './documentTypes';

export function getAiDisclaimer(industry?: IndustryType | string): string {
  if (industry === 'inmobiliaria') {
    return 'Estimación orientativa automatizada generada en entorno controlado. No reemplaza una tasación, asesoramiento legal ni publicación profesional.';
  }
  
  if (industry === 'legal') {
    return 'Análisis documental beta en entorno controlado. No reemplaza el asesoramiento ni el patrocinio letrado profesional. Las respuestas y modelos deben ser validados por un profesional del derecho.';
  }

  if (industry === 'escribania') {
    return 'Análisis documental beta en entorno controlado. No reemplaza la calificación notarial profesional ni el dictamen de títulos.';
  }

  return 'Análisis documental beta en entorno controlado. Todo resultado debe ser revisado por un profesional antes de tomar acciones.';
}

export function getAgentDisclaimer(industry?: IndustryType | string): string {
  if (industry === 'inmobiliaria') {
    return 'El agente organiza y orienta con la información disponible. Verificá documentos, fechas e importes antes de decidir; no reemplaza una tasación ni el asesoramiento profesional.';
  }

  if (industry === 'legal') {
    return 'El agente organiza y orienta con la información disponible. Sus respuestas deben ser validadas por un profesional del derecho antes de actuar.';
  }

  if (industry === 'escribania') {
    return 'El agente organiza y orienta con la información disponible. Sus respuestas no reemplazan la calificación notarial ni el dictamen de títulos.';
  }

  return 'El agente organiza y orienta con la información disponible. Verificá sus respuestas antes de tomar decisiones.';
}

export function AiDisclaimer({
  industry,
  className = '',
  context = 'default',
}: {
  industry?: IndustryType | string;
  className?: string;
  context?: 'default' | 'agent';
}) {
  const disclaimerText = context === 'agent'
    ? getAgentDisclaimer((industry as IndustryType) || 'general')
    : getAiDisclaimer((industry as IndustryType) || 'general');
  return (
    <div className={`mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-400 ${className}`}>
      <span className="font-bold mr-1">{context === 'agent' ? 'Uso responsable:' : 'Aviso importante:'}</span>
      {disclaimerText}
    </div>
  );
}
