import type { ItemStack } from '../types';

/**
 * P5.2 — Server-authoritative player state / consumable rules (pure, testable).
 */

export interface PlayerStatePayload {
  health: number;
  hunger: number;
  oxygen: number;
}

/** Clamp a client-uploaded player state into the valid ranges. */
export function clampPlayerState(payload: Partial<PlayerStatePayload>): PlayerStatePayload {
  const num = (value: number | undefined, fallback: number, max: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.max(0, Math.min(max, value));
  };
  return {
    health: num(payload.health, 20, 20),
    hunger: num(payload.hunger, 20, 20),
    oxygen: num(payload.oxygen, 15, 15),
  };
}

/**
 * Whether a server-side consumable use is valid: the slot holds the item with
 * at least one count (1.20.1-style server check).
 */
export function validateConsume(stack: { id: number; count: number } | null | undefined, itemId: number): boolean {
  return !!stack && stack.id === itemId && stack.count > 0;
}

/** Deduct one item from a stack; returns the updated stack (null when empty). */
export function consumeOne(stack: { id: number; count: number }): { id: number; count: number } | null {
  const count = stack.count - 1;
  return count > 0 ? { ...stack, count } : null;
}

export interface ConsumeWithRemainderResult {
  stack: ItemStack | null;
  remainder: ItemStack | null;
}

/**
 * Consume one item while preserving Java container remainders.
 * When the consumed stack empties, the remainder replaces it in-place.
 * Otherwise the remainder must be inserted into inventory or dropped.
 */
export function consumeOneWithRemainder(
  stack: ItemStack,
  remainderItemId?: number,
): ConsumeWithRemainderResult {
  const remainingCount = stack.count - 1;
  if (remainingCount <= 0) {
    return {
      stack: remainderItemId === undefined ? null : { id: remainderItemId, count: 1 },
      remainder: null,
    };
  }
  return {
    stack: { ...stack, count: remainingCount },
    remainder: remainderItemId === undefined ? null : { id: remainderItemId, count: 1 },
  };
}
