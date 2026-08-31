import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Import seed data manually for reliability
const ORG_INM_ID = '22222222-2222-2222-2222-222222222222';
const CASE_INM_ID = 'dddd2222-2222-2222-2222-222222222222';
const CASE_LEGAL_ID = 'cccc1111-1111-1111-1111-111111111111';

test.describe.serial('Centinela IA - Inmobiliaria E2E', () => {
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
    await page.fill('[data-testid="login-email"]', 'admin.inm@test.com');
    await page.fill('[data-testid="login-password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('B. Navegación vertical', async () => {
    // Inmobiliaria menu items
    const nav = page.locator('nav');
    await expect(nav.locator('a', { hasText: 'Operaciones' }).first()).toBeVisible();
    await expect(nav.locator('a', { hasText: 'Propiedades' }).first()).toBeVisible();
    await expect(nav.locator('a', { hasText: 'Clientes' }).first()).toBeVisible();
    await expect(nav.locator('a', { hasText: 'Alquileres' }).first()).toBeVisible();
  });

  test('C. Operación propia', async () => {
    await page.goto(`/expedientes/${CASE_INM_ID}`);
    await expect(page.locator('h1')).toContainText('Propiedad 1');
    // Confirm it belongs to the inmobiliaria org by checking something on page or via the next steps
  });

  test('D. Tipos permitidos', async () => {
    await page.goto('/expedientes/nuevo');
    
    // Abrimos el select de tipos de operación
    const tipoSelect = page.locator('select[name="case_type"]');
    await expect(tipoSelect).toBeVisible();

    const textContent = await tipoSelect.textContent();
    expect(textContent).toContain('Compraventa de inmueble');
    expect(textContent).toContain('Alquiler');
    
    // No debería tener tipos de jurídico (ej. civil) ni de escribanía (ej. Escritura)
    expect(textContent).not.toContain('civil');
    expect(textContent).not.toContain('Escritura');
    expect(textContent).not.toContain('penal');
  });

  test('E. Checklist automatico', async () => {
    await page.goto('/expedientes/nuevo');
    
    const uniqueTitle = `Operacion E2E ${Date.now()}`;
    await page.fill('input[name="title"]', uniqueTitle);
    await page.fill('input[name="client_name"]', 'Cliente Prueba');
    await page.selectOption('select[name="case_type"]', 'Compraventa de inmueble');
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
    expect(checklist.organization_id).toBe(ORG_INM_ID);
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
    
    // Should be redirected or denied access. Let's check for /acceso-denegado or explicit error UI
    // Contractually the app redirects to /acceso-denegado or /dashboard with error, or shows "no encontrado"
    const currentUrl = page.url();
    const isDeniedOrDashboard = currentUrl.includes('acceso-denegado') || currentUrl.includes('dashboard') || currentUrl.includes('login');
    
    // Or it might render a Not Found / Access Denied page without redirect
    const titleText = await page.locator('h1').textContent();
    const accessDeniedText = titleText?.toLowerCase().includes('acceso') || titleText?.toLowerCase().includes('no encontrado');

    expect(isDeniedOrDashboard || accessDeniedText).toBeTruthy();

    // Should NEVER see the title of the legal case
    const pageText = await page.textContent('body');
    expect(pageText).not.toContain('Caso Legal 1');
  });
});
