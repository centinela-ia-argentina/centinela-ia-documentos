import { describe, it, expect } from 'vitest';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import mammoth from 'mammoth';
import { validateFileContent } from './fileValidation';

describe('DOCX Extraction and Validation (@xmldom/xmldom compatibility)', () => {
  it('1. Valida estructura de archivo DOCX y extrae texto correctamente con mammoth', async () => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun('Documento de prueba notarial y procesal para Centinela IA.'),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun('Verificación de compatibilidad con @xmldom/xmldom >= 0.8.15.'),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    // 1. Confirmar validación de archivo DOCX
    const isValidDocx = validateFileContent(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer
    );
    expect(isValidDocx).toBe(true);

    // 2. Confirmar extracción de texto con mammoth
    const extractionResult = await mammoth.extractRawText({ buffer });
    expect(extractionResult.value).toContain('Documento de prueba notarial y procesal para Centinela IA.');
    expect(extractionResult.value).toContain('Verificación de compatibilidad con @xmldom/xmldom >= 0.8.15.');
    expect(extractionResult.messages).toEqual([]);
  });

  it('2. Maneja errores de forma segura ante buffers DOCX corruptos o inválidos', async () => {
    const corruptBuffer = Buffer.from('PK\x03\x04corrupted_docx_content_without_valid_xml');

    await expect(mammoth.extractRawText({ buffer: corruptBuffer })).rejects.toThrow();
  });
});
