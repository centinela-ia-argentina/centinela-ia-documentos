import { Browser, expect } from '@playwright/test';

export async function loginAs(browser: Browser, email: string) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  await page.goto('/login');
  await page.fill('[data-testid="login-email"]', email);
  await page.fill('[data-testid="login-password"]', process.env.TEST_USER_PASSWORD || 'password123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator('[data-testid="dashboard-title"]')).toContainText('Bienvenido');

  return { context, page };
}
