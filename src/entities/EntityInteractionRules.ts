import { coordinateRandom } from '../engine/DeterministicRandom';

/** A replayable taming roll keyed to simulation time and the target entity. */
export function shouldTameEntity(
  worldSeed: number,
  simulationTick: number,
  entityId: number,
  itemId: number,
  chance = 1 / 3,
): boolean {
  if (chance <= 0) return false;
  if (chance >= 1) return true;
  return coordinateRandom(worldSeed, simulationTick, entityId, itemId) < chance;
}
