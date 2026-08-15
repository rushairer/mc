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
