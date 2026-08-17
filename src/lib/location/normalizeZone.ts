export function normalizeZone(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD') // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ''); // Remove basic punctuation
}
