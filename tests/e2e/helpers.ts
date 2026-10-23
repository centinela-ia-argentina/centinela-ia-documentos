import { Browser, Page, expect } from '@playwright/test';

// Check the hydrated greeting against the browser's local clock, not the runner's timezone.
// Re-read both in every poll so a boundary crossing cannot make the assertion flaky.
export async function expectDashboardGreeting(page: Page) {
  const title = page.locator('[data-testid="dashboard-title"]');
  await expect(title).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => title.evaluate((element) => {
    const hour = new Date().getHours();
    const greeting = hour < 6 ? 'Buenas noches' : hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
    const text = element.textContent?.trim() ?? '';
    return text.startsWith(`${greeting}, `) && text.endsWith('.') && text.length > greeting.length + 3;
  })).toBe(true);
}

export async function loginAs(browser: Browser, email: string) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  await page.goto('/login');
  await page.fill('[data-testid="login-email"]', email);
  await page.fill('[data-testid="login-password"]', process.env.TEST_USER_PASSWORD || 'password123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/dashboard/);
  await expectDashboardGreeting(page);

  return { context, page };
}

// UI V3 disclosures keep their forms mounted; open them through the actual control.
export async function openChecklistManagement(page: Page, index = 0) {
  const row = page.getByTestId(`checklist-item-${index}`);
  const details = row.locator('details').first();
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  await expect(row.getByTestId(`select-doc-${index}`)).toBeVisible();
  return row;
}
export async function confirmChecklistReview(page: Page, title: string) {
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await expect(dialog).toBeVisible();
  const [response] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST' &&
      Boolean(response.request().headers()['next-action'])),
    dialog.getByRole('button', { name: 'Confirmar', exact: true }).click(),
  ]);
  await response.finished();
}
export async function closeChecklistReview(page: Page) {
  // Void server actions revalidate without navigation; dismissal remains explicit.
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
}
export async function openDocumentQuestion(page: Page) {
  const input = page.getByTestId('rag-input');
  const details = page.locator('details').filter({ has: input });
  if (await details.getAttribute('open') === null) await details.locator('summary').first().click();
  await expect(input).toBeVisible();
}
