import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { EnchantSystem } from '../systems/EnchantSystem';

/**
 * P5.1 — Server-authoritative item action rules (pure, testable).
 * The client sends only an intent and aim direction. Damage/enchantment values
 * are derived from the server-owned inventory stack.
 */

export const BOW_BASE_DAMAGE = 6;
export const BOW_MIN_SPEED = 18;
export const BOW_MAX_SPEED = 32;

export type ItemActionKind = 'throw' | 'bow_release' | 'ender_eye_throw';
export type ThrowableProjectileType = 'snowball' | 'egg' | 'ender_pearl' | 'potion' | 'trident' | 'firework_rocket' | 'experience_bottle';

export interface ItemActionRequest {
  action: ItemActionKind;
  itemId: number;
  /** Bow charge power 0..1 (bow_release). */
  power?: number;
  direction: { x: number; y: number; z: number };
}

export interface BowReleaseParams {
  damage: number;
  speed: number;
}

function normalizeDirection(x: unknown, y: unknown, z: unknown): ItemActionRequest['direction'] | null {
  const dx = x === undefined ? 0 : Number(x);
  const dy = y === undefined ? 0 : Number(y);
  const dz = z === undefined ? -1 : Number(z);
  if (![dx, dy, dz].every(Number.isFinite)) return null;
  const length = Math.hypot(dx, dy, dz);
  if (length <= 1e-9) return null;
  return { x: dx / length, y: dy / length, z: dz / length };
}

/** Validate and normalize a C2S_ITEM_ACTION payload. */
export function parseItemAction(payload: unknown): ItemActionRequest | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  const action = raw.action;
  if (action !== 'throw' && action !== 'bow_release' && action !== 'ender_eye_throw') return null;
  const itemId = Number(raw.itemId);
  if (!Number.isInteger(itemId) || itemId <= 0) return null;

  let power: number | undefined;
  if (raw.power !== undefined) {
    const parsed = Number(raw.power);
    if (!Number.isFinite(parsed)) return null;
    power = Math.max(0, Math.min(1, parsed));
  }

  const direction = normalizeDirection(raw.dirX, raw.dirY, raw.dirZ);
  if (!direction) return null;
  return { action, itemId, power, direction };
}

/**
 * Derive arrow damage/speed from bow charge and the server-owned Power level.
 * In pre-1.21 Java, Power increases arrow base damage by 25% * (level + 1).
 */
export function getBowReleaseParams(power: number, powerLevel = 0): BowReleaseParams {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(power) ? power : 0));
  const level = Math.max(0, Math.floor(powerLevel));
  const powerMultiplier = level > 0 ? 1 + 0.25 * (level + 1) : 1;
  return {
    damage: Math.max(1, BOW_BASE_DAMAGE * clamped * powerMultiplier),
    speed: BOW_MIN_SPEED + (BOW_MAX_SPEED - BOW_MIN_SPEED) * clamped,
  };
}

export function getBowPowerLevel(stack: ItemStack | null | undefined): number {
  return EnchantSystem.getLevel(stack, 'power');
}

export function getThrowableProjectileType(itemId: number): ThrowableProjectileType | null {
  const def = ItemRegistry.get(itemId);
  const name = def?.name ?? '';
  const baseId = itemId & 0x3FF;
  if (name === 'snowball' || baseId === 332) return 'snowball';
  if (name === 'egg' || baseId === 344) return 'egg';
  if (name === 'ender_pearl' || baseId === 368) return 'ender_pearl';
  if (name.includes('potion') || baseId === 373) return 'potion';
  if (def?.toolType === 'trident' || name === 'trident') return 'trident';
  if (name === 'firework_rocket' || name === 'fireworks') return 'firework_rocket';
  if (name === 'experience_bottle' || baseId === 384) return 'experience_bottle';
  return null;
}

/** Reject spoofed item ids and action kinds that do not match the held stack. */
export function isValidItemActionForHeldStack(
  request: ItemActionRequest,
  held: ItemStack | null | undefined,
): boolean {
  if (!held || held.count <= 0 || held.id !== request.itemId) return false;
  const def = ItemRegistry.get(held.id);
  if (request.action === 'bow_release') return def?.toolType === 'bow' || def?.name === 'bow';
  if (request.action === 'ender_eye_throw') return def?.name === 'ender_eye' || (held.id & 0x3ff) === 381;
  return getThrowableProjectileType(held.id) !== null;
}

/** Client damage bonuses are never trusted; the server reads Power from this stack. */
export function getServerBowPowerLevel(held: ItemStack | null | undefined): number {
  return getBowPowerLevel(held);
}
