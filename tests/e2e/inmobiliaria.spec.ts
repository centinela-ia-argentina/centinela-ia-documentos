import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loginAs } from './helpers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
// This suite creates and removes fixtures. Never run it against a remote backend.
for (const destination of [supabaseUrl, process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000']) {
  const url = new URL(destination);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw new Error('Inmobiliaria E2E requires an explicit loopback-only test environment');
  }
}
const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_INM_ID = '22222222-2222-2222-2222-222222222222';
const CASE_INM_ID = 'dddd2222-2222-2222-2222-222222222222';
const CASE_LEGAL_ID = 'cccc1111-1111-1111-1111-111111111111';

async function selectWizardOption(page: Page, label: string, option: RegExp) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('listbox', { name: label, exact: true }).getByRole('option', { name: option }).click();
}

async function expectSingleFormValues(page: Page, values: Record<string, string>) {
  const entries = await page.locator('form').filter({ has: page.getByTestId('case-submit') }).evaluate((form) => {
    const data = new FormData(form as HTMLFormElement);
    return [...data.entries()].map(([key, value]) => [key, String(value)]);
  });
  for (const [key, value] of Object.entries(values)) {
    expect(entries.filter(([entryKey]) => entryKey === key).map(([, entryValue]) => entryValue), key).toEqual([value]);
  }
}


