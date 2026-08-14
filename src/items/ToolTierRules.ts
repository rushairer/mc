import type { ItemDef } from './ItemRegistry';

/**
 * P2.7 — Tool tier rules (data-driven harvest levels).
 *
 * Java 1.20.1 harvest tiers: wood 0, gold 0 (fast but cannot harvest above
 * tier 0), stone 1, iron 2, diamond 3, netherite 4. A block tagged
 * `needs_*_tool` only drops when the held tool's tier meets the requirement;
 * a wrong-tier tool still breaks the block but at hand speed and with no drop.
 */

export const TOOL_HARVEST_TIER: Readonly<Record<string, number>> = {
  wood: 0,
  gold: 0,
  stone: 1,
  iron: 2,
  diamond: 3,
  netherite: 4,
};

export function getToolHarvestTier(item: ItemDef | undefined): number {
  if (!item || item.category !== 'tool' || !item.toolMaterial) return 0;
  return TOOL_HARVEST_TIER[item.toolMaterial] ?? 0;
}

/**
 * Whether the held item can harvest a block that requires the given harvest
 * level (0 = no requirement → always true).
 */
export function canHarvestBlock(item: ItemDef | undefined, requiredTier: number): boolean {
  if (requiredTier <= 0) return true;
  if (!item || item.category !== 'tool') return false;
  return getToolHarvestTier(item) >= requiredTier;
}
