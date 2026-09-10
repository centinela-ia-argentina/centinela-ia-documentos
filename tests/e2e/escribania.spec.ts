import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loginAs } from './helpers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_ESC_ID = '33333333-3333-3333-3333-333333333333';
const CASE_ESC_ID = 'eeee3333-3333-3333-3333-333333333333';
const CASE_INM_ID = 'dddd2222-2222-2222-2222-222222222222';
const CASE_LEGAL_ID = 'cccc1111-1111-1111-1111-111111111111';
const CASE_PALERMO_ID = 'eeee3333-3333-3333-3333-333333333339';
const DOC_PALERMO_ID = 'ddcc3333-3333-3333-3333-333333333339';
const DOC_ANTECEDENTE_ID = 'ddcc3333-3333-3333-3333-333333333338';
const DOC_CERTIFICADOS_ID = 'ddcc3333-3333-3333-3333-333333333337';

test.describe.serial('Centinela IA - Escribania E2E', () => {
  let tempCaseId = '';

  test.afterAll(async () => {
    const toClean = [tempCaseId, CASE_PALERMO_ID].filter(Boolean);
    for (const cid of toClean) {
      try {
        await serviceClient.from('ai_outputs').delete().eq('case_id', cid);
        await serviceClient.from('documents').delete().eq('case_id', cid);
        const { data: checklists } = await serviceClient
          .from('checklists')
          .select('id')
          .eq('case_id', cid);

        if (checklists && checklists.length > 0) {
          for (const checklist of checklists) {
            await serviceClient.from('checklist_items').delete().eq('checklist_id', checklist.id);
          }
          await serviceClient.from('checklists').delete().eq('case_id', cid);
        }

        await serviceClient.from('cases').delete().eq('id', cid);
      } catch {
        // Ignorar fallos de limpieza en afterAll
      }
    }
    tempCaseId = '';
  });

  test('A. Login', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.esc@test.com');
    await page.close();
    await context.close();
  });

  test('B. Navegación vertical', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.esc@test.com');
    try {
      const nav = page.locator('nav');
      
      const legajosLink = nav.locator('a', { hasText: 'Legajos' }).first();
      await legajosLink.scrollIntoViewIfNeeded();
      await expect(legajosLink).toBeVisible();

      const recibidosLink = nav.locator('a', { hasText: 'Recibidos' }).first();
      await recibidosLink.scrollIntoViewIfNeeded();
      await expect(recibidosLink).toBeVisible();

      const modelosLink = nav.locator('a', { hasText: 'Modelos' }).first();
      await modelosLink.scrollIntoViewIfNeeded();
      await expect(modelosLink).toBeVisible();

      const agendaLink = nav.locator('a', { hasText: 'Agenda' }).first();
      await agendaLink.scrollIntoViewIfNeeded();
      await expect(agendaLink).toBeVisible();

      const indiceLink = nav.locator('a', { hasText: 'Índice / Repertorio' }).first();
      await indiceLink.scrollIntoViewIfNeeded();
      await expect(indiceLink).toBeVisible();
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('C. Legajo propio', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.esc@test.com');
    try {
      await page.goto(`/expedientes/${CASE_ESC_ID}`);
      await expect(page.locator('[data-testid="case-detail-title"]')).toContainText('Escritura 1');
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('D. Tipos permitidos', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.esc@test.com');
    try {
      await page.goto('/expedientes/nuevo');

      const caseType = page.locator('[data-testid="case-type"]');
      await expect(caseType).toBeVisible();

      const values = await caseType.locator('option').evaluateAll(
        options => options.map(option => (option as HTMLOptionElement).value)
      );

      expect(values).toContain('Escritura');
      expect(values).toContain('Poder');
      expect(values).toContain('Sucesión');
      expect(values).toContain('Certificación de firmas');
      expect(values).toContain('Acta notarial');
      expect(values).toContain('Otro');

      expect(values).not.toContain('Caso jurídico');
      expect(values).not.toContain('Demanda');
      expect(values).not.toContain('Compraventa de inmueble');
      expect(values).not.toContain('Alquiler');
      expect(values).not.toContain('Reserva');
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('E. Checklist automático', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.esc@test.com');
    try {
      await page.goto('/expedientes/nuevo');

      const uniqueTitle = `Escritura E2E ${Date.now()}`;
      await page.fill('[data-testid="case-title"]', uniqueTitle);
      await page.fill('[data-testid="case-client"]', 'Cliente Notarial');
      await page.selectOption('[data-testid="case-type"]', 'Escritura');
      await page.click('[data-testid="case-submit"]');

      await expect(page).toHaveURL(/\/expedientes\/[a-f0-9\-]+/);
      tempCaseId = page.url().split('/').pop() || '';

      const { data: checklists, error: chkErr } = await serviceClient
        .from('checklists')
        .select('id, case_id, organization_id, template_type')
        .eq('case_id', tempCaseId);

      expect(chkErr).toBeNull();
      expect(checklists).not.toBeNull();
      expect(checklists?.length).toBe(1);
      
      const checklist = checklists![0];

      expect(checklist?.case_id).toBe(tempCaseId);
      expect(checklist?.organization_id).toBe(ORG_ESC_ID);
      expect(checklist?.template_type).toBe('Escritura');

      const { data: items, error: itemsErr } = await serviceClient
        .from('checklist_items')
        .select('id, checklist_id, organization_id')
        .eq('checklist_id', checklist.id);

      expect(itemsErr).toBeNull();
      expect(items?.length).toBeGreaterThan(0);
      items?.forEach(item => {
        expect(item.checklist_id).toBe(checklist.id);
        expect(item.organization_id).toBe(ORG_ESC_ID);
      });
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('F. Aislamiento', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.esc@test.com');
    try {
      let response = await page.goto(`/expedientes/${CASE_LEGAL_ID}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
      await expect(page.locator('[data-testid="case-detail-title"]')).toHaveCount(0);
      let visibleText = await page.locator('body').innerText();
      expect(visibleText).not.toContain('Caso Legal 1');
      expect(visibleText).not.toContain(CASE_LEGAL_ID);

      response = await page.goto(`/expedientes/${CASE_INM_ID}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
      await expect(page.locator('[data-testid="case-detail-title"]')).toHaveCount(0);
      visibleText = await page.locator('body').innerText();
      expect(visibleText).not.toContain('Propiedad 1');
      expect(visibleText).not.toContain(CASE_INM_ID);
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('G. Palermo Cuba - Consistencia de Fechas, Radar, Observaciones y Guardrail UIF', async ({ browser }) => {
    // 1. Limpiar outputs y plazos previos para asegurar derivación y ejecución real
    await serviceClient.from('ai_outputs').delete().eq('case_id', CASE_PALERMO_ID);
    await serviceClient.from('agenda_plazos').delete().eq('case_id', CASE_PALERMO_ID);

    // 2. Sembrar legajo Palermo Cuba (SIN fecha límite precargada para exigir derivación real)
    await serviceClient.from('cases').upsert({
      id: CASE_PALERMO_ID,
      organization_id: ORG_ESC_ID,
      title: 'Compraventa Depto Palermo Cuba',
      case_type: 'Escritura',
      status: 'active',
      client_name: 'Comprador Palermo',
      metadata: {
        tipo_acto: 'Compraventa',
      },
      created_by: 'cccc3333-3333-3333-3333-333333333333',
    });

    // 3. Sembrar documentos reales: Boleto, Escritura antecedente (2015) y Certificados (oct/nov 2026)
    await serviceClient.from('documents').upsert([
      {
        id: DOC_PALERMO_ID,
        case_id: CASE_PALERMO_ID,
        organization_id: ORG_ESC_ID,
        file_name: '01_boleto_compraventa_palermo_cuba.pdf',
        file_path: `${ORG_ESC_ID}/${CASE_PALERMO_ID}/01_boleto_compraventa_palermo_cuba.pdf`,
        file_size: 1024,
        file_mime_type: 'application/pdf',
        file_hash: 'hash-palermo-boleto',
        uploaded_by: 'cccc3333-3333-3333-3333-333333333333',
      },
      {
        id: DOC_ANTECEDENTE_ID,
        case_id: CASE_PALERMO_ID,
        organization_id: ORG_ESC_ID,
        file_name: '02_escritura_antecedente_palermo.pdf',
        file_path: `${ORG_ESC_ID}/${CASE_PALERMO_ID}/02_escritura_antecedente_palermo.pdf`,
        file_size: 2048,
        file_mime_type: 'application/pdf',
        file_hash: 'hash-palermo-antecedente',
        uploaded_by: 'cccc3333-3333-3333-3333-333333333333',
      },
      {
        id: DOC_CERTIFICADOS_ID,
        case_id: CASE_PALERMO_ID,
        organization_id: ORG_ESC_ID,
        file_name: '03_certificados_palermo.pdf',
        file_path: `${ORG_ESC_ID}/${CASE_PALERMO_ID}/03_certificados_palermo.pdf`,
        file_size: 1536,
        file_mime_type: 'application/pdf',
        file_hash: 'hash-palermo-certificados',
        uploaded_by: 'cccc3333-3333-3333-3333-333333333333',
      },
    ]);

    // 4. Sembrar análisis documentales de IA correspondientes
    await serviceClient.from('ai_outputs').upsert([
      {
        case_id: CASE_PALERMO_ID,
        document_id: DOC_PALERMO_ID,
        organization_id: ORG_ESC_ID,
        output_type: 'document_analysis',
        content: 'Análisis documental boleto Palermo',
        model_name: 'test-model',
        result_json: {
          tipo_documental_detectado: 'Boleto de compraventa',
          resumen: 'Boleto de compraventa firmado el 10/06/2026 con plazo de 90 días corridos para otorgar la escritura. No acredita origen de fondos.',
          datos_clave: ['Plazo máximo contractual para escriturar: 90 días corridos.', 'USD 150.000'],
          fechas_plazos: [
            { descripcion: 'Fecha de emisión del Boleto de Compraventa', fecha: '2026-06-10', tipo: 'issue_date', confianza: 'alta', requiere_revision: false, evidencia_textual: '10 de junio de 2026' },
            { descripcion: 'Fecha tentativa de escritura', fecha: '2026-09-10', tipo: 'contractual_deadline', confianza: 'alta', requiere_revision: false, evidencia_textual: '10 de septiembre de 2026' },
          ],
        },
      },
      {
        case_id: CASE_PALERMO_ID,
        document_id: DOC_ANTECEDENTE_ID,
        organization_id: ORG_ESC_ID,
        output_type: 'document_analysis',
        content: 'Análisis documental escritura antecedente',
        model_name: 'test-model',
        result_json: {
          tipo_documental_detectado: 'Escritura antecedente',
          resumen: 'Escritura antecedente de compraventa pasada el 15/03/2015.',
          datos_clave: ['Escritura antecedente 15/03/2015'],
          fechas_plazos: [
            { descripcion: 'Escritura antecedente de compraventa', fecha: '2015-03-15', tipo: 'issue_date', confianza: 'alta', requiere_revision: false, evidencia_textual: '15 de marzo de 2015' },
          ],
        },
      },
      {
        case_id: CASE_PALERMO_ID,
        document_id: DOC_CERTIFICADOS_ID,
        organization_id: ORG_ESC_ID,
        output_type: 'document_analysis',
        content: 'Análisis documental certificados',
        model_name: 'test-model',
        result_json: {
          tipo_documental_detectado: 'Certificados notariales',
          resumen: 'Certificado catastral vigente hasta 20/10/2026 e informe de dominio vigente hasta 01/11/2026.',
          datos_clave: ['Catastral 20/10/2026', 'Dominio 01/11/2026'],
          fechas_plazos: [
            { descripcion: 'Vencimiento Certificado Catastral', fecha: '2026-10-20', tipo: 'document_expiration', confianza: 'alta', requiere_revision: false, evidencia_textual: '20 de octubre de 2026' },
            { descripcion: 'Vencimiento Certificado Dominio', fecha: '2026-11-01', tipo: 'document_expiration', confianza: 'alta', requiere_revision: false, evidencia_textual: '1 de noviembre de 2026' },
          ],
        },
      },
    ]);

    const { context, page } = await loginAs(browser, 'admin.esc@test.com');
    try {
      // 5. Inspeccionar legajo: Radar de plazos derivado matemáticamente (10/06 + 90d = 08/09)
      await page.goto(`/expedientes/${CASE_PALERMO_ID}`);
      await expect(page.locator('body')).toBeVisible();

      // Radar scoped: exactamente 1 Fecha límite contractual (08/09/2026) y 1 Fecha tentativa de escritura (10/09/2026)
      const radarSection = page.locator('section[data-testid="radar-plazos"]');
      await expect(radarSection).toBeVisible();

      const itemLimite = radarSection.locator('li:has-text("Fecha límite contractual")');
      await expect(itemLimite).toHaveCount(1);
      await expect(itemLimite).toContainText('08/09/2026');

      const itemTentativa = radarSection.locator('li:has-text("Fecha tentativa de escritura")');
      await expect(itemTentativa).toHaveCount(1);
      await expect(itemTentativa).toContainText('10/09/2026');

      // Boleto 10/06/2026 y antecedente 15/03/2015 deben estar ausentes del Radar
      const radarText = await radarSection.innerText();
      expect(radarText).not.toContain('10/06/2026');
      expect(radarText).not.toContain('15/03/2015');

      // Cargar plazo derivado a la Agenda desde el Radar de plazos (botón visible obligatorio)
      const btnCargarAgenda = itemLimite.locator('button:has-text("Cargar a agenda")');
      await expect(btnCargarAgenda).toBeVisible();
      await btnCargarAgenda.click();
      await expect(itemLimite).toContainText(/agenda/i);

      // 6. Accionar UI: Generar resumen con IA
      const btnResumen = page.locator('button:has-text("Generar resumen con IA"), button:has-text("Actualizar resumen con IA")').first();
      await expect(btnResumen).toBeVisible();
      await btnResumen.click();

      // Verificar que el resumen computa 90 días corridos y 2 días de exceso
      await expect(page.locator('body')).toContainText('90 días corridos');
      await expect(page.locator('body')).toContainText('2 días corridos');

      // 7. Accionar UI: Cotejo de documentos con IA
      const btnCotejo = page.locator('button:has-text("Cotejar documentos con IA"), button:has-text("Volver a cotejar")').first();
      await expect(btnCotejo).toBeVisible();
      await btnCotejo.click();

      // Verificar aserciones scoped de discrepancias y vigencias en Cotejo
      const cotejoDiscrepancias = page.locator('[data-testid="cotejo-discrepancias"]');
      await expect(cotejoDiscrepancias).toContainText('Plazo contractual: la fecha tentativa de escritura (10/09/2026) supera el límite contractual (08/09/2026) por 2 días corridos.');

      const cotejoVigencias = page.locator('[data-testid="cotejo-vigencias"]');
      await expect(cotejoVigencias).toContainText('La fecha tentativa de escritura (10/09/2026) excede el plazo máximo de 90 días corridos, cuyo límite es el 08/09/2026.');

      // 8. Accionar UI: Redactar borrador de escritura
      const btnBorrador = page.locator('button:has-text("Redactar borrador de escritura"), button:has-text("Regenerar borrador")').first();
      await expect(btnBorrador).toBeVisible();
      await btnBorrador.click();

      // Verificar cláusula UIF autónoma, leyenda de ITI derogada, y preservación de COTI
      await expect(page.locator('body')).toContainText('MEDIOS DE PAGO Y ORIGEN DE FONDOS');
      await expect(page.locator('body')).toContainText('[COMPLETAR/VERIFICAR: declaración y documentación respaldatoria sobre medios y origen de fondos]');
      await expect(page.locator('body')).toContainText('I.T.I.: No resulta aplicable por encontrarse derogado conforme Ley 27.743 para operaciones otorgadas a partir del 08/07/2024.');

      const bodyFinal = await page.locator('body').innerText();
      expect(bodyFinal.toLowerCase()).not.toContain('fondos de lícito origen');
      expect(bodyFinal.toLowerCase()).not.toContain('fondos de origen lícito');
      expect(bodyFinal.toLowerCase()).not.toContain('los fondos provienen de');
      expect(bodyFinal).not.toContain('retención del Impuesto a la Transferencia de Inmuebles');
      expect(bodyFinal).not.toContain('23.282');
      expect(bodyFinal).not.toContain('25.093');
      expect(bodyFinal).toContain('Impuesto a las Ganancias');
      expect(bodyFinal).toContain('C.O.T.I. N° 98765432');

      // Verificar ordinales femeninos reales en el bloque <pre> del borrador
      const preBorrador = page.locator('pre').first();
      await expect(preBorrador).toBeVisible();
      const preText = await preBorrador.innerText();

      const contarOrdinal = (ordinal: string) => {
        const re = new RegExp(`(?:^|\\n)\\s*${ordinal}:\\s`, 'gm');
        return (preText.match(re) || []).length;
      };

      expect(contarOrdinal('PRIMERA')).toBe(1);
      expect(contarOrdinal('SEGUNDA')).toBe(1);
      expect(contarOrdinal('TERCERA')).toBe(1);
      expect(contarOrdinal('CUARTA')).toBe(1);
      expect(contarOrdinal('QUINTA')).toBe(1);
      expect(contarOrdinal('SEXTA')).toBe(1);
      expect(contarOrdinal('SÉPTIMA')).toBe(1);
      expect(contarOrdinal('OCTAVA')).toBe(1);

      // CUARTA asignada autónomamente a MEDIOS DE PAGO Y ORIGEN DE FONDOS
      expect(preText).toMatch(/(?:^|\n)\s*CUARTA:\s*MEDIOS DE PAGO Y ORIGEN DE FONDOS\b/i);

      // Verificar orden relativo ascendente en el texto del pre
      const pos1 = preText.search(/(?:^|\n)\s*PRIMERA:\s/);
      const pos2 = preText.search(/(?:^|\n)\s*SEGUNDA:\s/);
      const pos3 = preText.search(/(?:^|\n)\s*TERCERA:\s/);
      const pos4 = preText.search(/(?:^|\n)\s*CUARTA:\s/);
      const pos5 = preText.search(/(?:^|\n)\s*QUINTA:\s/);
      const pos6 = preText.search(/(?:^|\n)\s*SEXTA:\s/);
      const pos7 = preText.search(/(?:^|\n)\s*SÉPTIMA:\s/);
      const pos8 = preText.search(/(?:^|\n)\s*OCTAVA:\s/);
      expect(pos1).toBeGreaterThanOrEqual(0);
      expect(pos2).toBeGreaterThan(pos1);
      expect(pos3).toBeGreaterThan(pos2);
      expect(pos4).toBeGreaterThan(pos3);
      expect(pos5).toBeGreaterThan(pos4);
      expect(pos6).toBeGreaterThan(pos5);
      expect(pos7).toBeGreaterThan(pos6);
      expect(pos8).toBeGreaterThan(pos7);

      // 9. Inspeccionar Observaciones
      await page.goto('/observaciones');
      await expect(page.locator('body')).toBeVisible();
      const obsText = await page.locator('body').innerText();

      expect(obsText).toContain('08/09/2026');
      expect(obsText).toContain('10/09/2026');
      expect(obsText).toContain('Fecha límite contractual');
      expect(obsText).toContain('Fecha tentativa de escritura');

      // El link de la tarjeta lleva exactamente a /expedientes/[id]
      const linkExp = page.locator(`a[href="/expedientes/${CASE_PALERMO_ID}"]`);
      await expect(linkExp.first()).toBeVisible();

      // 10. Inspeccionar Agenda: evento vinculado con categoría plazo
      await page.goto('/agenda');
      await expect(page.locator('body')).toBeVisible();

      // Formulario de nuevo evento: opción plazo disponible y no oculta en escribanía
      await page.locator('button:has-text("Nuevo evento")').click();
      await expect(page.locator('select[data-testid="agenda-categoria"] option[value="plazo"]')).toBeAttached();
      await page.locator('button:has-text("Nuevo evento")').click();

      // Evento de plazo en la lista del mes con categoría plazo (no degradado a Recordatorio)
      await expect(page.locator('body')).toContainText('Fecha límite contractual');

      // Abrir modal de detalle del plazo
      await page.locator('button:has-text("Fecha límite contractual")').first().click();
      await expect(page.locator('body')).toContainText('America/Argentina/Buenos_Aires');

      // Preservación de enlace al legajo (/expedientes/[id])
      const linkAgendaExp = page.locator(`a[href="/expedientes/${CASE_PALERMO_ID}"]`);
      await expect(linkAgendaExp.first()).toBeVisible();

      // Al entrar en edición: la categoría seleccionada es plazo y caseId inferido
      await page.locator('[data-testid="agenda-editar-btn"]').click();
      await expect(page.locator('[data-testid="agenda-edit-categoria"]')).toBeVisible();
      await expect(page.locator('[data-testid="agenda-edit-categoria"]')).toHaveValue('plazo');
      await expect(page.locator('[data-testid="agenda-edit-categoria"] option[value="plazo"]')).toBeAttached();
      await expect(page.locator('[data-testid="agenda-edit-case-select"]')).toHaveValue(CASE_PALERMO_ID);
    } finally {
      await page.close();
      await context.close();
    }
  });
});
