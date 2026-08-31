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

test.describe.serial('Centinela IA - Escribania E2E', () => {
  let tempCaseId = '';

  test.afterAll(async () => {
    if (tempCaseId) {
      try {
        const { data: checklist } = await serviceClient
          .from('checklists')
          .select('id')
          .eq('case_id', tempCaseId)
          .single();

        if (checklist) {
          const { error: itemsErr } = await serviceClient.from('checklist_items').delete().eq('checklist_id', checklist.id);
          expect(itemsErr).toBeNull();
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
    const { context, page } = await loginAs(browser, 'admin.esc@test.com');
    await page.close();
    await context.close();
  });

  test('B. Navegación vertical', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.esc@test.com');
    try {
      const nav = page.locator('nav');
      await expect(nav.locator('a', { hasText: 'Legajos' }).first()).toBeVisible();
      await expect(nav.locator('a', { hasText: 'Recibidos' }).first()).toBeVisible();
      await expect(nav.locator('a', { hasText: 'Modelos' }).first()).toBeVisible();
      await expect(nav.locator('a', { hasText: 'Agenda' }).first()).toBeVisible();
      await expect(nav.locator('a', { hasText: 'Índice / Repertorio' }).first()).toBeVisible();
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

      const { data: checklist, error: chkErr } = await serviceClient
        .from('checklists')
        .select('id, case_id, organization_id, template_type')
        .eq('case_id', tempCaseId)
        .single();

      expect(chkErr).toBeNull();
      expect(checklist).not.toBeNull();
      expect(checklist?.case_id).toBe(tempCaseId);
      expect(checklist?.organization_id).toBe(ORG_ESC_ID);
      expect(checklist?.template_type).toBe('Escritura');

      const { data: items, error: itemsErr } = await serviceClient
        .from('checklist_items')
        .select('id, checklist_id, organization_id')
        .eq('checklist_id', checklist!.id);

      expect(itemsErr).toBeNull();
      expect(items?.length).toBeGreaterThan(0);
      items?.forEach(item => {
        expect(item.checklist_id).toBe(checklist!.id);
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
      await expect(page.locator('[data-testid="case-detail-title"]')).toHaveCount(0);
      let pageText = await page.textContent('body');
      expect(pageText).not.toContain('Caso Legal 1');
      expect(pageText).not.toContain(CASE_LEGAL_ID);

      response = await page.goto(`/expedientes/${CASE_INM_ID}`);
      expect(response?.status()).toBe(404);
      await expect(page.locator('[data-testid="case-detail-title"]')).toHaveCount(0);
      pageText = await page.textContent('body');
      expect(pageText).not.toContain('Propiedad 1');
      expect(pageText).not.toContain(CASE_INM_ID);
    } finally {
      await page.close();
      await context.close();
    }
  });
});
