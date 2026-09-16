import { BlockRegistry } from './BlockRegistry';

export type TeleportActor26_3 = 'chorus_fruit' | 'enderman' | 'shulker';
export type BlockGetter26_3 = (x: number, y: number, z: number) => number;
export interface TeleportPoint26_3 { x: number; y: number; z: number }

export const TELEPORT_ATTEMPTS_26_3 = 16;

/** Concrete Java 26.3 destination exclusions represented by the current runtime. */
export function isTeleportSupportForbidden26_3(actor: TeleportActor26_3, blockId: number): boolean {
  const name = BlockRegistry.get(blockId)?.name ?? '';
  if (name === 'bedrock') return true;
  // MC-106416 explicitly closes powder-snow destinations for Endermen and
  // random consumable teleports. Shulkers have their own destination tag.
  if (name === 'powder_snow') return actor === 'enderman' || actor === 'chorus_fruit';
  return false;
}

export function isSafeTeleportDestination26_3(
  actor: TeleportActor26_3,
  x: number,
  y: number,
  z: number,
  getBlock: BlockGetter26_3,
  clearance = actor === 'enderman' ? 3 : 2,
  worldHeight = 256,
): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return false;
  if (y < 1 || y + clearance >= worldHeight) return false;

  const support = getBlock(x, y - 1, z);
  if (!BlockRegistry.isSolid(support) || BlockRegistry.isFluid(support)) return false;
  if (isTeleportSupportForbidden26_3(actor, support)) return false;

  for (let dy = 0; dy < clearance; dy++) {
    const block = getBlock(x, y + dy, z);
    if (block !== 0 || BlockRegistry.isFluid(block)) return false;
  }
  return true;
}

export function findChorusFruitDestination26_3(
  origin: TeleportPoint26_3,
  getBlock: BlockGetter26_3,
  random: () => number = Math.random,
  worldHeight = 256,
): TeleportPoint26_3 | null {
  for (let attempt = 0; attempt < TELEPORT_ATTEMPTS_26_3; attempt++) {
    const x = Math.floor(origin.x + (random() - 0.5) * 16);
    const initialY = Math.max(1, Math.min(worldHeight - 3, Math.floor(origin.y + (random() - 0.5) * 16)));
    const z = Math.floor(origin.z + (random() - 0.5) * 16);

    // Vanilla random teleport searches for viable ground. Scan downward within
    // the same eight-block vertical budget rather than accepting an air shelf.
    for (let y = initialY; y >= Math.max(1, initialY - 8); y--) {
      if (!isSafeTeleportDestination26_3('chorus_fruit', x, y, z, getBlock, 2, worldHeight)) continue;
      return { x: x + 0.5, y: y + 0.001, z: z + 0.5 };
    }
  }
  return null;
}

export function teleportDirection26_3(from: TeleportPoint26_3, to: TeleportPoint26_3): TeleportPoint26_3 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dy, dz);
  if (length <= Number.EPSILON) return { x: 0, y: 0, z: 0 };
  return { x: dx / length, y: dy / length, z: dz / length };
}
