import type { MobType } from '../entities/Mob';

const SPAWN_EGG_SUFFIX = '_spawn_egg';

const IMPLEMENTED_SPAWN_EGG_MOBS = new Set<MobType>([
  'zombie',
  'skeleton',
  'creeper',
  'spider',
  'cow',
  'pig',
  'sheep',
  'chicken',
  'blaze',
  'zombie_pigman',
  'magma_cube',
  'wither_skeleton',
  'villager',
  'enderman',
  'witch',
  'iron_golem',
  'wolf',
  'cat',
  'horse',
  'shulker',
  'pillager',
  'guardian',
  'vex',
]);

const SPAWN_EGG_ENTITY_ALIASES: Readonly<Record<string, MobType>> = {
  zombified_piglin: 'zombie_pigman',
  zombie_pigman: 'zombie_pigman',
};

function stripNamespace(name: string): string {
  return name.replace(/^minecraft:/, '');
}

export function isSpawnEggItemName(rawName: string): boolean {
  return stripNamespace(rawName).endsWith(SPAWN_EGG_SUFFIX);
}

export function spawnEggMobTypeForItemName(rawName: string): MobType | null {
  const name = stripNamespace(rawName);
  if (!name.endsWith(SPAWN_EGG_SUFFIX)) return null;

  const entityName = name.slice(0, -SPAWN_EGG_SUFFIX.length);
  const aliased = SPAWN_EGG_ENTITY_ALIASES[entityName];
  if (aliased) return aliased;

  return IMPLEMENTED_SPAWN_EGG_MOBS.has(entityName as MobType)
    ? entityName as MobType
    : null;
}
