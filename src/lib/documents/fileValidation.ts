export const MAGIC_BYTES: Record<string, string[]> = {
  'application/pdf': ['25504446'], // %PDF
  'image/jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe3', 'ffd8ffe8'],
  'image/png': ['89504e47'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['504b0304'], // PK ZIP
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['504b0304'],
};

export function validateFileContent(fileType: string, buffer: Buffer): boolean {
  const hex = buffer.toString('hex', 0, 4).toLowerCase();
  const expectedMagic = MAGIC_BYTES[fileType];
  if (!expectedMagic || !expectedMagic.some(magic => hex.startsWith(magic))) {
    return false;
  }

  // Para DOCX/XLSX, comprobar estructura ZIP adicionalmente
  if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return buffer.includes('[Content_Types].xml') && buffer.includes('word/');
  }
  if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return buffer.includes('[Content_Types].xml') && buffer.includes('xl/');
  }

  return true;
}
