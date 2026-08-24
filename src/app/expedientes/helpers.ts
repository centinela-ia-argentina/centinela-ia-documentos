export function getChecklistItemsToInsert(templateTitles: string[], currentTitles: string[]): string[] {
  const currentSet = new Set(currentTitles);
  return templateTitles.filter(t => !currentSet.has(t));
}

export function getNextChecklistStatus(currentStatus: string): string {
  switch (currentStatus) {
    case 'pending': return 'received';
    case 'received': return 'reviewed';
    case 'reviewed': return 'pending';
    default: return 'pending';
  }
}
