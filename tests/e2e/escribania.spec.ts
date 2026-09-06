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
    // 1. Sembrar legajo Palermo Cuba y su documento
    await serviceClient.from('cases').upsert({
      id: CASE_PALERMO_ID,
      organization_id: ORG_ESC_ID,
      title: 'Compraventa Depto Palermo Cuba',
      case_type: 'Escritura',
      status: 'active',
      client_name: 'Comprador Palermo',
      metadata: {
        tipo_acto: 'Compraventa',
        fecha_boleto: '2026-06-10',
        plazo_dias: 90,
        fecha_otorgamiento: '2026-09-10',
      },
      created_by: 'cccc3333-3333-3333-3333-333333333333',
    });

    await serviceClient.from('documents').upsert({
      id: DOC_PALERMO_ID,
      case_id: CASE_PALERMO_ID,
      organization_id: ORG_ESC_ID,
      file_name: 'boleto_compraventa_palermo.pdf',
      file_path: `${ORG_ESC_ID}/${CASE_PALERMO_ID}/boleto_compraventa_palermo.pdf`,
      file_size: 1024,
      file_mime_type: 'application/pdf',
      file_hash: 'hash-palermo-boleto',
      uploaded_by: 'cccc3333-3333-3333-3333-333333333333',
    });

    // 2. Sembrar análisis documental, resumen ejecutivo, cotejo y borrador de escritura
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
          datos_clave: ['Boleto 10/06/2026', 'Plazo 90 días corridos', 'USD 150.000'],
          fechas_plazos: [
            { descripcion: 'Fecha del boleto', fecha: '2026-06-10', tipo: 'issue_date', confianza: 'alta', requiere_revision: false, evidencia_textual: '10 de junio de 2026' },
            { descripcion: 'Fecha límite contractual', fecha: '2026-09-08', tipo: 'contractual_deadline', confianza: 'alta', requiere_revision: false, evidencia_textual: '90 días corridos' },
            { descripcion: 'Fecha tentativa de escritura', fecha: '2026-09-10', tipo: 'contractual_deadline', confianza: 'alta', requiere_revision: false, evidencia_textual: '10 de septiembre de 2026' }
          ]
        }
      },
      {
        case_id: CASE_PALERMO_ID,
        document_id: null,
        organization_id: ORG_ESC_ID,
        output_type: 'case_summary',
        content: 'Resumen ejecutivo Palermo',
        model_name: 'test-model',
        result_json: {
          resumen_general: 'El presente legajo instrumenta la compraventa de un inmueble en Palermo. Se advierte que la fecha tentativa de escrituración (10/09/2026) excede el plazo contractual de 90 días corridos (límite: 08/09/2026) por 2 días corridos.',
          estado_actual: 'En etapa notarial preparatoria.',
          partes: ['Comprador Palermo', 'Vendedor Palermo'],
          puntos_clave: ['Boleto 10/06/2026', 'Límite contractual 08/09/2026', 'Fecha tentativa 10/09/2026'],
          riesgos_alertas: ['La fecha tentativa de escrituración (10/09/2026) excede el plazo contractual de 90 días corridos (límite: 08/09/2026) por 2 días corridos.'],
          proximas_acciones: ['Gestionar adenda de prórroga o coordinar otorgamiento inmediato.']
        }
      },
      {
        case_id: CASE_PALERMO_ID,
        document_id: null,
        organization_id: ORG_ESC_ID,
        output_type: 'case_cotejo',
        content: 'Cotejo documental Palermo',
        model_name: 'test-model',
        result_json: {
          veredicto: 'Cotejo con observaciones sobre plazos contractuales.',
          coincidencias: ['Identidad de comparecientes e inmueble conforme boleto'],
          discrepancias: ['Plazo contractual: la fecha tentativa (10/09/2026) supera el límite de escrituración (08/09/2026) fijado en el boleto por 2 días corridos.'],
          faltantes: ['Documentación respaldatoria sobre origen y licitud de fondos'],
          alertas_vigencia: ['La fecha tentativa de escrituración (10/09/2026) excede el plazo contractual de 90 días corridos (límite: 08/09/2026) por 2 días corridos.']
        }
      },
      {
        case_id: CASE_PALERMO_ID,
        document_id: null,
        organization_id: ORG_ESC_ID,
        output_type: 'case_escritura',
        content: 'Borrador de escritura con guardrail UIF aplicado',
        model_name: 'test-model',
        result_json: {
          titulo: 'Borrador de escritura de compraventa',
          cuerpo: 'En la Ciudad Autónoma de Buenos Aires. Comparecen las partes. Precio y forma de pago: La parte compradora abona la suma pactada en dinero en efectivo.\n\nORIGEN DE FONDOS Y PLA/FT: [COMPLETAR/VERIFICAR: declaración y documentación respaldatoria sobre medios y origen de fondos].\n\nAsimismo, se hace entrega de la posesión real y definitiva.',
          datos_faltantes: ['[COMPLETAR/VERIFICAR: declaración y documentación respaldatoria sobre medios y origen de fondos]'],
          advertencias: ['Revisión profesional requerida: no consta documentación respaldatoria estructurada sobre origen y licitud de fondos. Las operaciones y personas de prueba son ficticias (entorno controlado).']
        }
      }
    ]);

    const { context, page } = await loginAs(browser, 'admin.esc@test.com');
    try {
      // 3. Inspeccionar legajo: Resumen, Cotejo, Radar y Borrador de escritura
      await page.goto(`/expedientes/${CASE_PALERMO_ID}`);
      await expect(page.locator('body')).toBeVisible();
      const bodyText = await page.locator('body').innerText();

      // Resumen: 90 días corridos y exceso de 2 días
      expect(bodyText).toContain('90 días corridos');
      expect(bodyText).toContain('2 días corridos');

      // Cotejo: fechas clave 08/09/2026 y 10/09/2026
      expect(bodyText).toContain('08/09/2026');
      expect(bodyText).toContain('10/09/2026');

      // Radar: 08/09 y 10/09 presentes con etiquetas distintas, 10/06 ausente como plazo
      expect(bodyText).toContain('Fecha límite contractual');
      expect(bodyText).toContain('Fecha tentativa de escritura');
      expect(bodyText).not.toContain('Fecha del boleto · 10/06/2026');

      // Borrador de escritura: guardrail UIF sin afirmación positiva y con placeholder presente
      expect(bodyText).toContain('[COMPLETAR/VERIFICAR: declaración y documentación respaldatoria sobre medios y origen de fondos]');
      expect(bodyText.toLowerCase()).not.toContain('fondos de lícito origen');
      expect(bodyText.toLowerCase()).not.toContain('fondos de origen lícito');

      // 4. Inspeccionar Observaciones
      await page.goto('/observaciones');
      await expect(page.locator('body')).toBeVisible();
      const obsText = await page.locator('body').innerText();

      // Fechas clave notariales > 0 y etiquetas diferenciadas
      expect(obsText).toContain('08/09/2026');
      expect(obsText).toContain('10/09/2026');
      expect(obsText).toContain('Fecha límite contractual');
      expect(obsText).toContain('Fecha tentativa de escritura');
    } finally {
      await page.close();
      await context.close();
    }
  });
});
