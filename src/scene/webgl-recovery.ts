// Ported from VedicAstrologer (same author, MIT), components/3d/webgl-recovery.ts.
/**
 * Delays for one automatic WebGL recovery incident. The finite tuple is also
 * the retry budget: callers must stop when `getWebGLRecoveryDelay` returns
 * `null`, leaving the explicit Retry control available to the user.
 */
export const WEBGL_RECOVERY_DELAYS_MS = [180, 480, 900] as const;

export function getWebGLRecoveryDelay(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 0) return null;
  return WEBGL_RECOVERY_DELAYS_MS[attempt] ?? null;
}
