import { test, expect } from '@playwright/test';
import { loginAs, expectFullscreenShell } from './helpers';

// Read-only navigation against CI's disposable, seeded Supabase, never live data.
const profiles = [
  ['admin.legal@test.com', 'admin jurídico'],
  ['emp.legal@test.com', 'empleado jurídico'],
  ['auditor.legal@test.com', 'auditor jurídico'],
  ['client.assigned@test.com', 'cliente jurídico'],
  ['admin.inm@test.com', 'admin inmobiliaria'],
  ['admin.esc@test.com', 'admin escribanía'],
  ['emp.esc@test.com', 'empleado escribanía'],
  ['auditor.esc@test.com', 'auditor escribanía'],
  ['client.esc@test.com', 'cliente escribanía'],
] as const;

for (const [email, label] of profiles) {
  for (const width of [390, 1440]) {
    test(`V3 navegación autenticada · ${label} · ${width}px`, async ({ browser }) => {
      const { context, page } = await loginAs(browser, email);
      try {
        await page.setViewportSize({ width, height: 900 });
        const isClient = email.startsWith('client.');
        for (const route of ['/dashboard', '/documentos', '/agenda', '/expedientes']) {
          await test.step(`${route}: ${isClient && route === '/agenda' ? 'acceso denegado por rol' : 'navegación permitida'}`, async () => {
            await page.goto(route);
            // Middleware intentionally restricts Agenda to operators/auditors.
            // Assert the restriction, then continue testing the client's allowed routes.
            if (isClient && route === '/agenda') {
              await expect(page).toHaveURL(/\/acceso-denegado\?motivo=rol/);
              await expect(page.getByRole('heading', { name: 'Permiso insuficiente', exact: true })).toBeVisible();
              return;
            }
            await expect(page).not.toHaveURL(/\/(login|acceso-denegado|onboarding)/);
            await expect(page.locator('[data-visual-system="v3"]')).toBeVisible();
            await expect(page.getByRole('main')).toBeVisible();
            await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible();
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
            await expectFullscreenShell(page);
          });
        }
        const trigger = page.getByRole('button', { name: 'Abrir navegación', exact: true });
        if (width === 390) {
          await expect(trigger).toBeVisible();
          await trigger.click();
          const drawer = page.getByRole('dialog', { name: 'Navegación de Anulus', exact: true });
          await expect(drawer).toBeVisible();
          await expect(drawer.getByRole('button', { name: 'Cerrar navegación', exact: true })).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(drawer).not.toBeVisible();
          await expect(trigger).toBeFocused();
        } else {
          await expect(trigger).not.toBeVisible();
        }
        if (email.startsWith('auditor.') || email.startsWith('client.')) {
          await page.goto('/agente');
          await expect(page).toHaveURL(/\/acceso-denegado\?motivo=rol/);
        }
      } finally {
        await context.close();
      }
    });
  }
}
