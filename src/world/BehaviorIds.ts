const stripNamespace = (name: string) => name.replace(/^minecraft:/, '');

const FURNACE_NAMES = new Set(['furnace', 'lit_furnace', 'smoker', 'blast_furnace']);
const CAULDRON_NAMES = new Set(['cauldron', 'water_cauldron', 'lava_cauldron']);
const COMPARATOR_NAMES = new Set(['comparator', 'unpowered_comparator', 'powered_comparator']);
const READABLE_ITEM_NAMES = new Set(['map', 'filled_map', 'writable_book', 'written_book']);
const THROWABLE_ITEM_NAMES = new Set([
  'snowball',
  'egg',
  'ender_pearl',
  'trident',
  'fireworks',
  'firework_rocket',
]);

/**
 * Compatibility mapping from registry names to stable behavior references.
 * Data packs may override this by supplying an explicit behaviorId.
 */
export function inferBlockBehaviorId(rawName: string): string | undefined {
  const name = stripNamespace(rawName);

  if (CAULDRON_NAMES.has(name)) return 'minecraft:cauldron';
  if (FURNACE_NAMES.has(name)) return 'minecraft:furnace';
  if (COMPARATOR_NAMES.has(name)) return 'minecraft:comparator';
  if (name === 'composter') return 'minecraft:composter';
  if (name === 'cake') return 'minecraft:cake';
  if (name === 'bell') return 'minecraft:bell';
  if (name === 'campfire' || name === 'soul_campfire') return 'minecraft:campfire';
  if (name === 'crafting_table') return 'minecraft:crafting_table';
  if (name === 'chest' || name === 'barrel') return 'minecraft:storage';
  if (name === 'hopper') return 'minecraft:hopper';
  if (name === 'enchanting_table') return 'minecraft:enchanting_table';
  if (name.includes('anvil')) return 'minecraft:anvil';
  if (name === 'brewing_stand') return 'minecraft:brewing_stand';
  if (name === 'daylight_detector' || name === 'daylight_detector_inverted') return 'minecraft:daylight_detector';
  if (name === 'lever') return 'minecraft:lever';
  if (name === 'tnt') return 'minecraft:tnt';
  if (name === 'bed' || (name.endsWith('_bed') && name !== 'bedrock')) return 'minecraft:bed';
  if (name.includes('trapdoor') && name !== 'iron_trapdoor') return 'minecraft:trapdoor';
  if (name.endsWith('_door') && name !== 'iron_door') return 'minecraft:door';

  return undefined;
}

export function inferItemBehaviorId(rawName: string): string | undefined {
  const name = stripNamespace(rawName);

  if (READABLE_ITEM_NAMES.has(name)) return 'minecraft:readable';
  if (name === 'bow') return 'minecraft:bow';
  if (name === 'crossbow') return 'minecraft:crossbow';
  if (name === 'shield') return 'minecraft:shield';
  if (name === 'potion') return 'minecraft:potion';
  if (name === 'bucket' || name === 'water_bucket' || name === 'lava_bucket') return 'minecraft:bucket';
  if (name.includes('boat')) return 'minecraft:boat';
  if (name.includes('minecart')) return 'minecraft:minecart';
  if (name === 'flint_and_steel') return 'minecraft:flint_and_steel';
  if (name.endsWith('_hoe')) return 'minecraft:hoe';
  if (name === 'fishing_rod') return 'minecraft:fishing_rod';
  if (THROWABLE_ITEM_NAMES.has(name)) return 'minecraft:throwable';
  if (name === 'ender_eye') return 'minecraft:ender_eye';

  return undefined;
}
