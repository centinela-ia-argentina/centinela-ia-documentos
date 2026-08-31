import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Import seed data manually for reliability
const ORG_ESC_ID = '33333333-3333-3333-3333-333333333333';
const CASE_ESC_ID = 'eeee3333-3333-3333-3333-333333333333';
const CASE_INM_ID = 'dddd2222-2222-2222-2222-222222222222';
const CASE_LEGAL_ID = 'cccc1111-1111-1111-1111-111111111111';

test.describe.serial('Centinela IA - Escribania E2E', () => {
  let page: any;
  let context: any;
  let tempCaseId = '';

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    // G. Limpieza
    if (tempCaseId) {
      await serviceClient.from('checklist_items').delete().eq('case_id', tempCaseId);
      await serviceClient.from('checklists').delete().eq('case_id', tempCaseId);
      await serviceClient.from('cases').delete().eq('id', tempCaseId);
    }
    await page.close();
    await context.close();
  });

  test('A. Login', async () => {
    await page.goto('/login');
    await page.fill('[data-testid="login-email"]', 'admin.esc@test.com');
    await page.fill('[data-testid="login-password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('B. Navegación vertical', async () => {
    const nav = page.locator('nav');
    await expect(nav.locator('a', { hasText: 'Legajos' }).first()).toBeVisible();
    await expect(nav.locator('a', { hasText: 'Recibidos' }).first()).toBeVisible();
    await expect(nav.locator('a', { hasText: 'Modelos' }).first()).toBeVisible();
    await expect(nav.locator('a', { hasText: 'Agenda' }).first()).toBeVisible();
  });

  test('C. Legajo propio', async () => {
    await page.goto(`/expedientes/${CASE_ESC_ID}`);
    await expect(page.locator('h1')).toContainText('Escritura 1');
  });

  test('D. Tipos permitidos', async () => {
    await page.goto('/expedientes/nuevo');
    
    const tipoSelect = page.locator('select[name="case_type"]');
    await expect(tipoSelect).toBeVisible();

    const textContent = await tipoSelect.textContent();
    expect(textContent).toContain('Escritura');
    expect(textContent).toContain('Poder');
    
    expect(textContent).not.toContain('civil');
    expect(textContent).not.toContain('Compraventa de inmueble');
  });

  test('E. Checklist automatico', async () => {
    await page.goto('/expedientes/nuevo');
    
    const uniqueTitle = `Escritura E2E ${Date.now()}`;
    await page.fill('input[name="title"]', uniqueTitle);
    await page.fill('input[name="client_name"]', 'Cliente Notarial');
    await page.selectOption('select[name="case_type"]', 'Escritura');
    await page.click('button[type="submit"]:has-text("Crear")');

    await expect(page).toHaveURL(/\/expedientes\/[a-f0-9\-]+/);
    tempCaseId = page.url().split('/').pop();

    // Verify local DB
    const { data: checklist } = await serviceClient
      .from('checklists')
      .select('id, organization_id, case_id')
      .eq('case_id', tempCaseId)
      .single();

    expect(checklist).toBeDefined();
    expect(checklist.organization_id).toBe(ORG_ESC_ID);
    expect(checklist.case_id).toBe(tempCaseId);

    const { data: items } = await serviceClient
      .from('checklist_items')
      .select('id')
      .eq('checklist_id', checklist.id);
    
    expect(items.length).toBeGreaterThan(0);
  });

  test('F. Aislamiento', async () => {
    // Attempt to go to Legal Case
    await page.goto(`/expedientes/${CASE_LEGAL_ID}`);
    let pageText = await page.textContent('body');
    expect(pageText).not.toContain('Caso Legal 1');

    // Attempt to go to Inm Case
    await page.goto(`/expedientes/${CASE_INM_ID}`);
    pageText = await page.textContent('body');
    expect(pageText).not.toContain('Propiedad 1');
  });
});
