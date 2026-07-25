export function isSeguridadFeatureEnabled(): boolean {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.FEATURE_SEGURIDAD !== undefined) {
      return process.env.FEATURE_SEGURIDAD === 'true';
    }
    if (process.env.NEXT_PUBLIC_FEATURE_SEGURIDAD !== undefined) {
      return process.env.NEXT_PUBLIC_FEATURE_SEGURIDAD === 'true';
    }
  }
  return false;
}