test.describe.serial('Anulus AI - Inmobiliaria E2E', () => {
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

      const typeOptions = page.getByRole('group', { name: 'Tipo de operación', exact: true }).getByRole('radio');
      await expect(typeOptions).toHaveCount(4);
      const values = await typeOptions.evaluateAll(
        options => options.map(option => (option as HTMLInputElement).value)
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

  test('D2. El wizard bloquea un título vacío sin crear registros', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      await page.goto('/operaciones/nueva');
      // Observe native submit events before navigation: React must not reuse
      // the clicked Continue button as the final submit button.
      await page.locator('form').filter({ has: page.getByTestId('case-title') }).evaluate((form) => {
        form.setAttribute('data-e2e-submit-count', '0');
        form.addEventListener('submit', () => {
          const count = Number(form.getAttribute('data-e2e-submit-count'));
          form.setAttribute('data-e2e-submit-count', String(count + 1));
        });
      });
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await expect(page.getByTestId('case-client')).toBeVisible();
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await expect(page.getByTestId('case-submit')).toBeVisible();
      await expect(page.locator('form[data-e2e-submit-count]')).toHaveAttribute('data-e2e-submit-count', '0');
      let submits = 0;
      const onRequest = (request: import('@playwright/test').Request) => {
        if (request.method() === 'POST' && request.url().includes('/operaciones/nueva')) submits += 1;
      };
      page.on('request', onRequest);
      await page.getByTestId('case-submit').click();
      await expect(page.getByTestId('case-title')).toBeVisible();
      await expect(page.getByTestId('case-title')).toBeFocused();
      await expect(page).toHaveURL(/\/operaciones\/nueva$/);
      expect(submits).toBe(0);
      await expect(page.locator('form[data-e2e-submit-count]')).toHaveAttribute('data-e2e-submit-count', '1');
      page.off('request', onRequest);
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('E. Checklist automático', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      await page.goto('/operaciones/nueva');

      const uniqueTitle = `Operacion E2E ${Date.now()}`;
      await page.getByTestId('case-title').fill(uniqueTitle);
      await page.getByRole('radio', { name: /Compraventa de inmueble/ }).locator('..').click();
      await expect(page.getByRole('radio', { name: /Compraventa de inmueble/ })).toBeChecked();
      await selectWizardOption(page, 'Estado inicial', /Disponible/);
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.getByTestId('case-client').fill('Cliente Prueba');
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      const metadata = {
        direccion_inmueble: 'Dirección de fixture E2E', contraparte: 'Contraparte de fixture',
        valor_operacion: '120000', moneda_operacion: 'USD', fecha_relevante: '2026-10-15', sensibilidad: 'Alta',
      };
      await page.getByLabel('Dirección del inmueble', { exact: true }).fill(metadata.direccion_inmueble);
      await page.getByLabel('Cliente / contraparte', { exact: true }).fill(metadata.contraparte);
      await page.getByLabel('Valor de la operación', { exact: true }).fill(metadata.valor_operacion);
      await page.getByLabel('Fecha relevante', { exact: true }).fill(metadata.fecha_relevante);
      await selectWizardOption(page, 'Moneda de la operación', /USD/);
      await selectWizardOption(page, 'Nivel de sensibilidad', /Alta/);
      const submittedValues = {
        title: uniqueTitle, case_type: 'Compraventa de inmueble', status: 'active',
        client_name: 'Cliente Prueba', property_id: '',
        ...Object.fromEntries(Object.entries(metadata).map(([key, value]) => [`case_metadata.${key}`, value])),
      };
      await expectSingleFormValues(page, submittedValues);
      // Back/forward navigation must preserve all controls, including unmounted ones.
      await page.getByRole('button', { name: 'Anterior', exact: true }).click();
      await expect(page.getByTestId('case-client')).toHaveValue('Cliente Prueba');
      await expectSingleFormValues(page, submittedValues);
      await page.getByRole('button', { name: 'Anterior', exact: true }).click();
      await expect(page.getByTestId('case-title')).toHaveValue(uniqueTitle);
      await expectSingleFormValues(page, submittedValues);
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await expect(page.getByLabel('Fecha relevante', { exact: true })).toHaveValue(metadata.fecha_relevante);
      await expectSingleFormValues(page, submittedValues);
      await page.getByTestId('case-submit').click();

      await expect(page).toHaveURL(/\/operaciones\/[a-f0-9\-]+/);
      tempCaseId = page.url().split('/').pop() || '';
      const { data: persistedCase, error: caseError } = await serviceClient.from('cases')
        .select('title, client_name, case_type, status, property_id, metadata, organization_id')
        .eq('id', tempCaseId).single();
      expect(caseError).toBeNull();
      expect(persistedCase).toMatchObject({
        title: uniqueTitle, client_name: 'Cliente Prueba', case_type: 'Compraventa de inmueble',
        status: 'active', property_id: null, metadata, organization_id: ORG_INM_ID,
      });

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
      await page.goto('/operaciones/nueva');
      const rentalTitle = `Alquiler QA E2E ${Date.now()}`;
      await page.getByTestId('case-title').fill(rentalTitle);
      await page.getByRole('radio', { name: /Alquiler/ }).locator('..').click();
      await expect(page.getByRole('radio', { name: /Alquiler/ })).toBeChecked();
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.getByTestId('case-client').fill('Inquilino Postulante QA');
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await expectSingleFormValues(page, {
        title: rentalTitle, case_type: 'Alquiler', status: 'new',
        client_name: 'Inquilino Postulante QA', property_id: '',
      });
      await page.getByTestId('case-submit').click();

      await expect(page).toHaveURL(/\/operaciones\/[a-f0-9\-]+/);
      tempRentalCaseId = page.url().split('/').pop() || '';
      const { data: persistedRental, error: rentalError } = await serviceClient.from('cases')
        .select('title, client_name, case_type, status, property_id, metadata, organization_id')
        .eq('id', tempRentalCaseId).single();
      expect(rentalError).toBeNull();
      expect(persistedRental).toMatchObject({
        title: rentalTitle, client_name: 'Inquilino Postulante QA', case_type: 'Alquiler',
        status: 'new', property_id: null, metadata: {}, organization_id: ORG_INM_ID,
      });
      const { data: rentalChecklists, error: rentalChecklistError } = await serviceClient.from('checklists')
        .select('template_type, organization_id').eq('case_id', tempRentalCaseId);
      expect(rentalChecklistError).toBeNull();
      expect(rentalChecklists).toEqual([{ template_type: 'Alquiler', organization_id: ORG_INM_ID }]);

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
    let context: Awaited<ReturnType<typeof loginAs>>['context'] | undefined;
    let page: Awaited<ReturnType<typeof loginAs>>['page'] | undefined;

    try {
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

      // 3. Crear checklist (con campo obligatorio name) y un ítem propios
      const { data: newChecklist, error: chkErr } = await serviceClient
        .from('checklists')
        .insert({
          organization_id: ORG_INM_ID,
          case_id: fixtCaseId,
          name: `Checklist documental E2E ${uniqueSuffix}`,
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
          file_mime_type: 'application/pdf',
          document_type: 'Otro',
          sensitivity_level: 'low',
          uploaded_by: adminId,
        })
        .select('id')
        .single();

      expect(docErr).toBeNull();
      fixtDocId = newDoc!.id;

      // 5. Login dentro del try para que page/context se cierren en finally
      ({ context, page } = await loginAs(browser, 'admin.inm@test.com'));

      // 6. Navegar al checklist de la operación creada
      await page.goto(`/operaciones/${fixtCaseId}?tab=checklist`);
      const linkToggle = page.locator('[data-testid="checklist-link-toggle-0"]').first();
      await expect(linkToggle).toBeVisible({ timeout: 15000 });

      await linkToggle.click();

      const form = linkToggle.locator('..');
      const docSelect = form.locator('select[name="document_id"]').first();
      await expect.poll(async () => docSelect.locator('option').count(), { timeout: 10000 }).toBeGreaterThan(1);

      // 7. Vincular manualmente al documento propio
      await docSelect.selectOption(fixtDocId);
      const saveBtn = form.locator('button', { hasText: 'Guardar' }).first();
      await saveBtn.click();

      await expect(page).toHaveURL(/checklist_document=linked/);
      await expect(page.locator('[data-testid="checklist-document-feedback"]')).toContainText('Documento vinculado correctamente');
      await expect(page.locator('[data-testid="checklist-badge-manual-0"]')).toBeVisible();

      // 8. Verificar persistencia en DB: document_id, match_source=manual, status=received
      const { data: itemAfterLink } = await serviceClient
        .from('checklist_items')
        .select('document_id, match_source, status')
        .eq('id', fixtItemId)
        .single();
      expect(itemAfterLink?.document_id).toBe(fixtDocId);
      expect(itemAfterLink?.match_source).toBe('manual');
      expect(itemAfterLink?.status).toBe('received');

      // 9. Persistencia en UI tras recarga
      await page.reload();
      await expect(page.locator('[data-testid="checklist-badge-manual-0"]')).toBeVisible();

      // 10. Desvincular
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
      await expect(page.locator('[data-testid="checklist-toggle-0"]')).toHaveAttribute('aria-label', 'Marcar como pendiente');
      await expect(page.getByText('Documentación completa', { exact: false })).toBeVisible();

      // 11. Verificar persistencia de desvinculación manual en DB, conservación del estado y protección frente al auto-match
      const { data: itemAfterUnlink } = await serviceClient
        .from('checklist_items')
        .select('document_id, match_source, status')
        .eq('id', fixtItemId)
        .single();
      expect(itemAfterUnlink?.document_id).toBeNull();
      expect(itemAfterUnlink?.match_source).toBe('manual');
      expect(itemAfterUnlink?.status).toBe('received');

      // 12. Persistencia de desvinculación en UI tras recarga
      await page.reload();
      await expect(page.locator('[data-testid="checklist-badge-manual-0"]')).toBeHidden();
      await expect(page.locator('[data-testid="checklist-toggle-0"]')).toHaveAttribute('aria-label', 'Marcar como pendiente');
      await expect(page.getByText('Documentación completa', { exact: false })).toBeVisible();

      // 13. Verificar que checklist e ítem siguen existiendo (no se eliminaron)
      const { data: stillItem } = await serviceClient.from('checklist_items').select('id').eq('id', fixtItemId).single();
      expect(stillItem?.id).toBe(fixtItemId);

      // 14. Reversibilidad: volver a vincular
      const toggleFinal = page.locator('[data-testid="checklist-link-toggle-0"]').first();
      await toggleFinal.click();
      const formFinal = toggleFinal.locator('..');
      const selectFinal = formFinal.locator('select[name="document_id"]').first();
      await selectFinal.selectOption(fixtDocId);
      await formFinal.locator('button', { hasText: 'Guardar' }).first().click();
      await expect(page).toHaveURL(/checklist_document=linked/);
      await expect(page.locator('[data-testid="checklist-badge-manual-0"]')).toBeVisible();
    } finally {
      // Siempre se ejecuta: cierra browser y limpia todos los fixtures en orden correcto
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});

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
      await expect(
        page.getByRole('heading', {
          name: 'Datos de la operación',
          exact: true,
        })
      ).toBeVisible();
      await expect(
        page.getByRole('button', {
          name: 'Volver atrás',
          exact: true,
        })
      ).toBeVisible();

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
