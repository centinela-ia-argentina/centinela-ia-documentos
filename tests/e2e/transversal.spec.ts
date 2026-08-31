import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_LEGAL_ID = '11111111-1111-1111-1111-111111111111';
const ORG_INM_ID = '22222222-2222-2222-2222-222222222222';
const ORG_ESC_ID = '33333333-3333-3333-3333-333333333333';
const CASE_LEGAL_ID = 'cccc1111-1111-1111-1111-111111111111';
const CASE_INM_ID = 'dddd2222-2222-2222-2222-222222222222';
const CASE_ESC_ID = 'eeee3333-3333-3333-3333-333333333333';

test.describe.serial('Centinela IA - Aislamiento Transversal', () => {
  let page: any;
  let context: any;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    // Delete any manipulated case created in test E
    await serviceClient.from('cases').delete().eq('title', 'Transversal Manipulation Test');
    await page.close();
    await context.close();
  });

  test('A. Legal contra Inmobiliaria', async () => {
    await page.goto('/login');
    await page.fill('[data-testid="login-email"]', 'admin.legal@test.com');
    await page.fill('[data-testid="login-password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/expedientes/${CASE_INM_ID}`);
    const isDenied = page.url().includes('acceso-denegado') || page.url().includes('dashboard');
    const titleText = await page.locator('h1').textContent();
    const accessDeniedText = titleText?.toLowerCase().includes('acceso') || titleText?.toLowerCase().includes('no encontrado');
    expect(isDenied || accessDeniedText).toBeTruthy();
    const pageText = await page.textContent('body');
    expect(pageText).not.toContain('Propiedad 1');
  });

  test('B. Inmobiliaria contra Jurídico', async () => {
    // Relogin as INM
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[data-testid="login-email"]', 'admin.inm@test.com');
    await page.fill('[data-testid="login-password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/expedientes/${CASE_LEGAL_ID}`);
    const isDenied = page.url().includes('acceso-denegado') || page.url().includes('dashboard');
    const titleText = await page.locator('h1').textContent();
    const accessDeniedText = titleText?.toLowerCase().includes('acceso') || titleText?.toLowerCase().includes('no encontrado');
    expect(isDenied || accessDeniedText).toBeTruthy();
    const pageText = await page.textContent('body');
    expect(pageText).not.toContain('Caso Legal 1');
  });

  test('C. Escribanía contra Jurídico', async () => {
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[data-testid="login-email"]', 'admin.esc@test.com');
    await page.fill('[data-testid="login-password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/expedientes/${CASE_LEGAL_ID}`);
    const isDenied = page.url().includes('acceso-denegado') || page.url().includes('dashboard');
    const titleText = await page.locator('h1').textContent();
    const accessDeniedText = titleText?.toLowerCase().includes('acceso') || titleText?.toLowerCase().includes('no encontrado');
    expect(isDenied || accessDeniedText).toBeTruthy();
    const pageText = await page.textContent('body');
    expect(pageText).not.toContain('Caso Legal 1');
  });

  test('D. Escribanía contra Inmobiliaria', async () => {
    // Current user is still admin.esc
    await page.goto(`/expedientes/${CASE_INM_ID}`);
    const isDenied = page.url().includes('acceso-denegado') || page.url().includes('dashboard');
    const titleText = await page.locator('h1').textContent();
    const accessDeniedText = titleText?.toLowerCase().includes('acceso') || titleText?.toLowerCase().includes('no encontrado');
    expect(isDenied || accessDeniedText).toBeTruthy();
    const pageText = await page.textContent('body');
    expect(pageText).not.toContain('Propiedad 1');
  });

  test('E. Separación de formularios (Manipulación de case_type)', async () => {
    // Current user is admin.esc
    // Wait, first we can verify forms. 
    await page.goto('/expedientes/nuevo');
    const tipoSelect = page.locator('select[name="case_type"]');
    const textContent = await tipoSelect.textContent();
    // Verify it doesn't offer 'civil'
    expect(textContent).not.toContain('civil');

    // Manipulate form to send case_type = 'civil'
    // By adding the option dynamically and selecting it before clicking submit
    await page.evaluate(() => {
      const select = document.querySelector('select[name="case_type"]') as HTMLSelectElement;
      const option = document.createElement('option');
      option.value = 'civil';
      option.text = 'civil';
      select.add(option);
      select.value = 'civil';
    });

    await page.fill('input[name="title"]', 'Transversal Manipulation Test');
    await page.click('button[type="submit"]:has-text("Crear")');

    await page.waitForLoadState('networkidle');

    // Let's verify DB directly. 
    const { data: createdCases } = await serviceClient.from('cases').select('id, case_type').eq('title', 'Transversal Manipulation Test');
    
    // We expect the case_type to NOT be 'civil' (it should either fail and create 0 cases, or sanitize it and create with 'Escritura' or another valid type). 
    // BUT the prompt says: 
    // "Confirmar rechazo del servidor, cero casos creados, cero checklists creados..."
    // Wait, if it sanitizes it, then createdCases.length might be 1. 
    // Let's check what actually happens!
    if (createdCases && createdCases.length > 0) {
      if (createdCases[0].case_type === 'civil') {
        throw new Error('case_type de otra industria aceptado');
      } else {
        // If it sanitized it, maybe the prompt wanted strict rejection instead of fallback? 
        // We will assert createdCases.length === 0, and if it fails, I will report the defect.
        expect(createdCases.length).toBe(0);
      }
    }
  });
});
