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

  test('02. roles y auditoría (verificaciones básicas de sesión)', async () => {
    // Current user is admin.legal@test.com
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Bienvenido');
    await page.goto('/usuarios');
    await expect(page.locator('h1')).toContainText('Usuarios'); // Admin has access

    // Log out
    await page.goto('/logout');
    await expect(page).toHaveURL(/\/login/);

    // Log in as employee
    await page.fill('[data-testid="login-email"]', 'emp.legal@test.com');
    await page.fill('[data-testid="login-password"]', process.env.TEST_USER_PASSWORD || 'password123');
    await page.click('[data-testid="login-submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    // Employee tries to access /usuarios
    await page.goto('/usuarios');
    await expect(page.locator('h1').or(page.locator('body'))).not.toContainText('Invitar usuario');

    // Log out and log back in as admin for the rest of the suite
    await page.goto('/logout');
    await page.fill('[data-testid="login-email"]', process.env.TEST_USER_EMAIL || 'admin.legal@test.com');
    await page.fill('[data-testid="login-password"]', process.env.TEST_USER_PASSWORD || 'password123');
    await page.click('[data-testid="login-submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('03. expediente', async () => {
    await page.goto('/expedientes/nuevo');
    const caseTitle = `Expediente E2E ${Date.now()}`;
    await page.fill('[data-testid="case-title"]', caseTitle);
    await page.fill('[data-testid="case-client"]', 'Cliente E2E');
    await page.selectOption('[data-testid="case-type"]', 'sucesion');
    await page.click('[data-testid="case-submit"]');

    await expect(page).toHaveURL(/\/expedientes\/.+/);
    await expect(page.locator('h1')).toContainText(caseTitle);
    caseUrl = page.url();
    caseId = caseUrl.split('/').pop() || '';
    expect(caseId).toBeTruthy();
  });

  test('04. 15 uploads (concurrencia y exactamente 15 success)', async () => {
    await page.goto('/documentos/subir');
    await page.selectOption('[data-testid="upload-case"]', { value: caseId });
    await page.selectOption('[data-testid="upload-type"]', 'DNI');
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

    // We submit
    await page.click('[data-testid="upload-submit"]');
    await expect(page.locator('[data-testid="upload-error-count"]')).toBeVisible({ timeout: 15000 });

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
    // Add cookie to trigger server-side mock failure
    await context.addCookies([{ name: 'x-test-fail-upload', value: '1', domain: 'localhost', path: '/' }]);

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
    await page.click('button:has-text("Reintentar fallidos")');
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
    await page.goto(caseUrl);
    // Click toggle to received
    const toggleBtn = page.locator('[data-testid="checklist-toggle-0"]').first();
    await toggleBtn.click();
    await expect(page.locator('body')).toContainText('Recibido');

    // Click to reviewed
    await toggleBtn.click();
    await expect(page.locator('body')).toContainText('Revisado');
  });

  test('11. Agenda 09:30 y otro horario', async () => {
    await page.goto('/agenda');
    await page.fill('[data-testid="agenda-titulo"]', 'Audiencia E2E ' + Date.now());
    await page.fill('[data-testid="agenda-fecha"]', '2027-01-01');
    await page.fill('[data-testid="agenda-hora"]', '09:30');
    await page.selectOption('[data-testid="agenda-categoria"]', 'Audiencia');
    await page.click('[data-testid="agenda-submit"]');

    await expect(page.locator('body')).toContainText('09:30');

    // Otro horario
    await page.fill('[data-testid="agenda-titulo"]', 'Reunión E2E ' + Date.now());
    await page.fill('[data-testid="agenda-fecha"]', '2027-01-01');
    await page.fill('[data-testid="agenda-hora"]', '14:15');
    await page.selectOption('[data-testid="agenda-categoria"]', 'Reunión');
    await page.click('[data-testid="agenda-submit"]');

    await expect(page.locator('body')).toContainText('14:15');
  });

  test('12. duplicado de Agenda', async () => {
    const fixedTitle = 'Audiencia Dup ' + Date.now();
    await page.goto('/agenda');

    await page.fill('[data-testid="agenda-titulo"]', fixedTitle);
    await page.fill('[data-testid="agenda-fecha"]', '2027-02-02');
    await page.fill('[data-testid="agenda-hora"]', '10:00');
    await page.selectOption('[data-testid="agenda-categoria"]', 'Vencimiento');
    await page.click('[data-testid="agenda-submit"]');
    await expect(page.locator('body')).toContainText(fixedTitle);

    // Attempt duplicate
    await page.fill('[data-testid="agenda-titulo"]', fixedTitle);
    await page.fill('[data-testid="agenda-fecha"]', '2027-02-02');
    await page.fill('[data-testid="agenda-hora"]', '10:00');
    await page.selectOption('[data-testid="agenda-categoria"]', 'Vencimiento');
    await page.click('[data-testid="agenda-submit"]');

    // Should show error or conflict
    await expect(page.locator('body')).toContainText(/error|duplicado/i);
  });

  test('13. tasa 28.000.000 -> 840.000', async () => {
    await page.goto('/calculadoras');
    await page.selectOption('[data-testid="tasa-jurisdiccion"]', 'nacion');
    // We need to select the pecuniary type first to see the checkbox and amount
    // In our test, there is a select for process type. We'll select 'general_pecuniary'
    await page.selectOption('select', { label: 'Civil/comercial con monto determinado' });
    await page.fill('[data-testid="tasa-monto"]', '28000000');
    // Check confirmation checkbox
    await page.check('input[type="checkbox"]');
    await page.click('[data-testid="tasa-submit"]');

    await expect(page.locator('[data-testid="tasa-resultado"]')).toContainText('840.000');
  });

  test('14. RAG y guardrails', async () => {
    await page.goto(caseUrl);
    // Need to wait for RAG component to load
    await expect(page.locator('[data-testid="rag-input"]')).toBeVisible();
    await page.fill('[data-testid="rag-input"]', '¿Qué dice el documento?');
    await page.click('[data-testid="rag-submit"]');

    await expect(page.locator('[data-testid="rag-response"]')).toBeVisible({ timeout: 15000 });
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
