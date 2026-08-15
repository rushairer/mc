/**
 * P5.1 — Server-authoritative item action rules (pure, testable).
 * The client sends a minimal intent (throw / bow release) and the server
 * derives projectile params and consumes the item/ammo.
 */

export const BOW_BASE_DAMAGE = 6;
export const BOW_MIN_SPEED = 18;
export const BOW_MAX_SPEED = 32;

export type ItemActionKind = 'throw' | 'bow_release';

export interface ItemActionRequest {
  action: ItemActionKind;
  itemId: number;
  /** Bow charge power 0..1 (bow_release). */
  power?: number;
  /** Extra damage (P3.3 Power enchant) for bow_release. */
  damageBonus?: number;
}

export interface BowReleaseParams {
  damage: number;
  speed: number;
}

/** Validate and normalize a C2S_ITEM_ACTION payload. */
export function parseItemAction(payload: unknown): ItemActionRequest | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  const action = raw.action;
  if (action !== 'throw' && action !== 'bow_release') return null;
  const itemId = Number(raw.itemId);
  if (!Number.isInteger(itemId) || itemId <= 0) return null;
  const power = raw.power === undefined ? undefined : Math.max(0, Math.min(1, Number(raw.power)));
  const damageBonus = raw.damageBonus === undefined ? undefined : Math.max(0, Number(raw.damageBonus));
  return { action, itemId, power, damageBonus };
}

/** Derive arrow damage/speed from the bow charge power (Java 1.20.1). */
export function getBowReleaseParams(power: number, damageBonus = 0): BowReleaseParams {
  const clamped = Math.max(0, Math.min(1, power));
  return {
    damage: Math.max(1, BOW_BASE_DAMAGE * clamped) + damageBonus,
    speed: BOW_MIN_SPEED + (BOW_MAX_SPEED - BOW_MIN_SPEED) * clamped,
  };
}
