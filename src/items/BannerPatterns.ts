/**
 * P3.5 — Loom banner patterns (data-driven subset of Java 1.20.1).
 * Applying a pattern requires one banner + one dye. Patterns are stored on the
 * banner item as `patterns` metadata and shown in the item tooltip.
 */

export interface BannerPatternDef {
  id: string;
  name: string;
}

export const BANNER_PATTERNS: BannerPatternDef[] = [
  { id: 'stripe_top', name: 'Base Stripe' },
  { id: 'stripe_middle', name: 'Stripe Middle' },
  { id: 'stripe_bottom', name: 'Base Stripe Bottom' },
  { id: 'stripe_left', name: 'Stripe Left' },
  { id: 'stripe_right', name: 'Stripe Right' },
  { id: 'cross', name: 'Cross' },
  { id: 'border', name: 'Bordure' },
  { id: 'circle', name: 'Circle' },
  { id: 'triangle', name: 'Triangle Top' },
  { id: 'rhombus', name: 'Rhombus' },
  { id: 'gradient', name: 'Gradient' },
  { id: 'creeper', name: 'Creeper Charge' },
  { id: 'skull', name: 'Skull Charge' },
  { id: 'flower', name: 'Flower Charge' },
];

export interface AppliedBannerPattern {
  pattern: string;
  color: string;
}

export function getBannerPatternById(id: string): BannerPatternDef | undefined {
  return BANNER_PATTERNS.find((pattern) => pattern.id === id);
}
