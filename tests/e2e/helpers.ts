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
  // RSC streams can remain open after the action is committed. Callers assert
  // persisted UI/URL state; do not wait for the whole document stream to end.
  expect(response.status()).toBeLessThan(400);
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


// Geometry regression: browser owns the page scroll; header never floats over content.
export async function expectFullscreenShell(page: Page) {
  const shell = page.locator('[data-visual-system="v3"]');
  const initial = await shell.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const css = getComputedStyle(element);
    const header = element.querySelector('header')!;
    const main = element.querySelector('main')!;
    return {
      x: box.x, y: box.y, width: box.width, viewport: document.documentElement.clientWidth,
      margin: css.margin, border: css.borderTopWidth, radius: css.borderTopLeftRadius,
      shadow: css.boxShadow, headerPosition: getComputedStyle(header).position,
      headerBottom: header.getBoundingClientRect().bottom, mainTop: main.getBoundingClientRect().top,
      mainOverflow: getComputedStyle(main).overflowY,
    };
  });
  expect(initial.x).toBeCloseTo(0, 0);
  expect(initial.y).toBeCloseTo(0, 0);
  expect(initial.width).toBeCloseTo(initial.viewport, 0);
  expect(initial.margin).toBe('0px');
  expect(initial.border).toBe('0px');
  expect(initial.radius).toBe('0px');
  expect(initial.shadow).toBe('none');
  expect(initial.headerPosition).toBe('relative');
  expect(initial.mainTop).toBeGreaterThanOrEqual(initial.headerBottom);
  expect(initial.mainOverflow).toBe('visible');
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
  const scrolled = await shell.evaluate((element) => ({
    y: window.scrollY, headerTop: element.querySelector('header')!.getBoundingClientRect().top,
  }));
  expect(scrolled.headerTop).toBeCloseTo(-scrolled.y, 0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}
