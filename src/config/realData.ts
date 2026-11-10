/**
 * Real-data-only mode.
 *
 * Build with VITE_REAL_DATA_ONLY=true (the dev environment does this) to:
 *  - remove every hardcoded demo fallback (remediations, pillar checks,
 *    integrations, account pickers, demo labels), so an empty DB shows empty
 *    screens instead of invented data;
 *  - turn off features that simulate results instead of scanning (new
 *    assessment wizard, live scan, re-run, schedules, architecture diagram,
 *    compliance scores, canned chat).
 *
 * Unset (the default, e.g. prod builds) keeps today's behaviour.
 */
export const REAL_DATA_ONLY = (import.meta.env.VITE_REAL_DATA_ONLY as string) === 'true';

/** `demo` normally, `real` (default '') in real-data-only mode. */
export function demoOr<T>(demo: T, real: T): T {
  return REAL_DATA_ONLY ? real : demo;
}
