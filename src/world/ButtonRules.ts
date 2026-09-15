/**
 * P3.1 — Data-driven rules for interactive blocks (buttons).
 */

/**
 * Java 1.20.1 button press duration in game ticks (20 TPS):
 * - wooden buttons stay pressed 30 ticks (1.5 s)
 * - stone and polished-blackstone buttons stay pressed 20 ticks (1.0 s)
 */
export function getButtonPressTicks(name: string): number {
  if (name === 'stone_button' || name === 'polished_blackstone_button') {
    return 20;
  }
  return 30;
}

/** All button block names currently registered, by press-duration family. */
export function isButtonName(name: string): boolean {
  return name.endsWith('_button');
}

export function isFenceGateName(name: string): boolean {
  return name.includes('fence_gate');
}
