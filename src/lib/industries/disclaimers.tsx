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
  const baseClass = context === 'agent'
    ? 'mt-3 rounded-md border border-white/10 bg-white/[0.025] px-4 py-3 font-ui text-[13px] font-medium leading-5 tracking-[-0.015em] text-[#AAB9B4]'
    : 'mt-2.5 flex items-start gap-2 text-[11.5px] leading-relaxed text-neutral-500';

  return (
    <div
      className={`${baseClass} ${className}`}
      style={context === 'agent' ? { color: '#AAB9B4' } : undefined}
    >
      {context === 'agent' ? (
        <span className="mr-1 font-semibold text-[#F1F6F4]">Uso responsable:</span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01M12 12v5" strokeLinecap="round" />
        </svg>
      )}
      <span>
        {context === 'agent' ? (
          <span className="mr-1 font-semibold text-[#F1F6F4]" />
        ) : (
          <b className="text-neutral-600">Aviso importante:</b>
        )}
        {disclaimerText}
      </span>
    </div>
  );
}
