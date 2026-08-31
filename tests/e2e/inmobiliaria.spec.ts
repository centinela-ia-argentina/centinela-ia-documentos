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

  test.afterAll(async () => {
    if (tempCaseId) {
      try {
        const { data: checklists } = await serviceClient
          .from('checklists')
          .select('id')
          .eq('case_id', tempCaseId);
          
        if (checklists && checklists.length > 0) {
          for (const checklist of checklists) {
            const { error: itemsErr } = await serviceClient.from('checklist_items').delete().eq('checklist_id', checklist.id);
            expect(itemsErr).toBeNull();
          }
        }

        const { error: chkErr } = await serviceClient.from('checklists').delete().eq('case_id', tempCaseId);
        expect(chkErr).toBeNull();

        const { error: caseErr } = await serviceClient.from('cases').delete().eq('id', tempCaseId);
        expect(caseErr).toBeNull();

        const { data: verifyCases } = await serviceClient.from('cases').select('id').eq('id', tempCaseId);
        expect(verifyCases?.length).toBe(0);
      } finally {
        tempCaseId = '';
      }
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
});
