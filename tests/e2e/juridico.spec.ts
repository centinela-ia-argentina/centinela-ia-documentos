import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

test.describe('Centinela IA - Flujo Jurídico E2E', () => {

  test('Flujo completo: Creación de expediente, subida concurrente, checklist y agenda', async ({ page }) => {
    // 1. Login usando los datos del seed (admin.legal@test.com)
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL || 'admin.legal@test.com');
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || 'password123');
    await page.click('button[type="submit"]');

    // 2. Verificar Dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard');

    // 3. Crear Expediente con datos estables
    await page.goto('/expedientes/nuevo');
    const caseTitle = `Expediente E2E ${Date.now()}`;
    await page.fill('input[name="title"]', caseTitle);
    await page.fill('input[name="client_name"]', 'Cliente E2E');
    await page.selectOption('select[name="case_type"]', 'sucesion');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/expedientes\/.+/);
    await expect(page.locator('h1')).toContainText(caseTitle);

    // Obtener el ID del caso desde la URL
    const caseUrl = page.url();
    const caseId = caseUrl.split('/').pop() || '';

    // 4. Calcular Tasa de Justicia
    await page.goto(`/herramientas/tasa-justicia`);
    await page.fill('input[name="monto"]', '28000000'); // 28M
    await page.selectOption('select[name="jurisdiction"]', 'CABA');
    await expect(page.locator('body')).toContainText('840.000');

    // 5. Subir documentos (simulando upload concurrente)
    await page.goto('/documentos/subir');
    await page.selectOption('select[name="case_id"]', { value: caseId });
    await page.selectOption('select[name="document_type"]', 'DNI');

    // Crear archivos dummy en memoria
    const filePayloads = Array.from({ length: 5 }).map((_, i) => ({
      name: `doc_prueba_${randomUUID()}_${i}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 E2E Test Document ' + i + randomUUID()),
    }));

    await page.setInputFiles('input[type="file"]', filePayloads);
    await page.click('button[type="submit"]');

    // Esperar a que redirija al documento o al dashboard (según la acción de subir múltiple)
    // Actualmente 'uploadDocument' redirige a /documentos/[id] si es single, pero si es múltiple
    // depende de la UI. Vamos a buscar simplemente que desaparezca el botón de "Subiendo".
    await expect(page.locator('button[type="submit"]')).not.toContainText('Subiendo', { timeout: 15000 });

    // 6. Volver al Expediente y Verificar Checklist
    await page.goto(caseUrl);
    await expect(page.locator('text="Checklist"')).toBeVisible();

    // 7. Transiciones de Checklist (Pending -> Received -> Reviewed -> Pending)
    const firstChecklistBtn = page.locator('form[action*="toggleChecklistItem"] button').first();
    if (await firstChecklistBtn.isVisible()) {
       await firstChecklistBtn.click();
       await page.waitForTimeout(500);
       await firstChecklistBtn.click();
       await page.waitForTimeout(500);
       await firstChecklistBtn.click();
       await page.waitForTimeout(500);
    }

    // 8. Agenda (09:30)
    await page.goto('/agenda');
    await page.fill('input[name="titulo"]', 'Audiencia E2E ' + Date.now());
    await page.fill('input[name="fecha"]', '2027-01-01');
    await page.fill('input[name="hora"]', '09:30');
    await page.selectOption('select[name="categoria"]', 'Audiencia');
    await page.click('button[type="submit"]');

    // Validar existencia de la agenda creada
    await expect(page.locator('body')).toContainText('09:30');
  });
});
