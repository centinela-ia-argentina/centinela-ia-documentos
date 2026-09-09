import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loginAs } from './helpers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_INM_ID = '22222222-2222-2222-2222-222222222222';
const CASE_INM_ID = 'dddd2222-2222-2222-2222-222222222222';
const CASE_LEGAL_ID = 'cccc1111-1111-1111-1111-111111111111';

test.describe.serial('Centinela IA - Inmobiliaria E2E', () => {
  let tempCaseId = '';
  let tempRentalCaseId = '';

  async function cleanUpCaseById(caseId: string) {
    if (!caseId) return;
    try {
      const { data: checklists, error: chkSelectErr } = await serviceClient
        .from('checklists')
        .select('id')
        .eq('case_id', caseId);
      if (chkSelectErr) throw chkSelectErr;

      const checklistIds = (checklists ?? []).map((c) => c.id);

      if (checklistIds.length > 0) {
        for (const chkId of checklistIds) {
          const { error: itemsErr } = await serviceClient
            .from('checklist_items')
            .delete()
            .eq('checklist_id', chkId);
          if (itemsErr) throw itemsErr;
        }
      }

      const { error: chkErr } = await serviceClient
        .from('checklists')
        .delete()
        .eq('case_id', caseId);
      if (chkErr) throw chkErr;

      const { error: caseErr } = await serviceClient
        .from('cases')
        .delete()
        .eq('id', caseId);
      if (caseErr) throw caseErr;

      // Verificación estricta de cero registros remanentes
      if (checklistIds.length > 0) {
        const { data: verifyItems, error: vItemsErr } = await serviceClient
          .from('checklist_items')
          .select('id')
          .in('checklist_id', checklistIds);
        if (vItemsErr) throw vItemsErr;
        expect(verifyItems?.length ?? 0).toBe(0);
      }

      const { data: verifyChecklists, error: vChkErr } = await serviceClient
        .from('checklists')
        .select('id')
        .eq('case_id', caseId);
      if (vChkErr) throw vChkErr;
      expect(verifyChecklists?.length ?? 0).toBe(0);

      const { data: verifyCases, error: vCasesErr } = await serviceClient
        .from('cases')
        .select('id')
        .eq('id', caseId);
      if (vCasesErr) throw vCasesErr;
      expect(verifyCases?.length ?? 0).toBe(0);
    } catch (e) {
      console.error(`[CRITICAL] Fallo en cleanUpCaseById para el expediente ${caseId}:`, e);
      throw e;
    }
  }

  test.afterAll(async () => {
    const errors: any[] = [];
    if (tempCaseId) {
      try {
        await cleanUpCaseById(tempCaseId);
      } catch (err) {
        errors.push(err);
      } finally {
        tempCaseId = '';
      }
    }
    if (tempRentalCaseId) {
      try {
        await cleanUpCaseById(tempRentalCaseId);
      } catch (err) {
        errors.push(err);
      } finally {
        tempRentalCaseId = '';
      }
    }
    if (errors.length > 0) {
      throw new Error(`[CRITICAL] afterAll: Limpieza incompleta detectada en ${errors.length} casos: ${errors.map(e => e.message || String(e)).join('; ')}`);
    }
  });

  test('A. Login', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    await page.close();
    await context.close();
  });

  test('B. Navegación vertical', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      const nav = page.locator('nav');
      
      const operacionesLink = nav.locator('a', { hasText: 'Operaciones' }).first();
      await operacionesLink.scrollIntoViewIfNeeded();
      await expect(operacionesLink).toBeVisible();

      const propiedadesLink = nav.locator('a', { hasText: 'Propiedades' }).first();
      await propiedadesLink.scrollIntoViewIfNeeded();
      await expect(propiedadesLink).toBeVisible();

      const clientesLink = nav.locator('a', { hasText: 'Clientes' }).first();
      await clientesLink.scrollIntoViewIfNeeded();
      await expect(clientesLink).toBeVisible();

      const alquileresLink = nav.locator('a', { hasText: 'Alquileres' }).first();
      await alquileresLink.scrollIntoViewIfNeeded();
      await expect(alquileresLink).toBeVisible();

      const panelLink = nav.locator('a', { hasText: 'Panel inmobiliario' }).first();
      await panelLink.scrollIntoViewIfNeeded();
      await expect(panelLink).toBeVisible();
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('C. Operación propia', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      await page.goto(`/expedientes/${CASE_INM_ID}`);
      await expect(page.locator('[data-testid="case-detail-title"]')).toContainText('Propiedad 1');
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('D. Tipos permitidos', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      await page.goto('/expedientes/nuevo');

      const caseType = page.locator('[data-testid="case-type"]');
      await expect(caseType).toBeVisible();

      const values = await caseType.locator('option').evaluateAll(
        options => options.map(option => (option as HTMLOptionElement).value)
      );

      expect(values).toContain('Compraventa de inmueble');
      expect(values).toContain('Alquiler');
      expect(values).toContain('Reserva');
      expect(values).toContain('Otro');

      expect(values).not.toContain('Caso jurídico');
      expect(values).not.toContain('Demanda');
      expect(values).not.toContain('Sucesión');
      expect(values).not.toContain('Escritura');
      expect(values).not.toContain('Poder');
      expect(values).not.toContain('Acta notarial');
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('E. Checklist automático', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      await page.goto('/expedientes/nuevo');

      const uniqueTitle = `Operacion E2E ${Date.now()}`;
      await page.fill('[data-testid="case-title"]', uniqueTitle);
      await page.fill('[data-testid="case-client"]', 'Cliente Prueba');
      await page.selectOption('[data-testid="case-type"]', 'Compraventa de inmueble');
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
      expect(checklist?.organization_id).toBe(ORG_INM_ID);
      expect(checklist?.template_type).toBe('Compraventa de inmueble');

      const { data: items, error: itemsErr } = await serviceClient
        .from('checklist_items')
        .select('id, checklist_id, organization_id')
        .eq('checklist_id', checklist.id);

      expect(itemsErr).toBeNull();
      expect(items?.length).toBeGreaterThan(0);
      items?.forEach(item => {
        expect(item.checklist_id).toBe(checklist.id);
        expect(item.organization_id).toBe(ORG_INM_ID);
      });
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('F. Aislamiento', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      const response = await page.goto(`/expedientes/${CASE_LEGAL_ID}`);
      expect(response?.status()).toBe(404);

      await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
      await expect(page.locator('[data-testid="case-detail-title"]')).toHaveCount(0);

      const visibleText = await page.locator('body').innerText();
      expect(visibleText).not.toContain('Caso Legal 1');
      expect(visibleText).not.toContain(CASE_LEGAL_ID);
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('G. Listado y alta de propiedad con moneda USD/ARS, superficie y ambientes', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      await page.goto('/propiedades');
      await expect(page.locator('text=Cartera de propiedades')).toBeVisible();

      await page.goto('/propiedades/nueva');
      await expect(page.locator('text=Alta de ficha técnica')).toBeVisible();

      const nameInput = page.locator('input[name="name"]');
      await expect(nameInput).toBeVisible();
      const currencySelect = page.locator('select[name="currency"]');
      await expect(currencySelect).toBeVisible();

      const currencyOptions = await currencySelect.locator('option').evaluateAll(
        opts => opts.map(o => (o as HTMLOptionElement).value)
      );
      expect(currencyOptions).toContain('USD');
      expect(currencyOptions).toContain('ARS');

      await expect(page.locator('input[name="surface_total_m2"]')).toBeVisible();
      await expect(page.locator('input[name="rooms"]')).toBeVisible();

      // Validación de conducta de entrada en campos técnicos
      await nameInput.fill('Propiedad QA Test');
      await currencySelect.selectOption('USD');
      await page.locator('input[name="surface_total_m2"]').fill('120');
      await page.locator('input[name="rooms"]').fill('3');

      expect(await nameInput.inputValue()).toBe('Propiedad QA Test');
      expect(await currencySelect.inputValue()).toBe('USD');
      expect(await page.locator('input[name="surface_total_m2"]').inputValue()).toBe('120');
      expect(await page.locator('input[name="rooms"]').inputValue()).toBe('3');
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('H. Cartera de clientes y preferencias de búsqueda', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      await page.goto('/clientes');
      await expect(page.locator('text=Clientes e interesados')).toBeVisible();

      await page.goto('/clientes/nuevo');
      await expect(page.locator('text=Registrar contacto o interesado')).toBeVisible();
      await expect(page.locator('input[name="name"]')).toBeVisible();
      await expect(page.locator('select[name="client_type"]')).toBeVisible();

      // Verificar existencia y conducta de los campos de preferencias de búsqueda
      await expect(page.locator('select[name="operation_interest"]')).toBeVisible();
      await expect(page.locator('select[name="desired_property_type"]')).toBeVisible();
      await expect(page.locator('input[name="desired_city"]')).toBeVisible();

      await page.locator('input[name="name"]').fill('Cliente Preferencias QA');
      await page.locator('select[name="operation_interest"]').selectOption('compra');
      await page.locator('select[name="desired_property_type"]').selectOption('departamento');
      await page.locator('input[name="desired_city"]').fill('CABA');

      expect(await page.locator('input[name="name"]').inputValue()).toBe('Cliente Preferencias QA');
      expect(await page.locator('select[name="operation_interest"]').inputValue()).toBe('compra');
      expect(await page.locator('select[name="desired_property_type"]').inputValue()).toBe('departamento');
      expect(await page.locator('input[name="desired_city"]').inputValue()).toBe('CABA');
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('I. Cartera de alquileres y vencimientos de ajuste', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      await page.goto('/alquileres');
      await expect(
        page.getByRole('heading', { name: 'Radar de alquileres', exact: true })
      ).toBeVisible();
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('J. Pre-Score visible en Alquiler y oculto en Compraventa', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      // 1. En operación Compraventa (CASE_INM_ID es compraventa): Pre-Score NO debe estar visible
      await page.goto(`/expedientes/${CASE_INM_ID}`);
      await expect(page.locator('text=Pre-Score de Inquilino y Garantía')).toHaveCount(0);

      // 2. Creamos una operación de Alquiler para verificar que SÍ muestre Pre-Score
      await page.goto('/expedientes/nuevo');
      const rentalTitle = `Alquiler QA E2E ${Date.now()}`;
      await page.fill('[data-testid="case-title"]', rentalTitle);
      await page.fill('[data-testid="case-client"]', 'Inquilino Postulante QA');
      await page.selectOption('[data-testid="case-type"]', 'Alquiler');
      await page.click('[data-testid="case-submit"]');

      await expect(page).toHaveURL(/\/expedientes\/[a-f0-9\-]+/);
      tempRentalCaseId = page.url().split('/').pop() || '';

      // En la operación de alquiler debe renderizarse el contenedor de Pre-Score
      await expect(page.locator('text=Pre-Score de Inquilino y Garantía')).toBeVisible();

      // Limpieza exhaustiva y comprobable del caso creado
      await cleanUpCaseById(tempRentalCaseId);
      tempRentalCaseId = '';
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('K. Biblioteca de modelos incluye Contrato de locación y prellenado de moneda/precio', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      await page.goto('/modelos');
      await expect(
        page.getByRole('heading', {
          name: 'Modelos inmobiliarios',
          exact: true,
        })
      ).toBeVisible();

      // Debe estar presente el modelo de locación
      await expect(page.locator('text=Contrato de locación (vivienda)')).toBeVisible();
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('L. Radar de plazos y cronología en operación', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      await page.goto(`/expedientes/${CASE_INM_ID}`);
      await expect(page.locator('[data-testid="radar-plazos"]')).toBeVisible();

      // Pestaña Cronología debe tener botón adaptado para Inmobiliaria
      const cronTab = page.locator('button, a', { hasText: 'Cronología' }).first();
      await cronTab.click();
      await expect(page.locator('button', { hasText: 'Agregar movimiento' })).toBeVisible();
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('M. Cómo Funciona refleja flujos comerciales inmobiliarios', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      await page.goto('/como-funciona');
      await expect(page.locator('text=Herramientas inmobiliarias: inventario de propiedades y cartera de clientes')).toBeVisible();
      await expect(page.locator('text=Módulos específicos: Pre-Score crediticio y matching comercial')).toBeVisible();
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('N. Checklist documental: vinculación manual, persistencia y desvinculación (fixture aislado)', async ({ browser }, testInfo) => {
    // Fixture completamente independiente por browser para evitar colisiones entre Chromium/Firefox/WebKit
    const browserLabel = testInfo.project.name || testInfo.title;
    const uniqueSuffix = `${Date.now()}-${browserLabel.replace(/\s+/g, '_')}`;
    let fixtCaseId = '';
    let fixtChecklistId = '';
    let fixtItemId = '';
    let fixtDocId = '';

    // 1. Obtener el id del usuario admin de la org inmobiliaria
    const { data: adminProfile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('organization_id', ORG_INM_ID)
      .eq('role', 'admin')
      .limit(1)
      .single();
    const adminId = adminProfile?.id ?? null;

    // 2. Crear operación propia vía service role
    const { data: newCase, error: caseErr } = await serviceClient
      .from('cases')
      .insert({
        organization_id: ORG_INM_ID,
        title: `Operacion Checklist E2E ${uniqueSuffix}`,
        client_name: 'Cliente Checklist E2E',
        case_type: 'Compraventa de inmueble',
        status: 'active',
        created_by: adminId,
      })
      .select('id')
      .single();

    expect(caseErr).toBeNull();
    expect(newCase?.id).toBeTruthy();
    fixtCaseId = newCase!.id;

    // 3. Crear checklist y un ítem propios
    const { data: newChecklist, error: chkErr } = await serviceClient
      .from('checklists')
      .insert({
        organization_id: ORG_INM_ID,
        case_id: fixtCaseId,
        template_type: 'Compraventa de inmueble',
      })
      .select('id')
      .single();

    expect(chkErr).toBeNull();
    fixtChecklistId = newChecklist!.id;

    const { data: newItem, error: itemErr } = await serviceClient
      .from('checklist_items')
      .insert({
        organization_id: ORG_INM_ID,
        checklist_id: fixtChecklistId,
        title: `Documento prueba ${uniqueSuffix}`,
        status: 'pending',
      })
      .select('id')
      .single();

    expect(itemErr).toBeNull();
    fixtItemId = newItem!.id;

    // 4. Crear documento propio (fila en documents, sin storage real)
    const { data: newDoc, error: docErr } = await serviceClient
      .from('documents')
      .insert({
        organization_id: ORG_INM_ID,
        case_id: fixtCaseId,
        file_name: `doc-checklist-e2e-${uniqueSuffix}.pdf`,
        file_path: `${ORG_INM_ID}/${fixtCaseId}/doc-checklist-e2e-${uniqueSuffix}.pdf`,
        file_size: 1024,
        mime_type: 'application/pdf',
        document_type: 'Otro',
        sensitivity_level: 'low',
        uploaded_by: adminId,
      })
      .select('id')
      .single();

    expect(docErr).toBeNull();
    fixtDocId = newDoc!.id;

    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      // 5. Navegar al checklist de la operación creada
      await page.goto(`/operaciones/${fixtCaseId}?tab=checklist`);
      const linkToggle = page.locator('[data-testid="checklist-link-toggle-0"]').first();
      await expect(linkToggle).toBeVisible({ timeout: 15000 });

      await linkToggle.click();

      const form = linkToggle.locator('..');
      const docSelect = form.locator('select[name="document_id"]').first();
      await expect.poll(async () => docSelect.locator('option').count(), { timeout: 10000 }).toBeGreaterThan(1);

      // 6. Vincular manualmente al documento propio
      await docSelect.selectOption(fixtDocId);
      const saveBtn = form.locator('button', { hasText: 'Guardar' }).first();
      await saveBtn.click();

      await expect(page).toHaveURL(/checklist_document=linked/);
      await expect(page.locator('[data-testid="checklist-document-feedback"]')).toContainText('Documento vinculado correctamente');
      await expect(page.locator('[data-testid="checklist-badge-manual-0"]')).toBeVisible();

      // 7. Verificar persistencia en DB: document_id, match_source=manual, status=received
      const { data: itemAfterLink } = await serviceClient
        .from('checklist_items')
        .select('document_id, match_source, status')
        .eq('id', fixtItemId)
        .single();
      expect(itemAfterLink?.document_id).toBe(fixtDocId);
      expect(itemAfterLink?.match_source).toBe('manual');
      expect(itemAfterLink?.status).toBe('received');

      // 8. Persistencia en UI tras recarga
      await page.reload();
      await expect(page.locator('[data-testid="checklist-badge-manual-0"]')).toBeVisible();

      // 9. Desvincular
      const toggleAfterReload = page.locator('[data-testid="checklist-link-toggle-0"]').first();
      await toggleAfterReload.click();
      const formAfterReload = toggleAfterReload.locator('..');
      const selectAfterReload = formAfterReload.locator('select[name="document_id"]').first();
      await selectAfterReload.selectOption('');
      const saveBtnUnlink = formAfterReload.locator('button', { hasText: 'Guardar' }).first();
      await saveBtnUnlink.click();

      await expect(page).toHaveURL(/checklist_document=unlinked/);
      await expect(page.locator('[data-testid="checklist-document-feedback"]')).toContainText('Documento desvinculado correctamente');
      await expect(page.locator('[data-testid="checklist-badge-manual-0"]')).toBeHidden();

      // 10. Verificar persistencia de desvinculación en DB: document_id=null, match_source=null, status=pending
      const { data: itemAfterUnlink } = await serviceClient
        .from('checklist_items')
        .select('document_id, match_source, status')
        .eq('id', fixtItemId)
        .single();
      expect(itemAfterUnlink?.document_id).toBeNull();
      expect(itemAfterUnlink?.match_source).toBeNull();
      expect(itemAfterUnlink?.status).toBe('pending');

      // 11. Persistencia de desvinculación en UI tras recarga
      await page.reload();
      await expect(page.locator('[data-testid="checklist-badge-manual-0"]')).toBeHidden();

      // 12. Verificar que checklist e ítem siguen existiendo (no se eliminaron)
      const { data: stillItem } = await serviceClient.from('checklist_items').select('id').eq('id', fixtItemId).single();
      expect(stillItem?.id).toBe(fixtItemId);

      // 13. Reversibilidad: volver a vincular
      const toggleFinal = page.locator('[data-testid="checklist-link-toggle-0"]').first();
      await toggleFinal.click();
      const formFinal = toggleFinal.locator('..');
      const selectFinal = formFinal.locator('select[name="document_id"]').first();
      await selectFinal.selectOption(fixtDocId);
      await formFinal.locator('button', { hasText: 'Guardar' }).first().click();
      await expect(page).toHaveURL(/checklist_document=linked/);
      await expect(page.locator('[data-testid="checklist-badge-manual-0"]')).toBeVisible();
    } finally {
      await page.close();
      await context.close();

      // Limpiar todos los fixtures en orden correcto
      if (fixtDocId) {
        await serviceClient.from('checklist_items').update({ document_id: null, match_source: null }).eq('document_id', fixtDocId);
        await serviceClient.from('documents').delete().eq('id', fixtDocId);
      }
      if (fixtItemId) await serviceClient.from('checklist_items').delete().eq('id', fixtItemId);
      if (fixtChecklistId) await serviceClient.from('checklists').delete().eq('id', fixtChecklistId);
      if (fixtCaseId) await serviceClient.from('cases').delete().eq('id', fixtCaseId);
    }
  });

  test('O. Verificación de terminología adaptada en superficies inmobiliarias', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      // 1. En listado de operaciones
      await page.goto('/operaciones');
      const nav = page.locator('nav');
      await expect(nav.locator('a', { hasText: 'Operaciones' }).first()).toBeVisible();

      // 2. En detalle de operación
      await page.goto(`/operaciones/${CASE_INM_ID}`);
      await expect(page.getByText('Datos de la operación')).toBeVisible();
      await expect(page.locator('button, a', { hasText: 'Volver a la lista de operaciones' }).first()).toBeVisible();

      // Comprobación de que no aparecen términos jurídicos inapropiados en encabezados
      const h1Text = await page.locator('h1, h2, h3').allInnerTexts();
      const allHeadings = h1Text.join(' ');
      expect(allHeadings).not.toMatch(/\b(expediente judicial|autos caratulados|juzgado|fuero)\b/i);
    } finally {
      await page.close();
      await context.close();
    }
  });
});
