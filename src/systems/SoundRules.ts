import type { MobType } from '../entities/Mob';

/**
 * P4.3 — Sound classification rules (pure, testable).
 * Maps blocks to a break/place/step material family and mobs to a sound
 * family so the synthesizer can vary timbre per material/creature.
 */

export type BlockSoundMaterial = 'stone' | 'wood' | 'grass' | 'sand' | 'metal' | 'glass' | 'generic';

export function getBlockSoundMaterial(name: string): BlockSoundMaterial {
  if (name === 'air' || name.includes('water') || name.includes('lava')) return 'generic';
  if (name.includes('glass') || name === 'ice') return 'glass';
  if (
    !name.includes('ore') && (
      name.includes('iron_') || name.includes('gold_') || name.includes('copper_') ||
      name.includes('diamond_') || name.includes('emerald_') || name.includes('netherite_') ||
      name.includes('_block') && (name.includes('coal') || name.includes('lapis') || name.includes('redstone')) ||
      name === 'anvil' || name === 'cauldron' || name.includes('_bars')
    )
  ) return 'metal';
  if (
    name.includes('planks') || name.includes('log') || name.includes('door') ||
    name.includes('trapdoor') || name.includes('fence') || name === 'chest' ||
    name === 'barrel' || name === 'bookshelf' || name === 'crafting_table' ||
    name === 'ladder' || name === 'sign' || name === 'boat'
  ) return 'wood';
  if (name.includes('sand') || name === 'gravel') return 'sand';
  if (
    name.includes('grass') || name === 'dirt' || name.includes('leaves') ||
    name.includes('flower') || name.includes('tulip') || name.includes('crop') ||
    name === 'snow' || name === 'mud' || name.includes('sapling') || name.includes('moss')
  ) return 'grass';
  return 'stone';
}

export type MobSoundFamily =
  | 'zombie' | 'skeleton' | 'creeper' | 'spider' | 'blaze' | 'witch'
  | 'animal' | 'villager' | 'golem' | 'slime' | 'ender' | 'boss' | 'generic';

export function getMobSoundFamily(type: MobType): MobSoundFamily {
  switch (type) {
    case 'zombie':
    case 'zombie_pigman':
    case 'wither_skeleton':
    case 'pillager':
      return 'zombie';
    case 'skeleton':
      return 'skeleton';
    case 'creeper':
      return 'creeper';
    case 'spider':
    case 'guardian':
      return 'spider';
    case 'blaze':
      return 'blaze';
    case 'witch':
      return 'witch';
    case 'cow':
    case 'pig':
    case 'sheep':
    case 'chicken':
    case 'horse':
    case 'wolf':
    case 'cat':
      return 'animal';
    case 'villager':
      return 'villager';
    case 'iron_golem':
      return 'golem';
    case 'magma_cube':
      return 'slime';
    case 'enderman':
    case 'shulker':
    case 'vex':
      return 'ender';
    case 'wither':
      return 'boss';
    default:
      return 'generic';
  }
}

/** Seconds between a mob's ambient idle sounds (near the player only). */
export function getMobIdleInterval(rng: () => number): number {
  return 5 + rng() * 10;
}

/** Animals are the most audible; bosses rarely idle. */
export function shouldMobIdle(family: MobSoundFamily): boolean {
  return family === 'animal' || family === 'villager' || family === 'zombie' || family === 'skeleton' || family === 'creeper';
}
