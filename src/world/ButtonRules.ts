/**
 * P3.1 — Data-driven rules for interactive blocks (buttons).
 */

/**
 * Java 1.20.1 button press duration in ticks (20 TPS):
 * - wooden buttons stay pressed 10 ticks (0.5 s)
 * - stone-family buttons stay pressed 30 ticks (1.5 s)
 */
export function getButtonPressTicks(name: string): number {
  if (name === 'stone_button' || name === 'polished_blackstone_button') {
    return 30;
  }
  return 10;
}

/** All button block names currently registered, by press-duration family. */
export function isButtonName(name: string): boolean {
  return name.endsWith('_button');
}

export function isFenceGateName(name: string): boolean {
  return name.includes('fence_gate');
}
