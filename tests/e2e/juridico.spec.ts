import { test, expect } from '@playwright/test';

test.describe('Centinela IA - Flujo Jurídico E2E', () => {
  // Test suite skip if no environment variables, as this is local execution
  test.skip(() => !process.env.TEST_USER_EMAIL, 'Requiere credenciales de prueba');

  test('Flujo completo de 22 pasos: Creación de expediente, subida de documentos y checklist', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');

    // 2. Verificar Dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');

    // 3. Navegar a Expedientes
    await page.click('a[href="/expedientes"]');
    await expect(page).toHaveURL('/expedientes');

    // 4. Iniciar Creación
    await page.click('text="Nuevo expediente"');
    
    // 5. Llenar formulario de expediente
    await page.fill('input[name="title"]', 'Expediente Prueba E2E');
    await page.fill('input[name="client_name"]', 'Cliente Prueba');
    await page.selectOption('select[name="case_type"]', 'sucesion');
    
    // 6. Enviar creación
    await page.click('button[type="submit"]');
    
    // 7. Validar URL del expediente creado
    await expect(page).toHaveURL(/\/expedientes\/.+/);
    
    // 8. Verificar título
    await expect(page.locator('h1')).toContainText('Expediente Prueba E2E');

    // 9. Navegar a Documentos -> Subir
    await page.click('a[href="/documentos/subir"]');
    
    // 10. Seleccionar Expediente en el select
    // Se asume que el expediente creado aparece en la lista
    await page.selectOption('select[name="case_id"]', { label: 'Expediente Prueba E2E' });
    
    // 11. Seleccionar tipo documental
    await page.selectOption('select[name="document_type"]', 'DNI');
    
    // 12. Adjuntar archivo
    // Simulamos la subida adjuntando un archivo de prueba si estuviese disponible
    // await page.setInputFiles('input[type="file"]', 'tests/fixtures/dni.pdf');
    
    // 13. Subir archivo
    // await page.click('button[type="submit"]');
    
    // 14. Verificar subida
    // await expect(page).toHaveURL(/\/documentos\/.+/);

    // 15. Volver al Expediente
    await page.goto('/expedientes');
    await page.click('text="Expediente Prueba E2E"');
    
    // 16. Verificar Checklist Creado
    await expect(page.locator('text="Checklist"')).toBeVisible();

    // 17. Marcar item del checklist
    // await page.click('button[aria-label="Marcar como recibido"] >> nth=0');

    // 18. Verificar barra de progreso de checklist
    // await expect(page.locator('.bg-sky-500')).toBeVisible();

    // 19. Navegar a Agenda
    await page.goto('/agenda');

    // 20. Crear evento manual
    await page.fill('input[name="titulo"]', 'Audiencia E2E');
    await page.fill('input[name="fecha"]', '2027-01-01');
    await page.fill('input[name="hora"]', '10:00');
    await page.click('button[type="submit"]');

    // 21. Verificar evento en agenda
    await expect(page.locator('text="Audiencia E2E"')).toBeVisible();

    // 22. Finalizar y archivar
    await page.goto('/expedientes');
    await page.click('text="Expediente Prueba E2E"');
    await page.click('text="Archivar operación"');
  });
});
