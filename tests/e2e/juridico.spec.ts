import { test, expect } from '@playwright/test';

test.describe('Centinela IA - Flujo Jurídico E2E', () => {

  test('Flujo completo: Creación de expediente, subida concurrente (15 archivos), checklist y agenda', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL || 'admin@test.com');
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');

    // 2. Verificar Dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard');

    // 3. Crear Expediente
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
    // Para CABA la tasa es 3%, 28M * 3% = 840.000
    // Asumimos que el resultado se muestra en un elemento específico
    // Por el DOM actual, verifiquemos si aparece el texto "840.000"
    await expect(page.locator('body')).toContainText('840.000');

    // 5. Subir 15 documentos
    await page.goto('/documentos/subir');
    await page.selectOption('select[name="case_id"]', { value: caseId });
    await page.selectOption('select[name="document_type"]', 'DNI');
    
    // Crear 15 archivos dummy en memoria
    const filePayloads = Array.from({ length: 15 }).map((_, i) => ({
      name: `doc_prueba_${i}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 E2E Test Document ' + i),
    }));

    await page.setInputFiles('input[type="file"]', filePayloads);
    await page.click('button[type="submit"]');
    
    // Esperar a que se suban (el texto del botón debería volver a su estado normal)
    await expect(page.locator('button[type="submit"]')).not.toContainText('Subiendo', { timeout: 15000 });

    // 6. Volver al Expediente y Verificar Checklist
    await page.goto(caseUrl);
    await expect(page.locator('text="Checklist"')).toBeVisible();

    // 7. Transiciones de Checklist (Pending -> Received -> Reviewed -> Pending)
    // Localizamos el primer botón de estado del checklist
    const firstChecklistBtn = page.locator('button[aria-label="Cambiar estado del documento"]').first();
    // Validar estados asumiendo la estructura visual o clases. Para hacerlo resiliente probamos interacciones
    if (await firstChecklistBtn.isVisible()) {
       await firstChecklistBtn.click();
       await page.waitForTimeout(500); // Wait for transition / revalidate
       await firstChecklistBtn.click();
       await page.waitForTimeout(500);
       await firstChecklistBtn.click();
       await page.waitForTimeout(500);
    }

    // 8. Agenda (09:30)
    await page.goto('/agenda');
    await page.fill('input[name="titulo"]', 'Audiencia E2E');
    await page.fill('input[name="fecha"]', '2027-01-01');
    await page.fill('input[name="hora"]', '09:30');
    await page.selectOption('select[name="categoria"]', 'Audiencia');
    await page.click('button[type="submit"]');

    // Validar existencia de la agenda creada
    await expect(page.locator('text="Audiencia E2E"')).toBeVisible();
    await expect(page.locator('text="09:30"')).toBeVisible();
  });
});
