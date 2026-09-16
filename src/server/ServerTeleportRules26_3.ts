import {
  findChorusFruitDestination26_3,
  type BlockGetter26_3,
  type TeleportPoint26_3,
} from '../world/TeleportRules26_3';

export interface ChorusTeleportCorrection26_3 {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  teleportEffect: 'chorus_fruit';
  from: TeleportPoint26_3;
}

export interface ServerChorusTeleportPlan26_3 {
  from: TeleportPoint26_3;
  to: TeleportPoint26_3;
  correction: ChorusTeleportCorrection26_3;
}

export function planServerChorusTeleport26_3(
  from: TeleportPoint26_3,
  yaw: number,
  pitch: number,
  getBlock: BlockGetter26_3,
  random: () => number = Math.random,
  worldHeight = 256,
): ServerChorusTeleportPlan26_3 | null {
  const destination = findChorusFruitDestination26_3(from, getBlock, random, worldHeight);
  if (!destination) return null;
  return {
    from: { ...from },
    to: { ...destination },
    correction: {
      x: destination.x,
      y: destination.y,
      z: destination.z,
      yaw,
      pitch,
      teleportEffect: 'chorus_fruit',
      from: { ...from },
    },
  };
}
