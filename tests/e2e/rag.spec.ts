import { test, expect, type Browser } from '@playwright/test';
import { loginAs } from './helpers';

const CASE_LEGAL_ID = 'cccc1111-1111-1111-1111-111111111111';
const CASE_INM_ID = 'dddd2222-2222-2222-2222-222222222222';
const CASE_ESC_ID = 'eeee3333-3333-3333-3333-333333333333';
const CASE_RAG_NO_EVIDENCE_ID = 'cccc1111-1111-1111-1111-111111111113';

const FORBIDDEN_MARKERS = [
  'RAG_E2E_LEGAL_OTHER_CASE_MARKER',
  'RAG_E2E_INMOBILIARIA_MARKER',
  'RAG_E2E_ESCRIBANIA_MARKER',
];

async function assertDeterministicRag({
  browser,
  email,
  caseId,
  question,
  expectedAnswer,
  expectedFile,
  expectedMarker,
  forbiddenMarkers,
}: {
  browser: Browser;
  email: string;
  caseId: string;
  question: string;
  expectedAnswer: string;
  expectedFile: string;
  expectedMarker: string;
  forbiddenMarkers: string[];
}) {
  const { context, page } = await loginAs(browser, email);
  try {
    await page.goto(`/expedientes/${caseId}?tab=documentos`);
    await expect(page.locator('[data-testid="rag-input"]')).toBeVisible();
    await page.fill('[data-testid="rag-input"]', question);
    await page.click('[data-testid="rag-submit"]');

    const response = page.locator('[data-testid="rag-response"]');
    await expect(response).toBeVisible({ timeout: 15000 });
    await expect(response).toContainText(expectedAnswer);
    await expect(response.locator('sup')).toHaveText('1');
    await expect(response).not.toContainText('RAG_E2E_CONTAMINATION_DETECTED');

    const sources = page.locator('[data-testid="rag-sources"]');
    await expect(sources).toBeVisible();
    await expect(sources.locator('details')).toHaveCount(1);
    await expect(sources).toContainText(expectedFile);
    await expect(sources).toContainText(expectedMarker);

    for (const marker of forbiddenMarkers) {
      await expect(sources).not.toContainText(marker);
    }
  } finally {
    await page.close();
    await context.close();
  }
}

test.describe('Centinela IA - RAG determinista, fuentes y aislamiento', () => {
  test('A. Jurídico responde con fuente propia y sin contaminación', async ({ browser }) => {
    await assertDeterministicRag({
      browser,
      email: 'admin.legal@test.com',
      caseId: CASE_LEGAL_ID,
      question: '¿Qué cláusula jurídica contiene el expediente?',
      expectedAnswer: 'Respuesta jurídica E2E: el expediente contiene la cláusula legal determinista',
      expectedFile: 'rag-juridico.pdf',
      expectedMarker: 'RAG_E2E_LEGAL_MARKER',
      forbiddenMarkers: FORBIDDEN_MARKERS,
    });
  });

  test('B. Inmobiliaria responde con fuente propia y tono vertical', async ({ browser }) => {
    await assertDeterministicRag({
      browser,
      email: 'admin.inm@test.com',
      caseId: CASE_INM_ID,
      question: '¿Qué inmueble identifica la operación?',
      expectedAnswer: 'Respuesta inmobiliaria E2E: la operación identifica el inmueble determinista',
      expectedFile: 'rag-inmobiliaria.pdf',
      expectedMarker: 'RAG_E2E_INMOBILIARIA_MARKER',
      forbiddenMarkers: [
        'RAG_E2E_LEGAL_MARKER',
        'RAG_E2E_LEGAL_OTHER_CASE_MARKER',
        'RAG_E2E_ESCRIBANIA_MARKER',
      ],
    });
  });

  test('C. Escribanía responde con fuente propia y tono vertical', async ({ browser }) => {
    await assertDeterministicRag({
      browser,
      email: 'admin.esc@test.com',
      caseId: CASE_ESC_ID,
      question: '¿Qué matrícula identifica el acto?',
      expectedAnswer: 'Respuesta notarial E2E: el acto identifica la matrícula determinista',
      expectedFile: 'rag-escribania.pdf',
      expectedMarker: 'RAG_E2E_ESCRIBANIA_MARKER',
      forbiddenMarkers: [
        'RAG_E2E_LEGAL_MARKER',
        'RAG_E2E_LEGAL_OTHER_CASE_MARKER',
        'RAG_E2E_INMOBILIARIA_MARKER',
      ],
    });
  });

  test('D. Sin evidencia devuelve respuesta segura y ninguna fuente', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.legal@test.com');
    try {
      await page.goto(`/expedientes/${CASE_RAG_NO_EVIDENCE_ID}?tab=documentos`);
      await expect(page.locator('[data-testid="rag-input"]')).toBeVisible();
      await page.fill('[data-testid="rag-input"]', '¿Qué información contiene este documento?');
      await page.click('[data-testid="rag-submit"]');

      const response = page.locator('[data-testid="rag-response"]');
      await expect(response).toBeVisible({ timeout: 15000 });
      await expect(response).toHaveText(
        'No encontré información relacionada en los documentos de este legajo. Puede que todavía no estén analizados con IA (indexados): analizalos desde la pestaña Documentos y volvé a preguntar.'
      );
      await expect(page.locator('[data-testid="rag-sources"]')).toHaveCount(0);
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('E. Un usuario no puede abrir el RAG de otro tenant', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'admin.legal@test.com');
    try {
      const response = await page.goto(`/expedientes/${CASE_INM_ID}?tab=documentos`);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
      await expect(page.locator('[data-testid="rag-input"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="rag-response"]')).toHaveCount(0);
    } finally {
      await page.close();
      await context.close();
    }
  });
});
