export type BedDimension = 'overworld' | 'nether' | 'end';

export interface BedUseDecision {
  canSleep: boolean;
  setsSpawn: boolean;
  explodes: boolean;
}

/** Base Java bed dimension contract. */
export function resolveBedUse(dimension: BedDimension, isNight: boolean): BedUseDecision {
  if (dimension !== 'overworld') {
    return { canSleep: false, setsSpawn: false, explodes: true };
  }
  return { canSleep: isNight, setsSpawn: true, explodes: false };
}
