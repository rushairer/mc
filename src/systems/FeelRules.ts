/**
 * P4.4 — Damage feedback rules (pure, testable).
 */

/** Normalized 0..1 damage flash for the red vignette overlay. */
export function normalizeDamageFlash(timer: number, duration = 0.3): number {
  return Math.min(1, Math.max(0, timer / duration));
}

/** Camera shake magnitude while the damage flash is active. */
export function getDamageShake(timer: number): number {
  return timer > 0 ? Math.min(0.05, timer * 0.18) : 0;
}

/** Red vignette opacity from the normalized flash. */
export function getVignetteOpacity(flash: number): number {
  return Math.min(0.85, flash * 0.75);
}
