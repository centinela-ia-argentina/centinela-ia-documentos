const originalFetch = global.fetch;

function geminiResponse(text) {
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{ text }]
      },
      finishReason: 'STOP'
    }]
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

global.fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input?.url || '';

  if (
    process.env.MOCK_AI === 'true' &&
    url.includes('generativelanguage.googleapis.com')
  ) {
    console.log('[MOCK AI] Intercepted Gemini request');

    if (url.includes(':embedContent')) {
      const values = Array(768).fill(0);
      values[0] = 1;

      return new Response(
        JSON.stringify({
          embedding: {
            values,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (url.includes(':generateContent')) {
      let prompt = '';
      try {
        const requestBody = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
        prompt = requestBody?.contents?.[0]?.parts?.map((part) => part?.text || '').join('') || '';
      } catch {
        prompt = '';
      }

      if (prompt.includes('FRAGMENTOS:') && prompt.includes('PREGUNTA:')) {
        const markers = [
          'RAG_E2E_LEGAL_MARKER',
          'RAG_E2E_LEGAL_OTHER_CASE_MARKER',
          'RAG_E2E_INMOBILIARIA_MARKER',
          'RAG_E2E_ESCRIBANIA_MARKER',
        ].filter((marker) => prompt.includes(marker));

        if (markers.length !== 1) {
          return geminiResponse('RAG_E2E_CONTAMINATION_DETECTED');
        }

        const answers = {
          RAG_E2E_LEGAL_MARKER:
            'Respuesta jurídica E2E: el expediente contiene la cláusula legal determinista [1].',
          RAG_E2E_LEGAL_OTHER_CASE_MARKER:
            'Respuesta jurídica E2E: el otro expediente contiene evidencia aislada [1].',
          RAG_E2E_INMOBILIARIA_MARKER:
            'Respuesta inmobiliaria E2E: la operación identifica el inmueble determinista [1].',
          RAG_E2E_ESCRIBANIA_MARKER:
            'Respuesta notarial E2E: el acto identifica la matrícula determinista [1].',
        };

        return geminiResponse(answers[markers[0]]);
      }

      if (prompt.includes('BORRADOR de escritura') || prompt.includes('escribano público')) {
        return geminiResponse(JSON.stringify({
          titulo: 'Borrador de escritura de compraventa',
          cuerpo: 'PRIMERA: En la Ciudad Autónoma de Buenos Aires. COMPARECEN las partes.\nSEGUNDA: Venta de departamento en Palermo, calle Cuba.\nTERCERA: Precio y forma de pago abonado en efectivo de fondos lícitos declarados.\nQUINTA: Posesión y libre deuda.\nSEXTA: CERTIFICADOS.\nSÉPTIMA: GASTOS E IMPUESTOS. Las partes declaran que la presente operación se encuentra alcanzada por el Impuesto a la Transferencia de Inmuebles (I.T.I.) o, en su caso, por el Impuesto a las Ganancias (IG), según corresponda, y se comprometen a cumplir con las obligaciones fiscales pertinentes, y certificado C.O.T.I. N° 98765432. [COMPLETAR: Declaración jurada ITI/Impuesto a las Ganancias].\nOCTAVA: DECLARACIONES JURADAS.',
          datos_faltantes: [],
          advertencias: []
        }));
      }

      if (prompt.includes('COTEJAR') || prompt.includes('estudio de títulos')) {
        return geminiResponse(JSON.stringify({
          veredicto: 'Cotejo preliminar con observaciones sobre plazos contractuales.',
          coincidencias: ['Identidad de partes conforme documentación aportada'],
          discrepancias: [],
          faltantes: ['Documentación respaldatoria sobre origen de fondos'],
          alertas_vigencia: []
        }));
      }

      if (prompt.includes('resumen ejecutivo') || prompt.includes('expediente judicial') || prompt.includes('gestión documental')) {
        return geminiResponse(JSON.stringify({
          resumen_general: 'El presente legajo instrumenta la compraventa de un inmueble en Palermo.',
          estado_actual: 'En etapa notarial preparatoria.',
          partes: ['Comprador Palermo', 'Vendedor Palermo'],
          puntos_clave: ['Boleto 10/06/2026', 'Plazo 90 días corridos'],
          riesgos_alertas: [],
          proximas_acciones: ['Revisar documentación y coordinar otorgamiento.']
        }));
      }

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

      return geminiResponse(mockContent);
    }
  }

  return originalFetch(input, init);
};
