import { Browser, expect } from '@playwright/test';

export async function loginAs(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('/login');
  await page.fill('[data-testid="login-email"]', email);
  await page.fill('[data-testid="login-password"]', process.env.TEST_USER_PASSWORD || 'password123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator('[data-testid="dashboard-title"]')).toContainText('Bienvenido');

  return { context, page };
}
