const originalFetch = global.fetch;

global.fetch = async (input, init) => {
  if (process.env.MOCK_AI === 'true' && typeof input === 'string' && input.includes('generativelanguage.googleapis.com')) {
    console.log('[MOCK AI] Intercepted Gemini request');
    // Generar un JSON "comodín" que cumpla con los esquemas de copiloto, análisis documental, tasador, etc.
    const mockContent = JSON.stringify({
      resumen_general: "Resumen generado por AI Mock.",
      estado_actual: "Activo (Mock)",
      partes: ["Parte A", "Parte B"],
      puntos_clave: ["Punto 1"],
      riesgos_alertas: ["Sin riesgos"],
      proximas_acciones: ["Revisar expediente"],
      veredicto: "Aprobado",
      score: 90,
      factores_positivos: ["Todo en orden"],
      factores_negativos: [],
      aviso: "Aviso redactado por Mock",
      titulos_sugeridos: ["Titulo 1", "Titulo 2"],
      sugerencias: ["Sugerencia 1"],
      datos_estructurados: { monto: 1000 },
      texto_crudo: "Texto crudo mock",
      tipo_documental_detectado: "Escritura (Mock)",
      nivel_confianza: 0.95
    });

    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ text: mockContent }]
        }
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return originalFetch(input, init);
};
