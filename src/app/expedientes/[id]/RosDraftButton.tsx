'use client';

import { FileText } from 'lucide-react';
import type { AnalisisUIF } from '@/lib/ai/uif';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function RosDraftButton({
  analisis,
  legajo,
}: {
  analisis: AnalisisUIF;
  legajo: { titulo: string; comparecientes: string; tipoActo: string; fecha: string; resumen: string; monto?: string; fechaBoleto?: string };
}) {
  const exportar = () => {
    const li = (arr: string[]) =>
      arr.length ? `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">[COMPLETAR]</p>';
    const fecha = legajo.fecha ? esc(legajo.fecha.split('-').reverse().join('/')) : '[COMPLETAR: fecha]';
    const monto = legajo.monto ? esc(legajo.monto) : '[COMPLETAR]';
    const fechaBoleto = legajo.fechaBoleto ? esc(legajo.fechaBoleto) : '[COMPLETAR]';

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" />
      <title>Borrador ROS - ${esc(legajo.titulo || 'Legajo')}</title>
      <style>
        * { font-family: Arial, sans-serif; }
        body { margin: 36px; color: #111; line-height: 1.5; }
        h1 { font-size: 17px; margin: 0 0 4px; }
        h2 { font-size: 13px; margin: 20px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
        p, li { font-size: 12px; }
        .muted { color: #888; }
        .aviso { background: #fff7ed; border: 1px solid #fed7aa; padding: 10px; font-size: 11px; color: #9a3412; border-radius: 6px; }
        .riesgo { display:inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; background:#eee; }
        .foot { margin-top: 28px; font-size: 10px; color: #888; }
        @media print { body { margin: 16mm; } }
      </style></head>
      <body>
        <h2>Borrador — Reporte de Operación Sospechosa (ROS)</h2>
        <p class="muted">Documento de trabajo generado por Centinela IA. Debe ser revisado, completado y presentado por el escribano ante la UIF a través del sistema oficial. No constituye una presentación válida por sí mismo.</p>
        <div class="aviso">Este borrador se basa en el análisis de riesgo del legajo. Verificá y completá todos los campos marcados como [COMPLETAR] antes de cualquier presentación.</div>

        <h2>1. Sujeto obligado</h2>
        <p>Escribano/a: [COMPLETAR: nombre y apellido]<br/>Registro notarial N°: [COMPLETAR]<br/>CUIT: [COMPLETAR]<br/>Domicilio: [COMPLETAR]</p>

        <h2>2. Operación reportada</h2>
        <p>Legajo: ${esc(legajo.titulo || '[COMPLETAR]')}<br/>Tipo de acto: ${esc(legajo.tipoActo || '[COMPLETAR]')}<br/>Fecha: ${fecha}<br/>Monto y Valuación: ${monto}</p>
        <p>Fecha de boleto / operación: ${fechaBoleto}</p>

        <h2>3. Personas intervinientes</h2>
        <p>Comparecientes: ${esc(legajo.comparecientes || '[COMPLETAR]')}</p>
        <p class="muted">Completar por cada interviniente: DNI/CUIT, domicilio, estado civil, actividad, carácter (por sí / en representación) y beneficiario final si corresponde (Extraer del análisis si existen).</p>

        <h2>4. Descripción de la operación</h2>
        <p>${legajo.resumen ? esc(legajo.resumen) : '[COMPLETAR: relato de los hechos y descripción de la operación]'}</p>

        <h2>5. Fundamentos de la sospecha</h2>
        <p>Nivel de riesgo asignado: <span class="riesgo">${esc(analisis.nivel_riesgo.toUpperCase())}</span></p>
        <p>${analisis.fundamento ? esc(analisis.fundamento) : ''}</p>
        <p><b>Factores de riesgo:</b></p>
        ${li(analisis.factores_riesgo)}
        <p><b>Señales de alerta:</b></p>
        ${li(analisis.senales_alerta)}

        <h2>6. Medidas / verificaciones de debida diligencia</h2>
        ${li(analisis.verificaciones_pendientes)}

        <h2>7. Documentación de respaldo</h2>
        <p class="muted">[COMPLETAR: detalle de la documentación adjunta al reporte]</p>

        <p class="foot">Generado el ${new Date().toLocaleString('es-AR', { timeZone: 'America/Buenos_Aires', hour12: false })} · Centinela IA · Borrador sujeto a revisión profesional.</p>
      </body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    if (!iframe.contentDocument) return;
    
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();

    const originalTitle = document.title;
    const printTitle = `Borrador_ROS_${legajo.titulo.replace(/[^a-z0-9]/gi, '_')}`;
    document.title = printTitle;

    setTimeout(() => {
      if (iframe.contentWindow && iframe.contentDocument) {
        iframe.contentDocument.title = printTitle;
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
      document.title = originalTitle;
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 500);
  };

  return (
    <button
      onClick={exportar}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm font-medium text-white transition hover:bg-white/[0.06]"
    >
      <FileText className="h-4 w-4" /> Borrador de ROS (PDF)
    </button>
  );
}
