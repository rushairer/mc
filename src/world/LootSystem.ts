import type { BlockDef } from '../types';

/**
 * P2.7 — Data-driven loot tables.
 *
 * Pure, replayable roll engine: given a loot table and an RNG function the
 * outcome is fully deterministic, so unit tests can pin exact drops. Block
 * drops, fishing and (in the future) structure chests share the same shape as
 * Java 1.20.1 loot tables (pools → weighted entries).
 */

export interface LootEntry {
  itemId: number;
  min: number;
  max: number;
  /** Weight for weighted single-pick pools; defaults to 1. */
  weight?: number;
  /** Independent probability gate; entry is kept only when rng() < chance. */
  chance?: number;
}

export interface LootPool {
  entries: LootEntry[];
  /** Fixed roll count or a [min, max] inclusive range. */
  rolls: number | { min: number; max: number };
}

export interface LootTable {
  pools: LootPool[];
}

export interface LootRoll {
  itemId: number;
  count: number;
}

export const EMPTY_LOOT_TABLE: LootTable = { pools: [] };

/** Pick one weighted entry from a pool (replaces the old ad-hoc pick loops). */
export function pickWeightedLootEntry(entries: readonly LootEntry[], rng: () => number): LootEntry | undefined {
  if (entries.length === 0) return undefined;
  if (entries.length === 1) return entries[0];
  const total = entries.reduce((sum, entry) => sum + (entry.weight ?? 1), 0);
  let pick = rng() * total;
  for (const entry of entries) {
    pick -= entry.weight ?? 1;
    if (pick <= 0) return entry;
  }
  return entries[entries.length - 1];
}

/** Roll a loot table; consumes rng() deterministically per roll. */
export function rollLootTable(table: LootTable, rng: () => number): LootRoll[] {
  const results: LootRoll[] = [];
  for (const pool of table.pools) {
    const rollCount =
      typeof pool.rolls === 'number'
        ? pool.rolls
        : pool.rolls.min + Math.floor(rng() * (pool.rolls.max - pool.rolls.min + 1));
    for (let i = 0; i < rollCount; i++) {
      const entry = pickWeightedLootEntry(pool.entries, rng);
      if (!entry) continue;
      if (entry.chance !== undefined && rng() >= entry.chance) continue;
      const count = entry.min === entry.max ? entry.min : entry.min + Math.floor(rng() * (entry.max - entry.min + 1));
      results.push({ itemId: entry.itemId, count });
    }
  }
  return results;
}

/**
 * Built-in block loot tables, keyed by registry name. Replaces the legacy
 * `BLOCK_DROP_OVERRIDES` map in ItemRegistry with data-driven tables.
 */
export const BLOCK_LOOT_TABLES: Readonly<Record<string, LootTable>> = {
  'grass': { pools: [{ rolls: 1, entries: [{ itemId: 3, min: 1, max: 1 }] }] },          // grass -> dirt
  'coal_ore': { pools: [{ rolls: 1, entries: [{ itemId: 263, min: 1, max: 1 }] }] },     // -> coal
  'bed': { pools: [{ rolls: 1, entries: [{ itemId: 355, min: 1, max: 1 }] }] },          // bed block -> bed item
  'diamond_ore': { pools: [{ rolls: 1, entries: [{ itemId: 264, min: 1, max: 1 }] }] },  // -> diamond
  'redstone_ore': { pools: [{ rolls: 1, entries: [{ itemId: 331, min: 1, max: 1 }] }] }, // -> redstone dust
  'lapis_ore': { pools: [{ rolls: 1, entries: [{ itemId: (4 << 10) | 351, min: 1, max: 1 }] }] }, // lapis lazuli (dye metadata 4)
  'gravel': { pools: [{ rolls: 1, entries: [{ itemId: 318, min: 1, max: 1, weight: 1 }, { itemId: 13, min: 1, max: 1, weight: 9 }] }] }, // flint 10% / gravel 90%
  'clay': { pools: [{ rolls: 1, entries: [{ itemId: 337, min: 1, max: 1 }] }] },         // clay block -> clay ball
  'cauldron': { pools: [{ rolls: 1, entries: [{ itemId: 380, min: 1, max: 1 }] }] },     // cauldron block -> cauldron item
};

/** Named loot tables addressable from `BlockDef.lootTable` (data pack hook). */
export const NAMED_LOOT_TABLES: Readonly<Record<string, LootTable>> = {
  'minecraft:blocks/gravel': BLOCK_LOOT_TABLES['gravel'],
};

export function getBlockLootTable(block: BlockDef | undefined): LootTable {
  if (!block) return EMPTY_LOOT_TABLE;
  if (block.lootTable) {
    const named = NAMED_LOOT_TABLES[block.lootTable];
    if (named) return named;
  }
  const namedByBlock = BLOCK_LOOT_TABLES[block.name];
  if (namedByBlock) return namedByBlock;
  // Default: the block drops itself (or its configured dropsId).
  const dropId = block.dropsId ?? block.id;
  return { pools: [{ rolls: 1, entries: [{ itemId: dropId, min: 1, max: 1 }] }] };
}

export function rollBlockLoot(block: BlockDef | undefined, rng: () => number): LootRoll[] {
  return rollLootTable(getBlockLootTable(block), rng);
}
