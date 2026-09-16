export const BOW_FULL_CHARGE_SECONDS = 1;
export const BOW_MIN_RELEASE_SECONDS = 3 / 20;
export const CROSSBOW_BASE_CHARGE_SECONDS = 1.25;
export const QUICK_CHARGE_REDUCTION_SECONDS = 0.25;

export function getBowPower(chargeSeconds: number): number {
  const normalized = Math.min(1, Math.max(0, chargeSeconds / BOW_FULL_CHARGE_SECONDS));
  return Math.min(1, (normalized * normalized + normalized * 2) / 3);
}

export function canReleaseBow(chargeSeconds: number): boolean {
  return chargeSeconds >= BOW_MIN_RELEASE_SECONDS;
}

/** Java Quick Charge I-III removes 0.25 seconds of crossbow load time per level. */
export function getCrossbowChargeSeconds(quickChargeLevel: number): number {
  const level = Math.max(0, Math.floor(quickChargeLevel));
  return Math.max(0, CROSSBOW_BASE_CHARGE_SECONDS - level * QUICK_CHARGE_REDUCTION_SECONDS);
}
