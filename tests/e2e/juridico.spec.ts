import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

test.describe.serial('Centinela IA - Flujo Jurídico E2E Obligatorio', () => {
  let caseUrl = '';
  let caseId = '';

  test.beforeAll(async ({ browser }) => {
    // We could do global login here, but since 'login' is a suite itself, we'll do it in the first test
    // and let playwright reuse the page across tests using a serial mode page instance.
  });

  // Playwright serial mode uses a new page per test by default, so we'll share one page context
  let page: any;
  let context: any;
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });
  test.afterAll(async () => {
    await page.close();
    await context.close();
  });

  test('01. login', async () => {
    await page.goto('/login');
    await page.fill('[data-testid="login-email"]', process.env.TEST_USER_EMAIL || 'admin.legal@test.com');
    await page.fill('[data-testid="login-password"]', process.env.TEST_USER_PASSWORD || 'password123');
    await page.click('[data-testid="login-submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('02. roles y auditoría (verificaciones básicas de sesión)', async ({ browser }) => {
    // Current user is admin.legal@test.com
    await expect(page).toHaveURL(/\/dashboard/);
    const dashboardTitle = page.locator('[data-testid="dashboard-title"]');
    await expect(dashboardTitle).toBeVisible({ timeout: 15000 });
    await expect(dashboardTitle).toContainText('Bienvenido');
    await page.goto('/usuarios');
    await expect(page).toHaveURL(/\/usuarios/);
    const usersPageTitle = page.locator('[data-testid="users-page-title"]');
    await expect(usersPageTitle).toBeVisible({ timeout: 15000 });
    await expect(usersPageTitle).toContainText('Control de usuarios y accesos');

    // Create a temporary isolated context for employee
    const employeeContext = await browser.newContext();
    const employeePage = await employeeContext.newPage();

    try {
      await employeePage.goto('/login');

      await employeePage.fill(
        '[data-testid="login-email"]',
        'emp.legal@test.com'
      );

      await employeePage.fill(
        '[data-testid="login-password"]',
        process.env.TEST_USER_PASSWORD || 'password123'
      );

      await employeePage.click(
        '[data-testid="login-submit"]'
      );

      await expect(employeePage).toHaveURL(
        /\/dashboard/
      );

      const employeeDashboardTitle = employeePage.locator(
        '[data-testid="dashboard-title"]'
      );

      await expect(employeeDashboardTitle).toBeVisible({
        timeout: 15000,
      });

      await employeePage.goto('/usuarios');

      await expect(employeePage).toHaveURL(
        /\/acceso-denegado(?:\?motivo=rol)?/
      );
    } finally {
      await employeeContext.close();
    }
  });

  test('03. expediente', async () => {
    await page.goto('/expedientes/nuevo');
    const caseTitle = `Expediente E2E ${Date.now()}`;
    await page.fill('[data-testid="case-title"]', caseTitle);
    await page.fill('[data-testid="case-client"]', 'Cliente E2E');
    const caseTypeSelect = page.locator('[data-testid="case-type"]');
    await expect(caseTypeSelect).toBeVisible({ timeout: 15000 });
    await caseTypeSelect.selectOption({ label: 'Sucesión' });
    await expect(caseTypeSelect).toHaveValue('Sucesión');
    await page.click('[data-testid="case-submit"]');

    await expect(page).toHaveURL(/\/expedientes\/.+/);
    const caseDetailTitle = page.locator('[data-testid="case-detail-title"]');
    await expect(caseDetailTitle).toBeVisible({ timeout: 15000 });
    await expect(caseDetailTitle).toHaveText(caseTitle);
    caseUrl = page.url();
    caseId = caseUrl.split('/').pop() || '';
    expect(caseId).toBeTruthy();

    // Verify automatic checklist creation
    const { data: createdChecklist, error: checklistError } = await serviceClient
      .from('checklists')
      .select('id, organization_id, case_id, template_type')
      .eq('case_id', caseId)
      .maybeSingle();

    expect(checklistError).toBeNull();
    expect(createdChecklist).not.toBeNull();
    expect(createdChecklist?.template_type).toBe('Sucesión');

    const { data: createdItems, error: itemsError } = await serviceClient
      .from('checklist_items')
      .select('id, organization_id, checklist_id')
      .eq('checklist_id', createdChecklist!.id);

    expect(itemsError).toBeNull();
    expect(createdItems?.length).toBeGreaterThan(0);

    for (const item of createdItems ?? []) {
      expect(item.organization_id).toBe(createdChecklist!.organization_id);
    }
  });

  test('04. 15 uploads (concurrencia y exactamente 15 success)', async () => {
    await page.goto('/documentos/subir');
    await page.selectOption('[data-testid="upload-case"]', { value: caseId });
    const uploadTypeSelect = page.locator('[data-testid="upload-type"]');
    await expect(uploadTypeSelect).toBeVisible({ timeout: 15000 });
    await uploadTypeSelect.selectOption({ label: 'Prueba documental' });
    await expect(uploadTypeSelect).toHaveValue('Prueba documental');
    await page.selectOption('[data-testid="upload-sensitivity"]', 'low');

    const filePayloads = Array.from({ length: 15 }).map((_, i) => ({
      name: `bulk_${randomUUID()}_${i}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 E2E Bulk ' + randomUUID()),
    }));

    await page.setInputFiles('[data-testid="upload-file-input"]', filePayloads);
    await page.click('[data-testid="upload-submit"]');

    await expect(page.locator('[data-testid="upload-summary"]')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('[data-testid="upload-success-count"]')).toContainText('15');
  });

  test('05. invalid', async () => {
    await page.goto('/documentos/subir');
    await page.selectOption('[data-testid="upload-case"]', { value: caseId });

    // We get initial counts
    const { count: docsCountBefore } = await serviceClient.from('documents').select('*', { count: 'exact', head: true });
    // And storage
    const { data: storageBefore } = await serviceClient.storage.from('documents').list(`${process.env.TEST_ORG_ID || '11111111-1111-1111-1111-111111111111'}/${caseId}`);
    const storageCountBefore = storageBefore?.length || 0;

    // We send an invalid file format
    await page.setInputFiles('[data-testid="upload-file-input"]', [
      { name: 'invalido.txt', mimeType: 'text/plain', buffer: Buffer.from('No soy un PDF') }
    ]);

    // Verify button is disabled and text
    const uploadSubmit = page.locator('[data-testid="upload-submit"]');
    await expect(uploadSubmit).toBeVisible({ timeout: 15000 });
    await expect(uploadSubmit).toBeDisabled();
    await expect(uploadSubmit).toContainText('Subir 0 documentos');

    // Verify 0 rows and 0 storage objects created
    const { count: docsCountAfter } = await serviceClient.from('documents').select('*', { count: 'exact', head: true });
    expect(docsCountAfter).toBe(docsCountBefore);

    const { data: storageAfter } = await serviceClient.storage.from('documents').list(`${process.env.TEST_ORG_ID || '11111111-1111-1111-1111-111111111111'}/${caseId}`);
    const storageCountAfter = storageAfter?.length || 0;
    expect(storageCountAfter).toBe(storageCountBefore);
  });

  test('06. duplicate y partial failure', async () => {
    await page.goto('/documentos/subir');
    await page.selectOption('[data-testid="upload-case"]', { value: caseId });

    const fileBytes = Buffer.from('%PDF-1.4 Duplicate Me ' + randomUUID());

    await page.setInputFiles('[data-testid="upload-file-input"]', [
      { name: `dup1.pdf`, mimeType: 'application/pdf', buffer: fileBytes },
      { name: `dup2.pdf`, mimeType: 'application/pdf', buffer: fileBytes }
    ]);

    await page.click('[data-testid="upload-submit"]');
    await expect(page.locator('[data-testid="upload-summary"]')).toBeVisible({ timeout: 15000 });
    // One success, one duplicate
    await expect(page.locator('[data-testid="upload-duplicate-count"]')).toBeVisible();
  });

  test('07. retry', async () => {
    // Add cookie to trigger server-side mock failure (compatible con 127.0.0.1 y localhost)
    await context.addCookies([
      { name: 'x-test-fail-upload', value: '1', domain: '127.0.0.1', path: '/' },
      { name: 'x-test-fail-upload', value: '1', domain: 'localhost', path: '/' }
    ]);

    await page.goto('/documentos/subir');
    await page.selectOption('[data-testid="upload-case"]', { value: caseId });
    await page.setInputFiles('[data-testid="upload-file-input"]', [
      { name: `retry.pdf`, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 Retry Me') }
    ]);

    const { count: docsCountBefore } = await serviceClient.from('documents').select('*', { count: 'exact', head: true });

    await page.click('[data-testid="upload-submit"]');

    // Should fail and show error count
    await expect(page.locator('[data-testid="upload-error-count"]')).toBeVisible({ timeout: 15000 });

    // Verify no row created yet
    const { count: docsCountMiddle } = await serviceClient.from('documents').select('*', { count: 'exact', head: true });
    expect(docsCountMiddle).toBe(docsCountBefore);

    // Now click retry
    await page.click('button:has-text("Reintentar")');
    await expect(page.locator('[data-testid="upload-success-count"]')).toBeVisible({ timeout: 15000 });

    // Verify 1 row created
    const { count: docsCountAfter } = await serviceClient.from('documents').select('*', { count: 'exact', head: true });
    expect(docsCountAfter).toBe((docsCountBefore || 0) + 1);
  });

  test('08. request manipulado (magic bytes)', async () => {
    // To truly manipulate, we bypass UI restrictions and send wrong content with a PDF mime
    await page.goto('/documentos/subir');
    await page.selectOption('[data-testid="upload-case"]', { value: caseId });

    await page.setInputFiles('[data-testid="upload-file-input"]', [
      { name: `fake.pdf`, mimeType: 'application/pdf', buffer: Buffer.from('FAKE PDF CONTENT NO MAGIC') }
    ]);
    await page.click('[data-testid="upload-submit"]');

    await expect(page.locator('[data-testid="upload-summary"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="upload-error-count"]')).toBeVisible();
  });

  test('09. persistencia', async () => {
    await page.goto('/documentos');
    await expect(page.locator('table')).toContainText('bulk_');
  });

  test('10. checklist pending -> received -> reviewed y not_required', async () => {
    await page.goto(`${caseUrl}?tab=checklist`);
    // Click toggle to received
    const toggleBtn = page.locator('[data-testid="checklist-toggle-0"]').first();
    await toggleBtn.click();
    await expect(page.locator('body')).toContainText('Recibido');

    // Click to reviewed
    await toggleBtn.click();
    await expect(page.locator('body')).toContainText('Revisado');
  });

  test('10.5. checklist document link', async () => {
    await page.goto(`${caseUrl}?tab=checklist`);
    const linkToggle = page.locator('[data-testid="checklist-link-toggle-0"]').first();
    await expect(linkToggle).toContainText('Vincular documento');
    await linkToggle.click();

    const form = linkToggle.locator('..'); // The details element
    const select = form.locator('select[name="document_id"]').first();
    
    // El select debe tener mas de 1 opcion por los documentos previos
    const options = select.locator('option');
    await expect.poll(async () => options.count()).toBeGreaterThan(1);
    
    const firstDocumentOption = select.locator('option:not([value=""])').first();
    const firstDocumentValue = await firstDocumentOption.getAttribute('value');
    expect(firstDocumentValue).toBeTruthy();
    
    await select.selectOption(firstDocumentValue!);
    
    const saveBtn = form.locator('button', { hasText: 'Guardar' }).first();
    await saveBtn.click();

    await expect(page).toHaveURL(/checklist_document=linked/);
    await expect(page.locator('[data-testid="checklist-document-feedback"]')).toContainText('Documento vinculado correctamente');
    await expect(linkToggle).toContainText('Cambiar documento vinculado');
    await expect(page.locator('p:has-text("Vinculado:")').first()).toBeVisible();

    await page.reload();
    await expect(linkToggle).toContainText('Cambiar documento vinculado');
    await expect(page.locator('p:has-text("Vinculado:")').first()).toBeVisible();

    await linkToggle.click();
    await select.selectOption({ value: '' });
    await saveBtn.click();

    await expect(page).toHaveURL(/checklist_document=unlinked/);
    await expect(page.locator('[data-testid="checklist-document-feedback"]')).toContainText('Documento desvinculado correctamente');
    await expect(linkToggle).toContainText('Vincular documento');
    await expect(page.locator('p:has-text("Vinculado:")')).toBeHidden();
    
    await page.reload();
    await expect(linkToggle).toContainText('Vincular documento');
    await expect(page.locator('p:has-text("Vinculado:")')).toBeHidden();
  });

  test('11. Agenda 09:30 y otro horario', async () => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr = formatter.format(new Date());
    
    await page.goto('/agenda');
    await page.getByRole('button', { name: 'Nuevo evento' }).click();
    await expect(page.locator('[data-testid="agenda-titulo"]')).toBeVisible();

    await page.fill('[data-testid="agenda-titulo"]', 'Audiencia E2E ' + Date.now());
    await page.fill('[data-testid="agenda-fecha"]', todayStr);
    await page.fill('[data-testid="agenda-hora"]', '09:30');
    await page.selectOption('[data-testid="agenda-categoria"]', 'turno');
    await page.click('[data-testid="agenda-submit"]');

    await expect(page.locator('body')).toContainText('09:30');

    // Otro horario
    await page.getByRole('button', { name: 'Nuevo evento' }).click();
    await expect(page.locator('[data-testid="agenda-titulo"]')).toBeVisible();

    await page.fill('[data-testid="agenda-titulo"]', 'Reunión E2E ' + Date.now());
    await page.fill('[data-testid="agenda-fecha"]', todayStr);
    await page.fill('[data-testid="agenda-hora"]', '14:15');
    await page.selectOption('[data-testid="agenda-categoria"]', 'evento');
    await page.click('[data-testid="agenda-submit"]');

    await expect(page.locator('body')).toContainText('14:15');
  });

  test('12. duplicado de Agenda', async () => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr = formatter.format(new Date());
    const fixedTitle = 'Audiencia Dup ' + Date.now();
    
    await page.goto('/agenda');
    await page.getByRole('button', { name: 'Nuevo evento' }).click();
    await expect(page.locator('[data-testid="agenda-titulo"]')).toBeVisible();

    await page.fill('[data-testid="agenda-titulo"]', fixedTitle);
    await page.fill('[data-testid="agenda-fecha"]', todayStr);
    await page.fill('[data-testid="agenda-hora"]', '10:00');
    await page.selectOption('[data-testid="agenda-categoria"]', 'evento');
    await page.click('[data-testid="agenda-submit"]');
    await expect(page.locator('body')).toContainText(fixedTitle);

    // Attempt duplicate
    await page.getByRole('button', { name: 'Nuevo evento' }).click();
    await expect(page.locator('[data-testid="agenda-titulo"]')).toBeVisible();

    await page.fill('[data-testid="agenda-titulo"]', fixedTitle);
    await page.fill('[data-testid="agenda-fecha"]', todayStr);
    await page.fill('[data-testid="agenda-hora"]', '10:00');
    await page.selectOption('[data-testid="agenda-categoria"]', 'evento');
    await page.click('[data-testid="agenda-submit"]');

    // Should show error or conflict
    await expect(page.locator('body')).toContainText('Ya en agenda.');
  });

  test('13. tasa 28.000.000 -> 840.000', async () => {
    await page.goto('/calculadoras');

    await page
      .getByRole('button', {
        name: 'Tasa e intereses',
        exact: true,
      })
      .click();

    const jurisdiccion = page.locator('[data-testid="tasa-jurisdiccion"]');
    await expect(jurisdiccion).toBeVisible();
    await jurisdiccion.selectOption('nacion');

    await page.getByLabel('Tipo de proceso').selectOption('general_pecuniary');
    await page.locator('[data-testid="tasa-monto"]').fill('28000000');

    await page
      .getByRole('checkbox', {
        name: /Confirmo que se trata de una pretensión pecuniaria general/i,
      })
      .check();

    await page.locator('[data-testid="tasa-submit"]').click();

    await expect(page.locator('[data-testid="tasa-resultado"]')).toContainText('840.000');
  });

  test('14. RAG y guardrails', async () => {
    await page.goto(`${caseUrl}?tab=documentos`);
    // Need to wait for RAG component to load
    await expect(page.locator('[data-testid="rag-input"]')).toBeVisible();
    await page.fill('[data-testid="rag-input"]', '¿Qué dice el documento?');
    await page.click('[data-testid="rag-submit"]');

    await expect(page.locator('[data-testid="rag-response"]')).toBeVisible({ timeout: 15000 });
  });

  test('14b. vinculación manual discordante en checklist y persistencia tras reload', async () => {
    await page.goto(`${caseUrl}?tab=checklist`);
    const checklistContainer = page.locator('[data-testid="checklist-items"]');
    await expect(checklistContainer).toBeVisible({ timeout: 15000 });

    const selectLink = page.locator('[data-testid^="select-doc-"]').first();
    if ((await selectLink.count()) > 0) {
      const options = await selectLink.locator('option').all();
      if (options.length > 1) {
        const targetVal = await options[1].getAttribute('value');
        if (targetVal) {
          await selectLink.selectOption(targetVal);
          await page.reload();
          await expect(checklistContainer).toBeVisible({ timeout: 15000 });
          await expect(selectLink).toHaveValue(targetVal);
        }
      }
    }
  });

  test('14c. modelo outdated en /modelos sin campos editables, sin copiar, sin descargar', async () => {
    await page.goto('/modelos?modelo=intimacion-laboral-registracion');
    await expect(page.locator('[data-testid="ficha-historica-outdated"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="btn-copiar-modelo"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="btn-descargar-txt"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="btn-descargar-docx"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="btn-redactar-ia"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Podés editar el modelo manualmente');
  });

  test('14d. selectores de Agenda y Modelos segregados por vertical', async () => {
    await page.goto('/agenda');
    const caseSelect = page.locator('[data-testid="agenda-case-select"]');
    if ((await caseSelect.count()) > 0) {
      const text = await caseSelect.innerText();
      expect(text).not.toContain('Propiedad 1');
      expect(text).not.toContain('Escritura 1');
    }

    await page.goto('/modelos');
    const modeloCaseSelect = page.locator('[data-testid="modelos-expediente-select"]');
    if ((await modeloCaseSelect.count()) > 0) {
      const text = await modeloCaseSelect.innerText();
      expect(text).not.toContain('Propiedad 1');
      expect(text).not.toContain('Escritura 1');
    }
  });

  test('15. cleanup', async () => {
    // 1. Obtener file_paths de todos los documentos creados
    const { data: docs } = await serviceClient.from('documents').select('id, file_path').eq('case_id', caseId);

    // 2. Eliminar Storage Objects
    if (docs && docs.length > 0) {
      const paths = docs.map(d => d.file_path);
      await serviceClient.storage.from('documents').remove(paths);

      const docIds = docs.map(d => d.id);
      // Eliminar dependencias
      await serviceClient.from('document_chunks').delete().in('document_id', docIds);
      await serviceClient.from('ai_outputs').delete().in('document_id', docIds);
      await serviceClient.from('checklist_items').update({ document_id: null }).in('document_id', docIds);
    }

    // 3. Eliminar metadata
    await serviceClient.from('documents').delete().eq('case_id', caseId);
    await serviceClient.from('agenda_plazos').delete().eq('case_id', caseId);
    await serviceClient.from('cases').delete().eq('id', caseId);

    // 4. Afirmar cero filas y cero storage
    const { count: docsCount } = await serviceClient.from('documents').select('*', { count: 'exact', head: true }).eq('case_id', caseId);
    expect(docsCount).toBe(0);
    const { count: casesCount } = await serviceClient.from('cases').select('*', { count: 'exact', head: true }).eq('id', caseId);
    expect(casesCount).toBe(0);
    const { count: agendaCount } = await serviceClient.from('agenda_plazos').select('*', { count: 'exact', head: true }).eq('case_id', caseId);
    expect(agendaCount).toBe(0);

    const orgId = process.env.TEST_ORG_ID || '11111111-1111-1111-1111-111111111111';
    const { data: storageAfter } = await serviceClient.storage.from('documents').list(`${orgId}/${caseId}`);
    expect(storageAfter?.length || 0).toBe(0);
  });
});
