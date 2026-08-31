import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loginAs } from './helpers';
import { randomUUID } from 'crypto';

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
  let uniqueTitleForManipulation = '';

  test.afterAll(async () => {
    if (uniqueTitleForManipulation) {
      try {
        const { data: createdCases } = await serviceClient.from('cases').select('id').eq('title', uniqueTitleForManipulation);
        if (createdCases && createdCases.length > 0) {
          for (const c of createdCases) {
            const { data: checklist } = await serviceClient.from('checklists').select('id').eq('case_id', c.id).single();
            if (checklist) {
              await serviceClient.from('checklist_items').delete().eq('checklist_id', checklist.id);
            }
            await serviceClient.from('checklists').delete().eq('case_id', c.id);
            await serviceClient.from('cases').delete().eq('id', c.id);
          }
        }
      } finally {
        uniqueTitleForManipulation = '';
      }
    }
  });

  test('A. Legal contra Inmobiliaria', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.legal@test.com');
    try {
      const response = await page.goto(`/expedientes/${CASE_INM_ID}`);
      expect(response?.status()).toBe(404);

      await expect(page.locator('[data-testid="case-detail-title"]')).toHaveCount(0);
      const pageText = await page.textContent('body');
      expect(pageText).not.toContain('Propiedad 1');
      expect(pageText).not.toContain(CASE_INM_ID);
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('B. Inmobiliaria contra Jurídico', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.inm@test.com');
    try {
      const response = await page.goto(`/expedientes/${CASE_LEGAL_ID}`);
      expect(response?.status()).toBe(404);

      await expect(page.locator('[data-testid="case-detail-title"]')).toHaveCount(0);
      const pageText = await page.textContent('body');
      expect(pageText).not.toContain('Caso Legal 1');
      expect(pageText).not.toContain(CASE_LEGAL_ID);
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('C. Escribanía contra Jurídico', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.esc@test.com');
    try {
      const response = await page.goto(`/expedientes/${CASE_LEGAL_ID}`);
      expect(response?.status()).toBe(404);

      await expect(page.locator('[data-testid="case-detail-title"]')).toHaveCount(0);
      const pageText = await page.textContent('body');
      expect(pageText).not.toContain('Caso Legal 1');
      expect(pageText).not.toContain(CASE_LEGAL_ID);
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('D. Escribanía contra Inmobiliaria', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.esc@test.com');
    try {
      const response = await page.goto(`/expedientes/${CASE_INM_ID}`);
      expect(response?.status()).toBe(404);

      await expect(page.locator('[data-testid="case-detail-title"]')).toHaveCount(0);
      const pageText = await page.textContent('body');
      expect(pageText).not.toContain('Propiedad 1');
      expect(pageText).not.toContain(CASE_INM_ID);
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('E. Separación de formularios (Manipulación de case_type)', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.esc@test.com');
    try {
      await page.goto('/expedientes/nuevo');
      const caseType = page.locator('[data-testid="case-type"]');
      const values = await caseType.locator('option').evaluateAll(
        options => options.map(option => (option as HTMLOptionElement).value)
      );
      expect(values).not.toContain('civil');

      uniqueTitleForManipulation = `Transversal Manipulation ${randomUUID()}`;

      await page.evaluate(() => {
        const select = document.querySelector('[data-testid="case-type"]') as HTMLSelectElement;
        const option = document.createElement('option');
        option.value = 'civil';
        option.text = 'civil';
        select.add(option);
        select.value = 'civil';
      });

      await page.fill('[data-testid="case-title"]', uniqueTitleForManipulation);
      await page.click('[data-testid="case-submit"]');

      await page.waitForLoadState('networkidle');

      expect(page.url()).not.toMatch(/\/expedientes\/[a-f0-9\-]+/);

      const { data: createdCases, error: queryErr } = await serviceClient.from('cases').select('id, case_type').eq('title', uniqueTitleForManipulation);
      expect(queryErr).toBeNull();
      expect(createdCases).toEqual([]);
      expect(createdCases?.length).toBe(0);

    } finally {
      await page.close();
      await context.close();
    }
  });
});
