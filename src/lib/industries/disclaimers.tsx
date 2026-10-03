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

export function AiDisclaimer({ industry, className = '' }: { industry?: IndustryType | string, className?: string }) {
  const disclaimerText = getAiDisclaimer((industry as IndustryType) || 'general');
  return (
    <div className={`mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-400 ${className}`}>
      <span className="font-bold mr-1">Aviso importante:</span>
      {disclaimerText}
    </div>
  );
}
